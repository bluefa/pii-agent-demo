package com.bff.pipeline.service.handler;
import com.bff.pipeline.exception.UnknownHandlerException;

import org.springframework.stereotype.Component;
import org.springframework.util.ClassUtils;

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
public class PipelineHandlerRegistry {

    private final Map<String, PipelineHandler> byKey;
    private final Map<Class<?>, PipelineHandler> byClass;

    public PipelineHandlerRegistry(List<PipelineHandler> handlers) {
        Map<String, PipelineHandler> m = new HashMap<>();
        Map<Class<?>, PipelineHandler> byType = new HashMap<>();
        for (PipelineHandler h : handlers) {
            PipelineHandler prev = m.putIfAbsent(h.key(), h);
            if (prev != null) {
                throw new IllegalStateException(
                        "Duplicate handler key '" + h.key() + "': " + prev.getClass().getName()
                                + " vs " + h.getClass().getName());
            }
            // user class, not the runtime type: an AOP-proxied handler's getClass() is a CGLIB
            // subclass, but recipes reference the real handler class — index by that. Fail fast on
            // two beans of the same handler class (the class index could not disambiguate them).
            Class<?> userClass = ClassUtils.getUserClass(h);
            PipelineHandler prevByClass = byType.putIfAbsent(userClass, h);
            if (prevByClass != null) {
                throw new IllegalStateException("Duplicate handler class '" + userClass.getName()
                        + "': " + prevByClass.key() + " vs " + h.key());
            }
        }
        this.byKey = Map.copyOf(m);
        this.byClass = Map.copyOf(byType);
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

    /** resolve a handler by its concrete class (recipe class-ref path); throws if its bean is absent. */
    public PipelineHandler getByClass(Class<? extends PipelineHandler> type) {
        PipelineHandler h = byClass.get(type);
        if (h == null) {
            throw new UnknownHandlerException(type.getName());
        }
        return h;
    }

    /** the registered String key for a handler class — creation freezes this onto the task row. */
    public String keyOf(Class<? extends PipelineHandler> type) {
        return getByClass(type).key();
    }
}
