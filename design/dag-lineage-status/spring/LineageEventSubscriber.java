package com.example.lineage;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.spring.pubsub.core.PubSubTemplate;
import com.google.cloud.spring.pubsub.support.BasicAcknowledgeablePubsubMessage;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Pull consumer for OpenLineage DAG-level events.
 *
 * Runs inside the existing server process — no separate worker deployment.
 * Multiple replicas all subscribe; Pub/Sub distributes messages and the
 * idempotent upsert makes duplicate delivery harmless.
 *
 * Ack contract:
 *  - success            -> ack
 *  - non-DAG jobType    -> ack (task event that slipped past the transport filter)
 *  - unknown eventType  -> ack (deliberate drop, no status change we track)
 *  - anything thrown    -> nack -> redelivery with backoff -> DLQ after
 *                          max delivery attempts (poison messages)
 */
@Component
public class LineageEventSubscriber {

    private static final Logger log = LoggerFactory.getLogger(LineageEventSubscriber.class);

    private final PubSubTemplate pubSubTemplate;
    private final ObjectMapper objectMapper;
    private final DagRunStatusRepository repository;
    private final String subscription;

    public LineageEventSubscriber(
            PubSubTemplate pubSubTemplate,
            ObjectMapper objectMapper,
            DagRunStatusRepository repository,
            @Value("${lineage.subscription}") String subscription) {
        this.pubSubTemplate = pubSubTemplate;
        this.objectMapper = objectMapper;
        this.repository = repository;
        this.subscription = subscription;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        pubSubTemplate.subscribe(subscription, this::handle);
    }

    void handle(BasicAcknowledgeablePubsubMessage message) {
        try {
            LineageEvent event = objectMapper.readValue(
                    message.getPubsubMessage().getData().toByteArray(), LineageEvent.class);

            if (!event.isDagEvent()) {
                // Task event that slipped past the transport filter.
                message.ack();
                return;
            }
            DagRunState state = mapState(event.eventType());
            if (state == null) {
                // OpenLineage also defines RUNNING/OTHER etc.; they carry no
                // transition we track. Nacking them would just fill the DLQ.
                message.ack();
                return;
            }
            // Runs only. The name -> databaseUri map is mirrored from Pipeline
            // Manager's roster (DagDatabaseUriSync), so ingest owns no part of
            // it and an ack never depends on an upstream being up.
            repository.upsert(toRow(event, state));
            message.ack();
        } catch (Exception e) {
            log.warn("lineage event rejected: {}", e.getMessage());
            message.nack();
        }
    }

    private static DagRunState mapState(String eventType) {
        if (eventType == null) {
            throw new IllegalArgumentException("missing eventType");
        }
        return switch (eventType) {
            case "START" -> DagRunState.RUNNING;
            case "COMPLETE" -> DagRunState.SUCCESS;
            case "FAIL", "ABORT" -> DagRunState.FAILED;
            default -> null;
        };
    }

    /** Boundary validation: required fields missing -> throw -> DLQ. */
    private static DagRunRow toRow(LineageEvent event, DagRunState state) {
        String runId = event.run() != null ? event.run().runId() : null;
        String namespace = event.job() != null ? event.job().namespace() : null;
        String dagId = event.job() != null ? event.job().name() : null;
        OffsetDateTime logicalDate = event.resolveLogicalDate();

        if (runId == null || namespace == null || dagId == null
                || event.eventTime() == null || logicalDate == null) {
            throw new IllegalArgumentException("missing required lineage fields");
        }
        return new DagRunRow(runId, namespace, dagId, logicalDate,
                event.resolveRunType(), state, event.eventTime());
    }
}
