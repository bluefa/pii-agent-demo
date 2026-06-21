package com.bff.pipeline.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/**
 * Production executor: each external call runs on its own virtual thread and is bounded by the per-call
 * deadline. On deadline exceed the call is cancelled and reported as {@code timedOut} (the orchestrator
 * maps that to CALL_TIMEOUT). Latency is measured with {@link System#nanoTime()} (a duration, not wall
 * clock). Tests substitute a synchronous fake, so this class is never exercised under @DataJpaTest.
 */
@Component
class VirtualThreadExternalCallExecutor implements ExternalCallExecutor {

    private final ExecutorService virtualThreads = Executors.newVirtualThreadPerTaskExecutor();

    @Override
    public <T> CallOutcome<T> call(Supplier<T> work, Duration deadline) {
        long start = System.nanoTime();
        Future<T> future = virtualThreads.submit(work::get);
        try {
            T value = future.get(deadline.toMillis(), TimeUnit.MILLISECONDS);
            return new CallOutcome<>(value, elapsedMs(start), false);
        } catch (TimeoutException e) {
            future.cancel(true);
            return new CallOutcome<>(null, deadline.toMillis(), true);
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
