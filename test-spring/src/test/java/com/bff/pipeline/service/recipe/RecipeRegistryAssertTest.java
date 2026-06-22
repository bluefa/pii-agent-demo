package com.bff.pipeline.service.recipe;
import com.bff.pipeline.dto.PipelineDefinition;
import com.bff.pipeline.dto.TaskDefinition;

import com.bff.pipeline.type.Observed;
import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.type.TaskKind;
import com.bff.pipeline.dto.ConditionCheckContext;
import com.bff.pipeline.dto.ConditionCheckOutcome;
import com.bff.pipeline.service.handler.ConditionCheckHandler;
import com.bff.pipeline.dto.TerraformDispatchContext;
import com.bff.pipeline.dto.TerraformDispatchOutcome;
import com.bff.pipeline.service.handler.PipelineHandlerRegistry;
import com.bff.pipeline.service.handler.PipelineHandler;
import com.bff.pipeline.dto.TerraformPollContext;
import com.bff.pipeline.dto.TerraformPollOutcome;
import com.bff.pipeline.service.handler.TerraformJobHandler;
import com.bff.pipeline.exception.UnknownHandlerException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Boot-assert (defense-in-depth) of {@link RecipeRegistry}: at construction every recipe task's handler
 * must be registered AND its declared kind must match the handler's kind. No Spring context — the registry
 * is plain constructor injection, fed a {@link PipelineHandlerRegistry} built from named static fakes.
 */
class RecipeRegistryAssertTest {

    private final PipelineHandlerRegistry handlers =
            new PipelineHandlerRegistry(List.of(new FakeTf(), new FakeCond()));

    @Test
    void rejectsRecipeWhoseTaskKindDisagreesWithItsHandlerKind() {
        // CONDITION_CHECK kind, but the referenced handler is a TERRAFORM_JOB handler. Built via the
        // builder with an explicit kind so it is NOT auto-corrected by the conditionCheck() factory.
        TaskDefinition mismatched = TaskDefinition.builder()
                .name("ready").handlerClass(FakeTf.class).kind(TaskKind.CONDITION_CHECK).build();
        PipelineDefinition badRecipe = PipelineDefinition.builder()
                .definitionKey("install/test").version("v1").type(PipelineType.INSTALL).provider("TEST")
                .tasks(List.of(mismatched)).build();

        assertThatThrownBy(() -> new RecipeRegistry(List.of(badRecipe), handlers))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("kind")
                .hasMessageContaining("!= handler");
    }

    @Test
    void rejectsRecipeReferencingAnUnregisteredHandlerClass() {
        TaskDefinition unknown = TaskDefinition.conditionCheck("ready", UnregisteredHandler.class);
        PipelineDefinition badRecipe = PipelineDefinition.builder()
                .definitionKey("install/test").version("v1").type(PipelineType.INSTALL).provider("TEST")
                .tasks(List.of(unknown)).build();

        assertThatThrownBy(() -> new RecipeRegistry(List.of(badRecipe), handlers))
                .isInstanceOf(UnknownHandlerException.class);
    }

    /** Named TERRAFORM_JOB stub (stable class for the registry's class index). */
    static final class FakeTf implements TerraformJobHandler {
        @Override
        public String key() {
            return "test.tf.apply";
        }

        @Override
        public TerraformDispatchOutcome dispatch(TerraformDispatchContext ctx) {
            return TerraformDispatchOutcome.Accepted.builder().handle("job-test").build();
        }

        @Override
        public TerraformPollOutcome poll(TerraformPollContext ctx) {
            return TerraformPollOutcome.Status.builder().observed(Observed.SUCCEEDED).build();
        }
    }

    /** Named CONDITION_CHECK stub. */
    static final class FakeCond implements ConditionCheckHandler {
        @Override
        public String key() {
            return "test.cond.ready";
        }

        @Override
        public ConditionCheckOutcome check(ConditionCheckContext ctx) {
            return ConditionCheckOutcome.Condition.builder().observed(Observed.MET).build();
        }
    }

    /** Registered nowhere — used to prove the unknown-handler boot-assert path. */
    static final class UnregisteredHandler implements PipelineHandler {
        @Override
        public String key() {
            return "test.unregistered";
        }

        @Override
        public TaskKind kind() {
            return TaskKind.CONDITION_CHECK;
        }
    }
}
