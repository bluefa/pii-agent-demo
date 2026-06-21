package com.bff.pipeline.recipe;

import com.bff.pipeline.domain.Observed;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.domain.TaskKind;
import com.bff.pipeline.handler.CheckContext;
import com.bff.pipeline.handler.CheckOutcome;
import com.bff.pipeline.handler.ConditionCheckHandler;
import com.bff.pipeline.handler.DispatchContext;
import com.bff.pipeline.handler.DispatchOutcome;
import com.bff.pipeline.handler.HandlerRegistry;
import com.bff.pipeline.handler.PipelineHandler;
import com.bff.pipeline.handler.PollContext;
import com.bff.pipeline.handler.PollOutcome;
import com.bff.pipeline.handler.TerraformJobHandler;
import com.bff.pipeline.handler.UnknownHandlerException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Boot-assert (defense-in-depth) of {@link RecipeRegistry}: at construction every recipe task's handler
 * must be registered AND its declared kind must match the handler's kind. No Spring context — the registry
 * is plain constructor injection, fed a {@link HandlerRegistry} built from named static fakes.
 */
class RecipeRegistryAssertTest {

    private final HandlerRegistry handlers =
            new HandlerRegistry(List.of(new FakeTf(), new FakeCond()));

    @Test
    void rejectsRecipeWhoseTaskKindDisagreesWithItsHandlerKind() {
        // CONDITION_CHECK kind, but the referenced handler is a TERRAFORM_JOB handler. Built via the
        // canonical record constructor so the kind is NOT auto-corrected by the conditionCheck() factory.
        TaskDefinition mismatched = new TaskDefinition(
                "ready", FakeTf.class, TaskKind.CONDITION_CHECK, null, null, null, null);
        PipelineDefinition badRecipe = new PipelineDefinition(
                "install/test", "v1", PipelineType.INSTALL, "TEST", List.of(mismatched));

        assertThatThrownBy(() -> new RecipeRegistry(List.of(badRecipe), handlers))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("kind")
                .hasMessageContaining("!= handler");
    }

    @Test
    void rejectsRecipeReferencingAnUnregisteredHandlerClass() {
        TaskDefinition unknown = TaskDefinition.conditionCheck("ready", UnregisteredHandler.class);
        PipelineDefinition badRecipe = new PipelineDefinition(
                "install/test", "v1", PipelineType.INSTALL, "TEST", List.of(unknown));

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
        public DispatchOutcome dispatch(DispatchContext ctx) {
            return new DispatchOutcome.Accepted("job-test");
        }

        @Override
        public PollOutcome poll(PollContext ctx) {
            return new PollOutcome.Status(Observed.SUCCEEDED);
        }
    }

    /** Named CONDITION_CHECK stub. */
    static final class FakeCond implements ConditionCheckHandler {
        @Override
        public String key() {
            return "test.cond.ready";
        }

        @Override
        public CheckOutcome check(CheckContext ctx) {
            return new CheckOutcome.Condition(Observed.MET);
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
