"""OpenLineage custom transport: publish DAG-level RunEvents to GCP Pub/Sub.

Ship as a small PyPI package installed on every Composer environment, then
point the provider at it with two environment variables:

    AIRFLOW__OPENLINEAGE__TRANSPORT='{"type": "lineage_pubsub.PubSubTransport",
                                      "project": "my-project",
                                      "topic": "lineage-events"}'
    AIRFLOW__OPENLINEAGE__NAMESPACE='composer-env-a'   # unique per environment

Written against openlineage-python 1.x. The Transport/Config API has moved
between majors — pin the client version together with the Airflow provider.
"""
from dataclasses import dataclass

from google.cloud import pubsub_v1
from openlineage.client.serde import Serde
from openlineage.client.transport import Config, Transport


@dataclass
class PubSubConfig(Config):
    project: str
    topic: str

    @classmethod
    def from_dict(cls, params: dict) -> "PubSubConfig":
        return cls(project=params["project"], topic=params["topic"])


class PubSubTransport(Transport):
    kind = "pubsub"
    config_class = PubSubConfig

    def __init__(self, config: PubSubConfig) -> None:
        # PublisherClient batches in a background thread; emit() never blocks
        # the scheduler/worker on publish latency.
        self._publisher = pubsub_v1.PublisherClient()
        self._topic = self._publisher.topic_path(config.project, config.topic)

    def emit(self, event) -> None:
        # Allow-list, not deny-list: only DAG lifecycle events leave the
        # environment. Task events (12x the count, 10-25x the bytes) are
        # dropped at the source. See architecture.md for the volume math.
        if not self._is_dag_event(event):
            return
        self._publisher.publish(self._topic, Serde.to_json(event).encode("utf-8"))

    @staticmethod
    def _is_dag_event(event) -> bool:
        job = getattr(event, "job", None)
        facets = getattr(job, "facets", None) or {}
        job_type = facets.get("jobType")
        return getattr(job_type, "jobType", None) == "DAG"
