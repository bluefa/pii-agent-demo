package com.bff.pipeline;
import com.bff.pipeline.service.reconciler.ReconcileTickScheduler;

import com.bff.pipeline.dto.PipelineDetail;
import com.bff.pipeline.service.PipelineQueryService;
import com.bff.pipeline.type.Actor;
import com.bff.pipeline.type.PipelineStatus;
import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.service.PipelineAlertService;
import com.bff.pipeline.config.PipelineEngineSettings;
import com.bff.pipeline.service.PipelineAlertNotifier;
import com.bff.pipeline.service.reconciler.ReconcileLeader;
import com.bff.pipeline.service.reconciler.PipelineReconciler;
import com.bff.pipeline.dto.PipelineCreationRequest;
import com.bff.pipeline.dto.PipelineCreationResult;
import com.bff.pipeline.service.external.ExternalCallLauncher;
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
        // one ReconcileLeader (SingleNodeReconcileLeader in the default profile), the tick, the call-thread, runtime settings,
        // alerts, and the scheduler all resolve — proving T1–T7 compose.
        assertThat(context.getBean(PipelineReconciler.class)).isNotNull();
        assertThat(context.getBean(ExternalCallLauncher.class)).isNotNull();
        assertThat(context.getBean(PipelineEngineSettings.class)).isNotNull();
        assertThat(context.getBean(PipelineAlertService.class)).isNotNull();
        assertThat(context.getBean(PipelineAlertNotifier.class)).isNotNull();
        assertThat(context.getBean(ReconcileTickScheduler.class)).isNotNull();
        assertThat(context.getBean(ReconcileLeader.class).isLeader()).isTrue();
    }

    @Test
    void createResolvesTheRealAwsRecipeAndIsQueryable() {
        PipelineCreationResult result = creationService.create(PipelineCreationRequest.builder()
                .type(PipelineType.INSTALL).provider("AWS").targetSourceId("ts-integration-1").triggeredBy(Actor.HUMAN).build());

        assertThat(result.isCreated()).isTrue();
        PipelineDetail detail = queryService.detail(result.getPipeline().getId());
        assertThat(detail.getStatus()).isEqualTo(PipelineStatus.RUNNING);
        assertThat(detail.getTasks()).hasSize(2); // DefaultRecipes INSTALL/AWS: TF apply-network → CONDITION ready
        assertThat(detail.getTasks().get(0).getHandlerKey()).isEqualTo("aws.tf.network");
        assertThat(detail.getTasks().get(1).getHandlerKey()).isEqualTo("aws.cond.network-ready");
    }
}
