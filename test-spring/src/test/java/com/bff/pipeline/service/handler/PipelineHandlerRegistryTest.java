package com.bff.pipeline.service.handler;
import com.bff.pipeline.exception.UnknownHandlerException;
import com.bff.pipeline.dto.ConditionCheckContext;
import com.bff.pipeline.dto.ConditionCheckOutcome;
import com.bff.pipeline.dto.TerraformDispatchContext;
import com.bff.pipeline.dto.TerraformDispatchOutcome;
import com.bff.pipeline.dto.TerraformPollContext;
import com.bff.pipeline.dto.TerraformPollOutcome;

import com.bff.pipeline.type.Observed;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Class-index resolution of {@link PipelineHandlerRegistry} (the recipe class-ref path). Uses named static fake
 * handlers so {@code getClass()} is stable across the test (an anonymous/lambda handler would have an
 * unstable synthetic class). No Spring context — the registry is a plain constructor-injected component.
 */
class PipelineHandlerRegistryTest {

    private final FakeTerraformHandler terraform = new FakeTerraformHandler();
    private final FakeConditionHandler condition = new FakeConditionHandler();
    private final PipelineHandlerRegistry registry = new PipelineHandlerRegistry(List.of(terraform, condition));

    @Test
    void keyOfReturnsTheRegisteredKeyForAHandlerClass() {
        assertThat(registry.keyOf(FakeTerraformHandler.class)).isEqualTo("fake.tf");
        assertThat(registry.keyOf(FakeConditionHandler.class)).isEqualTo("fake.cond");
    }

    @Test
    void getByClassReturnsTheRegisteredInstance() {
        assertThat(registry.getByClass(FakeTerraformHandler.class)).isSameAs(terraform);
        assertThat(registry.getByClass(FakeConditionHandler.class)).isSameAs(condition);
    }

    @Test
    void getByClassWithUnregisteredClassThrowsUnknownHandler() {
        assertThatThrownBy(() -> registry.getByClass(UnregisteredHandler.class))
                .isInstanceOf(UnknownHandlerException.class);
    }

    @Test
    void keyOfWithUnregisteredClassThrowsUnknownHandler() {
        assertThatThrownBy(() -> registry.keyOf(UnregisteredHandler.class))
                .isInstanceOf(UnknownHandlerException.class);
    }

    @Test
    void failsFastOnTwoBeansOfTheSameHandlerClass() {
        // distinct keys so the duplicate-key check passes and the class index is what fails.
        assertThatThrownBy(() -> new PipelineHandlerRegistry(
                List.of(new KeyedConditionHandler("k1"), new KeyedConditionHandler("k2"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Duplicate handler class");
    }

    /** Named (non-anonymous) so {@code getClass()} is the stable index key. */
    static final class FakeTerraformHandler implements TerraformJobHandler {
        @Override
        public String key() {
            return "fake.tf";
        }

        @Override
        public TerraformDispatchOutcome dispatch(TerraformDispatchContext ctx) {
            return TerraformDispatchOutcome.Accepted.builder().handle("job-1").build();
        }

        @Override
        public TerraformPollOutcome poll(TerraformPollContext ctx) {
            return TerraformPollOutcome.Status.builder().observed(Observed.SUCCEEDED).build();
        }
    }

    static final class FakeConditionHandler implements ConditionCheckHandler {
        @Override
        public String key() {
            return "fake.cond";
        }

        @Override
        public ConditionCheckOutcome check(ConditionCheckContext ctx) {
            return ConditionCheckOutcome.Condition.builder().observed(Observed.MET).build();
        }
    }

    /** key supplied per instance so two instances of this one class can carry distinct keys. */
    static final class KeyedConditionHandler implements ConditionCheckHandler {
        private final String key;

        KeyedConditionHandler(String key) {
            this.key = key;
        }

        @Override
        public String key() {
            return key;
        }

        @Override
        public ConditionCheckOutcome check(ConditionCheckContext ctx) {
            return ConditionCheckOutcome.Condition.builder().observed(Observed.MET).build();
        }
    }

    /** Registered nowhere — used to prove the unknown-class path. */
    static final class UnregisteredHandler implements ConditionCheckHandler {
        @Override
        public String key() {
            return "fake.unregistered";
        }

        @Override
        public ConditionCheckOutcome check(ConditionCheckContext ctx) {
            return ConditionCheckOutcome.Condition.builder().observed(Observed.NOT_MET).build();
        }
    }
}
