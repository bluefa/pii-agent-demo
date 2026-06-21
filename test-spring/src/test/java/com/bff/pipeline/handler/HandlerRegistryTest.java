package com.bff.pipeline.handler;

import com.bff.pipeline.domain.Observed;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Class-index resolution of {@link HandlerRegistry} (the recipe class-ref path). Uses named static fake
 * handlers so {@code getClass()} is stable across the test (an anonymous/lambda handler would have an
 * unstable synthetic class). No Spring context — the registry is a plain constructor-injected component.
 */
class HandlerRegistryTest {

    private final FakeTerraformHandler terraform = new FakeTerraformHandler();
    private final FakeConditionHandler condition = new FakeConditionHandler();
    private final HandlerRegistry registry = new HandlerRegistry(List.of(terraform, condition));

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
        assertThatThrownBy(() -> new HandlerRegistry(
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
        public DispatchOutcome dispatch(DispatchContext ctx) {
            return new DispatchOutcome.Accepted("job-1");
        }

        @Override
        public PollOutcome poll(PollContext ctx) {
            return new PollOutcome.Status(Observed.SUCCEEDED);
        }
    }

    static final class FakeConditionHandler implements ConditionCheckHandler {
        @Override
        public String key() {
            return "fake.cond";
        }

        @Override
        public CheckOutcome check(CheckContext ctx) {
            return new CheckOutcome.Condition(Observed.MET);
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
        public CheckOutcome check(CheckContext ctx) {
            return new CheckOutcome.Condition(Observed.MET);
        }
    }

    /** Registered nowhere — used to prove the unknown-class path. */
    static final class UnregisteredHandler implements ConditionCheckHandler {
        @Override
        public String key() {
            return "fake.unregistered";
        }

        @Override
        public CheckOutcome check(CheckContext ctx) {
            return new CheckOutcome.Condition(Observed.NOT_MET);
        }
    }
}
