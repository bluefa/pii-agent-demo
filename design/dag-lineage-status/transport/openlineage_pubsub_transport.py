"""OpenLineage custom transport: publish DAG-level RunEvents to GCP Pub/Sub.

Coexists with the already-deployed transport via a composite transport —
the existing config is moved as-is into "transports" and keeps receiving
exactly what it receives today:

    AIRFLOW__OPENLINEAGE__TRANSPORT='{
      "type": "composite",
      "continue_on_failure": true,
      "transports": {
        "existing":      { ...current transport config, unchanged... },
        "weekly_status": { "type": "lineage_pubsub.PubSubTransport",
                           "project": "my-project",
                           "topic": "lineage-events",
                           "dag_name_prefix": "pii_" }
      }
    }'
    AIRFLOW__OPENLINEAGE__NAMESPACE='composer-env-a'   # unique per environment

Written against openlineage-python 1.x. The Transport/Config API and the
composite transport config shape have moved between versions — pin the
client version together with the Airflow provider and verify.
"""
import logging
from dataclasses import dataclass

from google.cloud import pubsub_v1
from openlineage.client.serde import Serde
from openlineage.client.transport import Config, Transport

log = logging.getLogger(__name__)


def _log_publish_failure(future) -> None:
    # Runs on the publisher's background thread; must never raise.
    exc = future.exception()
    if exc is not None:
        log.warning("lineage publish to Pub/Sub failed: %s", exc)


@dataclass
class PubSubConfig(Config):
    project: str
    topic: str
    dag_name_prefix: str

    @classmethod
    def from_dict(cls, params: dict) -> "PubSubConfig":
        return cls(
            project=params["project"],
            topic=params["topic"],
            dag_name_prefix=params["dag_name_prefix"],
        )


class PubSubTransport(Transport):
    kind = "pubsub"
    config_class = PubSubConfig

    def __init__(self, config: PubSubConfig) -> None:
        # PublisherClient batches in a background thread; emit() never blocks
        # the scheduler/worker on publish latency.
        self._publisher = pubsub_v1.PublisherClient()
        self._topic = self._publisher.topic_path(config.project, config.topic)
        self._prefix = config.dag_name_prefix

    def emit(self, event) -> None:
        # Double allow-list, not deny-list:
        #  1) only DAG lifecycle events (task events are 12x the count and
        #     10-25x the bytes — see architecture.md for the volume math)
        #  2) only DAGs whose name starts with the configured prefix
        if not self._is_dag_event(event):
            return
        name = getattr(getattr(event, "job", None), "name", None)
        if name is None or not name.startswith(self._prefix):
            return
        # Fire-and-forget for the scheduler; failures surface in logs so the
        # ingest-volume alarm has a cause to correlate with.
        future = self._publisher.publish(self._topic, Serde.to_json(event).encode("utf-8"))
        future.add_done_callback(_log_publish_failure)

    def close(self, timeout: float = -1) -> bool:
        # Flush pending batches so the tail of a scheduling burst is not lost
        # when the scheduler process exits.
        self._publisher.stop()
        return True

    @staticmethod
    def _is_dag_event(event) -> bool:
        job = getattr(event, "job", None)
        facets = getattr(job, "facets", None) or {}
        job_type = facets.get("jobType")
        return getattr(job_type, "jobType", None) == "DAG"
