package com.bff.pipeline.service.recipe;

import com.bff.pipeline.dto.PipelineDefinition;
import com.bff.pipeline.dto.TaskDefinition;
import com.bff.pipeline.type.PipelineType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Code-default recipes keyed by (type, provider) — one release per pair (Decision 7.4). The built-in defaults
 * (formerly {@code DefaultRecipes}) live here in {@link #builtIn()}; Spring also injects any extra
 * {@link PipelineDefinition} beans (tests supply their own), and a duplicate (type, provider) across the two
 * sources fails at boot. The operation each task runs is fixed in the recipe ({@code TaskDefinition.operation}),
 * so there is no handler-registry boot assert.
 *
 * <p>The example INSTALL/AWS chain is a TERRAFORM_JOB (apply network) then a CONDITION_CHECK (network ready);
 * each task names the IM operation it runs, which the launcher selects by {@code (kind, operation)}.
 */
@Component
public class RecipeRegistry {

    private final Map<String, PipelineDefinition> byTypeProvider = new HashMap<>();

    public RecipeRegistry(List<PipelineDefinition> extraDefinitions) {
        List<PipelineDefinition> all = new ArrayList<>(builtIn());
        all.addAll(extraDefinitions);
        for (PipelineDefinition def : all) {
            String k = key(def.getType(), def.getProvider());
            if (byTypeProvider.putIfAbsent(k, def) != null) {
                throw new IllegalStateException("Duplicate default recipe for " + k);
            }
        }
    }

    /** The built-in code-default recipes (one release per (type, provider)). */
    private static List<PipelineDefinition> builtIn() {
        return List.of(PipelineDefinition.builder()
                .definitionKey("install/aws")
                .version("v1")
                .type(PipelineType.INSTALL)
                .provider("AWS")
                .tasks(List.of(
                        TaskDefinition.terraformJob("apply network", "apply-network"),
                        TaskDefinition.conditionCheck("network ready", "network-ready")))
                .build());
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
