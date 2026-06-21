package com.bff.pipeline.handler;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Auto-collected handler registry (Decision 2): all {@link PipelineHandler} beans are injected and a
 * {@code key() -> handler} map is derived at boot. No hand-maintained list; a duplicate key fails boot.
 * A runtime miss is the safety net behind the pre-deploy CI gate.
 */
@Component
public class HandlerRegistry {

    private final Map<String, PipelineHandler> byKey;

    public HandlerRegistry(List<PipelineHandler> handlers) {
        Map<String, PipelineHandler> m = new HashMap<>();
        for (PipelineHandler h : handlers) {
            PipelineHandler prev = m.putIfAbsent(h.key(), h);
            if (prev != null) {
                throw new IllegalStateException(
                        "Duplicate handler key '" + h.key() + "': " + prev.getClass().getName()
                                + " vs " + h.getClass().getName());
            }
        }
        this.byKey = Map.copyOf(m);
    }

    /** resolve or throw (call path). */
    public PipelineHandler get(String key) {
        PipelineHandler h = byKey.get(key);
        if (h == null) {
            throw new UnknownHandlerException(key);
        }
        return h;
    }

    /** resolve without throwing (reconciler handler-resolve step). */
    public Optional<PipelineHandler> find(String key) {
        return Optional.ofNullable(byKey.get(key));
    }

    public boolean contains(String key) {
        return byKey.containsKey(key);
    }
}
