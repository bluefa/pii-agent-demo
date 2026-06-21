package com.bff.pipeline.im;

import feign.FeignException;
import feign.RetryableException;
import org.springframework.stereotype.Component;

import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.Collection;
import java.util.Map;

/**
 * Translates a thrown IM call into an {@link ImFault} (backpressure / timeout / hard error). One source
 * of truth so every handler classifies failures identically (DRY).
 */
@Component
public class ImCallMapper {

    private static final int TOO_MANY_REQUESTS = 429;
    private static final int SERVICE_UNAVAILABLE = 503;

    public ImFault classify(Throwable t) {
        if (isTimeout(t)) {
            return new ImFault.Timeout();
        }
        if (t instanceof FeignException fe) {
            int status = fe.status();
            if (status == TOO_MANY_REQUESTS || status == SERVICE_UNAVAILABLE) {
                return new ImFault.Backpressure(retryAfter(fe.responseHeaders()));
            }
            return new ImFault.HardError("HTTP " + status);
        }
        return new ImFault.HardError(String.valueOf(t.getMessage()));
    }

    private static boolean isTimeout(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof SocketTimeoutException || c instanceof RetryableException) {
                return true;
            }
        }
        return false;
    }

    /** Retry-After header in seconds; null if absent or non-numeric (HTTP-date form is not parsed here). */
    private static Duration retryAfter(Map<String, Collection<String>> headers) {
        if (headers == null) {
            return null;
        }
        for (Map.Entry<String, Collection<String>> e : headers.entrySet()) {
            if (!"retry-after".equalsIgnoreCase(e.getKey()) || e.getValue() == null) {
                continue;
            }
            for (String v : e.getValue()) {
                try {
                    return Duration.ofSeconds(Long.parseLong(v.trim()));
                } catch (NumberFormatException ignored) {
                    return null;
                }
            }
        }
        return null;
    }
}
