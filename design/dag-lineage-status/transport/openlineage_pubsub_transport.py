"""OpenLineage custom transport: publish DAG-level RunEvents to GCP Pub/Sub.

Coexists with the already-deployed transport via a composite transport —
the existing config is moved as-is into "transports" and keeps receiving
exactly what it receives today:

    AIRFLOW__OPENLINEAGE__TRANSPORT='{
      "type": "composite",
      "continue_on_failure": true,
      "transports": {
        "existing":      { ...current transport config, unchanged... },
        "dag_monitoring": { "type": "lineage_pubsub.PubSubTransport",
                            "project": "my-project",
                            "topic": "lineage-events",
                            "dag_name_prefix": "pii_" }
      }
    }'
    AIRFLOW__OPENLINEAGE__NAMESPACE='composer-env-a'   # unique per environment

Before publishing, the transport looks up the DAG's databaseUri (the logical
DB it processes) and injects it into the event as a job facet — see
_fetch_database_uri() for the lookup, which is not wired to a concrete API yet.

Written against openlineage-python 1.x. The Transport/Config API and the
composite transport config shape have moved between versions — pin the
client version together with the Airflow provider and verify.
"""
import json
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
        # Triple allow-list, not deny-list:
        #  1) only DAG lifecycle events (task events are 12x the count and
        #     10-25x the bytes — see architecture.md for the volume math)
        #  2) only DAGs whose name starts with the configured prefix
        #  3) only DAGs whose databaseUri lookup succeeds — an event the
        #     consumer cannot attribute to a logical DB is never published
        if not self._is_dag_event(event):
            return
        name = getattr(getattr(event, "job", None), "name", None)
        if name is None or not name.startswith(self._prefix):
            return
        database_uri = self._database_uri_or_drop(name)
        if database_uri is None:
            return
        # Inject into the serialized JSON, never into the event object: the
        # composite transport hands the SAME event instance to every transport,
        # so mutating it would leak this facet into the existing transport's
        # output ("existing behavior unchanged" is the definition of
        # coexistence here).
        payload = json.loads(Serde.to_json(event))
        payload.setdefault("job", {}).setdefault("facets", {})["piiMonitoring"] = {
            "databaseUri": database_uri,
        }
        # Fire-and-forget for the scheduler; failures surface in logs so the
        # ingest-volume alarm has a cause to correlate with.
        future = self._publisher.publish(self._topic, json.dumps(payload).encode("utf-8"))
        future.add_done_callback(_log_publish_failure)

    def close(self, timeout: float = -1) -> bool:
        # Flush pending batches so the tail of a scheduling burst is not lost
        # when the scheduler process exits.
        self._publisher.stop()
        return True

    def _database_uri_or_drop(self, dag_name):
        """The DAG's databaseUri, or None meaning "do not publish".

        Both drops are invisible to the consumer — the board just renders the
        logical DB as "never scheduled" — so these log lines are the only
        place either mistake is observable at all. Nothing may escape here:
        emit() runs on the scheduler's listener thread, and a monitoring
        lookup must never break scheduling.
        """
        try:
            database_uri = self._fetch_database_uri(dag_name)
        except Exception:
            log.warning("databaseUri lookup failed for dag %s — event dropped",
                        dag_name, exc_info=True)
            return None
        if database_uri is None:
            log.warning("no databaseUri mapped for dag %s — event dropped", dag_name)
        return database_uri

    def _fetch_database_uri(self, dag_name):
        """dagName -> databaseUri, from the upstream that owns the mapping.

        NEED IMPLEMENT: which API serves this lookup is not identified yet.
        When it is, call it here with a short timeout and return None for
        "no mapping". SEAM: this is the only method that knows where the
        mapping lives; the consumer never looks anything up (the event
        carries the value).
        """
        # ponytail: no cache — 2 lookups per DAG per day. The mapping is 1:1
        # and immutable (owner-confirmed), so a plain dict cache of successes
        # is safe to add here if the API can't take the call volume.
        raise NotImplementedError("dagName -> databaseUri lookup API is not identified yet")

    @staticmethod
    def _is_dag_event(event) -> bool:
        job = getattr(event, "job", None)
        facets = getattr(job, "facets", None) or {}
        job_type = facets.get("jobType")
        return getattr(job_type, "jobType", None) == "DAG"
