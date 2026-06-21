package com.bff.pipeline;

import com.bff.pipeline.api.PipelineDetail;
import com.bff.pipeline.api.PipelineQueryService;
import com.bff.pipeline.domain.Actor;
import com.bff.pipeline.domain.PipelineStatus;
import com.bff.pipeline.domain.PipelineType;
import com.bff.pipeline.ops.AlertService;
import com.bff.pipeline.ops.Notifier;
import com.bff.pipeline.ops.RuntimeSettings;
import com.bff.pipeline.reconciler.Leader;
import com.bff.pipeline.reconciler.Reconciler;
import com.bff.pipeline.service.CreationRequest;
import com.bff.pipeline.service.CreationResult;
import com.bff.pipeline.service.ExternalCalls;
import com.bff.pipeline.service.PipelineCreationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Full-context integration (Todo T7): the entire ADR-016 V1 application boots — every bean from T1–T6 plus
 * the scheduler and the Feign transport wire together — over H2, and a real creation flows through the real
 * DefaultRecipes / handler registry to the query surface. The IM Feign transport is wired (a lazy proxy) but
 * never called: the scheduler's initial delay is pushed out so the tick — hence dispatch — never fires, and
 * the create/query flow itself makes no IM call, so the background loops stay quiet during the assertions.
 */
@SpringBootTest(properties = {
        "im.base-url=http://localhost:0",
        "spring.datasource.url=jdbc:h2:mem:integ;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "pipeline.scheduler.initial-delay-ms=600000",
        "pipeline.scheduler.tick-ms=600000",
        "pipeline.scheduler.alert-ms=600000",
        "pipeline.scheduler.notify-ms=600000"
})
class IntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private PipelineCreationService creationService;
    @Autowired private PipelineQueryService queryService;

    @Test
    void theFullApplicationContextWiresEveryComponent() {
        // one Leader (SingleNodeLeader in the default profile), the tick, the call-thread, runtime settings,
        // alerts, and the scheduler all resolve — proving T1–T7 compose.
        assertThat(context.getBean(Reconciler.class)).isNotNull();
        assertThat(context.getBean(ExternalCalls.class)).isNotNull();
        assertThat(context.getBean(RuntimeSettings.class)).isNotNull();
        assertThat(context.getBean(AlertService.class)).isNotNull();
        assertThat(context.getBean(Notifier.class)).isNotNull();
        assertThat(context.getBean(PipelineScheduler.class)).isNotNull();
        assertThat(context.getBean(Leader.class).isLeader()).isTrue();
    }

    @Test
    void createResolvesTheRealAwsRecipeAndIsQueryable() {
        CreationResult result = creationService.create(
                new CreationRequest(PipelineType.INSTALL, "AWS", "ts-integration-1", Actor.HUMAN));

        assertThat(result.created()).isTrue();
        PipelineDetail detail = queryService.detail(result.pipeline().getId());
        assertThat(detail.status()).isEqualTo(PipelineStatus.RUNNING);
        assertThat(detail.tasks()).hasSize(2); // DefaultRecipes INSTALL/AWS: TF apply-network → CONDITION ready
        assertThat(detail.tasks().get(0).handlerKey()).isEqualTo("aws.tf.network");
        assertThat(detail.tasks().get(1).handlerKey()).isEqualTo("aws.cond.network-ready");
    }
}
