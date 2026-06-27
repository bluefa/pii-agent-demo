package com.bff.pipeline.create;

import com.bff.pipeline.create.Recipe.Step;
import com.bff.pipeline.domain.PipelineType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * The code-default recipe per {@code PipelineType} (minimal-redesign.md §1). INSTALL applies a TF network job
 * then checks the network is ready; DELETE tears it down. One recipe per type — no provider matrix in the
 * minimal design.
 */
@Component
public class Recipes {

    private final Map<PipelineType, Recipe> byType = Map.of(
            PipelineType.INSTALL, new Recipe(List.of(
                    Step.terraform("apply-network"),
                    Step.condition("network-ready"))),
            PipelineType.DELETE, new Recipe(List.of(
                    Step.terraform("destroy-network"))));

    public Recipe forType(PipelineType type) {
        Recipe recipe = byType.get(type);
        if (recipe == null) {
            throw new IllegalArgumentException("no recipe for " + type);
        }
        return recipe;
    }
}
