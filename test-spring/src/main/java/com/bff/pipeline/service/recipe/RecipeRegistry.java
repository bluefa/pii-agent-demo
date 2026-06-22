package com.bff.pipeline.service.recipe;
import com.bff.pipeline.dto.TaskDefinition;
import com.bff.pipeline.dto.PipelineDefinition;

import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.service.handler.PipelineHandlerRegistry;
import com.bff.pipeline.service.handler.PipelineHandler;
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

    public RecipeRegistry(List<PipelineDefinition> definitions, PipelineHandlerRegistry handlers) {
        for (PipelineDefinition def : definitions) {
            String k = key(def.getType(), def.getProvider());
            if (byTypeProvider.putIfAbsent(k, def) != null) {
                throw new IllegalStateException("Duplicate default recipe for " + k);
            }
            for (TaskDefinition t : def.getTasks()) {
                PipelineHandler h = handlers.getByClass(t.getHandlerClass());
                if (h.kind() != t.getKind()) {
                    throw new IllegalStateException("Recipe " + def.getDefinitionKey() + " task '" + t.getName()
                            + "' kind " + t.getKind() + " != handler "
                            + t.getHandlerClass().getSimpleName() + " kind " + h.kind());
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
