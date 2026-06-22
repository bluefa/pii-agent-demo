package com.bff.pipeline.service.external;
import com.bff.pipeline.dto.ExternalCallOutcome;

import java.time.Duration;
import java.util.function.Supplier;

/**
 * Runs one external call with a per-call deadline (D-T3: a single run/poll/check, global + TaskKind
 * setting — not per task). Production runs it on a virtual thread and enforces the deadline; tests use a
 * synchronous fake that returns a controlled latency / timeout. Isolating the call here is what keeps the
 * single-writer split honest — the observation write stays in the call-thread transaction, never the tick's.
 */
public interface ExternalCallExecutor {

    <T> ExternalCallOutcome<T> call(Supplier<T> work, Duration deadline);
}
