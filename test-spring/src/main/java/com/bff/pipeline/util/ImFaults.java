package com.bff.pipeline.util;

import com.bff.pipeline.dto.CallResult;
import com.bff.pipeline.type.CallStatus;
import com.bff.pipeline.type.ErrorCode;
import feign.FeignException;
import feign.RetryableException;
import org.springframework.lang.Nullable;

import java.net.SocketTimeoutException;
import java.time.Duration;
import java.util.Collection;
import java.util.Map;

/**
 * Pure mapping of a thrown IM call into a {@link CallResult} verdict (formerly {@code ImCallMapper}, then folded
 * into the launcher; now a stateless utility). A socket timeout reads as TIMEOUT/CALL_TIMEOUT; a 429/503 Feign
 * error reads as BACKPRESSURE (with the Retry-After, if numeric); any other thrown error is a hard REJECT. The
 * per-call deadline TIMEOUT is the launcher's (it bounds the call duration), not classified here.
 */
public final class ImFaults {

    private static final int TOO_MANY_REQUESTS = 429;
    private static final int SERVICE_UNAVAILABLE = 503;

    private ImFaults() {
    }

    /** Translate a thrown IM call into a {@link CallResult} (TIMEOUT / BACKPRESSURE / REJECT). */
    public static CallResult classify(RuntimeException e) {
        if (isSocketTimeout(e)) {
            return CallResult.builder().status(CallStatus.TIMEOUT).errorCode(ErrorCode.CALL_TIMEOUT).build();
        }
        if (e instanceof FeignException fe) {
            int status = fe.status();
            if (status == TOO_MANY_REQUESTS || status == SERVICE_UNAVAILABLE) {
                return CallResult.builder().status(CallStatus.BACKPRESSURE)
                        .retryAfter(retryAfter(fe.responseHeaders())).build();
            }
        }
        return CallResult.builder().status(CallStatus.REJECT).build();
    }

    private static boolean isSocketTimeout(Throwable t) {
        for (Throwable c = t; c != null; c = c.getCause()) {
            if (c instanceof SocketTimeoutException || c instanceof RetryableException) {
                return true;
            }
        }
        return false;
    }

    /** Retry-After header in seconds; null if absent or non-numeric (HTTP-date form is not parsed here). */
    @Nullable
    private static Duration retryAfter(@Nullable Map<String, Collection<String>> headers) {
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
