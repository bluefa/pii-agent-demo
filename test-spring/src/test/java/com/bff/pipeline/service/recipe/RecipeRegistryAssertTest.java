package com.bff.pipeline.service.recipe;

import com.bff.pipeline.dto.PipelineDefinition;
import com.bff.pipeline.dto.TaskDefinition;
import com.bff.pipeline.type.PipelineType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@link RecipeRegistry} construction + resolution. Operations are fixed in the recipe ({@code
 * TaskDefinition.operation}), so there is no handler-registry boot assert; the only boot-assert left is "one
 * default release per (type, provider)". No Spring context — the registry is plain constructor injection.
 */
class RecipeRegistryAssertTest {

    @Test
    void rejectsTwoDefaultRecipesForTheSameTypeAndProvider() {
        PipelineDefinition one = recipe("install/test", "TEST");
        PipelineDefinition two = recipe("install/test-2", "TEST"); // same (INSTALL, TEST) pair

        assertThatThrownBy(() -> new RecipeRegistry(List.of(one, two)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate default recipe");
    }

    @Test
    void resolvesAndFindsByTypeAndProvider() {
        RecipeRegistry registry = new RecipeRegistry(List.of(recipe("install/test", "TEST")));

        assertThat(registry.resolve(PipelineType.INSTALL, "TEST").getDefinitionKey()).isEqualTo("install/test");
        assertThat(registry.find(PipelineType.INSTALL, "OTHER")).isEmpty();
    }

    private static PipelineDefinition recipe(String key, String provider) {
        return PipelineDefinition.builder()
                .definitionKey(key).version("v1").type(PipelineType.INSTALL).provider(provider)
                .tasks(List.of(
                        TaskDefinition.terraformJob("apply", "apply-network"),
                        TaskDefinition.conditionCheck("ready", "network-ready")))
                .build();
    }
}
