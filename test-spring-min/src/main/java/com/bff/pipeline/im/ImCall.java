package com.bff.pipeline.im;

import com.bff.pipeline.config.PipelineSettings;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/**
 * Runs one IM call on the bounded pool under the per-call timeout (minimal-redesign.md §3/§4). A call that
 * exceeds {@code perCallTimeout} is abandoned and reported via {@link CallTimeoutException} (the reconciler maps
 * it to CALL_TIMEOUT); any other failure propagates as the thrown cause for the reconciler to count as a
 * retriable failure. Keeping the timeout here is what lets the tick own the task row without blocking on a slow
 * call indefinitely.
 */
@Component
public class ImCall {

    private final ExecutorService pool;
    private final PipelineSettings settings;

    public ImCall(ExecutorService imCallPool, PipelineSettings settings) {
        this.pool = imCallPool;
        this.settings = settings;
    }

    /** Run {@code call} under the per-call timeout; throws {@link CallTimeoutException} if it does not finish. */
    public <T> T withTimeout(Supplier<T> call) {
        Future<T> future = pool.submit(call::get);
        try {
            return future.get(settings.getPerCallTimeout().toMillis(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new CallTimeoutException();
        } catch (InterruptedException e) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            throw new IllegalStateException("IM call interrupted", e);
        } catch (java.util.concurrent.ExecutionException e) {
            throw e.getCause() instanceof RuntimeException re ? re : new IllegalStateException(e.getCause());
        }
    }

    /** Signals that a single IM call exceeded the per-call timeout (→ CALL_TIMEOUT). */
    public static final class CallTimeoutException extends RuntimeException {
        public CallTimeoutException() {
            super("IM call exceeded the per-call timeout");
        }
    }
}
