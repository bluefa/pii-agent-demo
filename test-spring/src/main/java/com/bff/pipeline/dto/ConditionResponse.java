package com.bff.pipeline.dto;

import lombok.Builder;
import lombok.Getter;

/** IM condition probe response (the "general" non-terraform call). */
@Getter
@Builder
public class ConditionResponse {

    private final boolean met;
}
