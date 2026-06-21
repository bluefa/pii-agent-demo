package com.bff.pipeline.recipe;

import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.handler.HandlerRegistry;
import com.bff.pipeline.handler.PipelineHandler;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Code-default recipes keyed by (type, provider) — one per pair (Decision 7.4). At boot it asserts every
 * referenced handler_key is registered and its kind matches the task's kind (boot assert /
 * defense-in-depth behind the pre-deploy CI gate).
 */
@Component
public class RecipeRegistry {

    private final Map<String, PipelineDefinition> byTypeProvider = new HashMap<>();

    public RecipeRegistry(List<PipelineDefinition> definitions, HandlerRegistry handlers) {
        for (PipelineDefinition def : definitions) {
            String k = key(def.type(), def.provider());
            if (byTypeProvider.putIfAbsent(k, def) != null) {
                throw new IllegalStateException("Duplicate default recipe for " + k);
            }
            for (TaskDefinition t : def.tasks()) {
                PipelineHandler h = handlers.find(t.handlerKey()).orElseThrow(() ->
                        new IllegalStateException("Recipe " + def.definitionKey()
                                + " references unregistered handler_key: " + t.handlerKey()));
                if (h.kind() != t.kind()) {
                    throw new IllegalStateException("Recipe " + def.definitionKey() + " task '" + t.name()
                            + "' kind " + t.kind() + " != handler " + t.handlerKey() + " kind " + h.kind());
                }
            }
        }
    }

    public PipelineDefinition resolve(PipelineType type, String provider) {
        PipelineDefinition def = byTypeProvider.get(key(type, provider));
        if (def == null) {
            throw new IllegalArgumentException("No default recipe for " + type + "/" + provider);
        }
        return def;
    }

    public Optional<PipelineDefinition> find(PipelineType type, String provider) {
        return Optional.ofNullable(byTypeProvider.get(key(type, provider)));
    }

    private static String key(PipelineType type, String provider) {
        return type + "::" + provider;
    }
}
