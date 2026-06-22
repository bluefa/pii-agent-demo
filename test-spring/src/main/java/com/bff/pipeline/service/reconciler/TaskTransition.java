package com.bff.pipeline.service.reconciler;

import com.bff.pipeline.type.Severity;
import lombok.Builder;
import lombok.Getter;

/**
 * What a task transition emits to the outbox: the event {@code type} (e.g. {@code TASK:DONE}) and its
 * {@link Severity}. The owning pipeline/task are the subject the tick already holds; this bundles only
 * what the transition itself carries.
 */
@Getter
@Builder
class TaskTransition {

    private final String type;
    private final Severity severity;
}
