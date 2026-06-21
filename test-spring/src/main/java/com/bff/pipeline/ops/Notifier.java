package com.bff.pipeline.ops;

import com.bff.pipeline.domain.PipelineEvent;
import com.bff.pipeline.repo.PipelineEventRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * The outbox consumer (Decision 1.3). Append-only writes are the producer's job (EventRecorder, in the same
 * tx as the state change); this side ONLY claims unsent {@code pipeline_event} rows and stamps
 * {@code notified_at}. Claiming with {@code FOR UPDATE SKIP LOCKED} lets N pods divide the outbox without a
 * leader. Delivery is at-least-once and crash-safe: a row whose stamp didn't commit stays {@code notified_at
 * IS NULL} and is re-claimed next pass (in-app read-dedup by event id makes it effectively-once).
 */
@Component
public class Notifier {

    private final PipelineEventRepository events;
    private final Clock clock;

    public Notifier(PipelineEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    @Transactional
    public int consume() {
        List<PipelineEvent> batch = events.claimUnsent();
        Instant now = clock.instant();
        for (PipelineEvent event : batch) {
            event.setNotifiedAt(now);
            events.save(event);
        }
        return batch.size();
    }
}
