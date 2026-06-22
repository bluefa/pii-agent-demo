package com.bff.pipeline.service.recipe;
import com.bff.pipeline.dto.PipelineDefinition;
import com.bff.pipeline.dto.TaskDefinition;

import com.bff.pipeline.type.PipelineType;
import com.bff.pipeline.service.handler.example.AwsTfNetworkHandler;
import com.bff.pipeline.service.handler.example.NetworkReadyCheckHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Code-default recipes (Decision 7.4): one release per (type, provider). Registering these as beans makes
 * {@link RecipeRegistry} boot-assert that every referenced handler class is registered and its kind
 * matches — the example INSTALL/AWS chain is a TERRAFORM_JOB (apply) then a CONDITION_CHECK (ready).
 */
@Configuration
public class DefaultRecipes {

    @Bean
    public PipelineDefinition awsInstallRecipe() {
        return PipelineDefinition.builder()
                .definitionKey("install/aws")
                .version("v1")
                .type(PipelineType.INSTALL)
                .provider("AWS")
                .tasks(List.of(
                        TaskDefinition.terraformJob("apply network", AwsTfNetworkHandler.class),
                        TaskDefinition.conditionCheck("network ready", NetworkReadyCheckHandler.class)
                ))
                .build();
    }
}
