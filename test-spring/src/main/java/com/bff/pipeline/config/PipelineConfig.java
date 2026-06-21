package com.bff.pipeline.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Wiring. A {@link Clock} bean makes the reconciler's time deterministic — tests inject a fixed clock.
 */
@Configuration
@EnableConfigurationProperties(PipelineSettings.class)
public class PipelineConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
