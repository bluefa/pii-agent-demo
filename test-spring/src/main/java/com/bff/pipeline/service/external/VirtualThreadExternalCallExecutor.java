package com.bff.pipeline.service.external;
import com.bff.pipeline.dto.ExternalCallOutcome;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/**
 * Production executor: bounds ONE external call's duration by the per-call deadline (D-T3). On deadline
 * exceed the call is cancelled and reported as {@code timedOut} (the orchestrator maps that to CALL_TIMEOUT).
 * Latency is measured with {@link System#nanoTime()} (a duration, not wall clock). Tests substitute a
 * synchronous fake, so this class is never exercised under @DataJpaTest.
 *
 * <p><b>Async by design (D-T2).</b> The tick never reaches this class directly: {@link ExternalCallLauncher}
 * submits the call fire-and-forget onto the {@code pipelineCallExecutor} virtual-thread pool, so the tick
 * returns immediately and never blocks on a slow IM call. This class runs on that call thread and enforces
 * the deadline THERE — {@code future.get(deadline)} waits on a child virtual thread (the wait is cheap and
 * gives an <em>interruptible</em> timeout), bounding only this single call's duration. It returns an
 * {@link ExternalCallOutcome} carrying {@code timedOut} / latency; the launcher then writes the observation
 * on this same call thread, and a LATER tick reads that committed observation to advance state (D-T4 single
 * writer). Correctness rests on the CAS transitions reading committed observations, not on the call threading.
 */
@Component
class VirtualThreadExternalCallExecutor implements ExternalCallExecutor {

    private final ExecutorService virtualThreads = Executors.newVirtualThreadPerTaskExecutor();

    @Override
    public <T> ExternalCallOutcome<T> call(Supplier<T> work, Duration deadline) {
        long start = System.nanoTime();
        Future<T> future = virtualThreads.submit(work::get);
        try {
            T value = future.get(deadline.toMillis(), TimeUnit.MILLISECONDS);
            return ExternalCallOutcome.<T>builder().value(value).latencyMs(elapsedMs(start)).timedOut(false).build();
        } catch (TimeoutException e) {
            future.cancel(true);
            return ExternalCallOutcome.<T>builder().value(null).latencyMs(deadline.toMillis()).timedOut(true).build();
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new IllegalStateException("external call interrupted", e);
        } catch (java.util.concurrent.ExecutionException e) {
            // The handler contract is to map IM faults to outcomes, not throw — an actual throw is a bug.
            throw new IllegalStateException("external call handler threw", e.getCause());
        }
    }

    private static long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
