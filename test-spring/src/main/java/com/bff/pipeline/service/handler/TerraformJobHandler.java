package com.bff.pipeline.service.handler;
import com.bff.pipeline.dto.TerraformDispatchContext;
import com.bff.pipeline.dto.TerraformDispatchOutcome;
import com.bff.pipeline.dto.TerraformPollContext;
import com.bff.pipeline.dto.TerraformPollOutcome;

import com.bff.pipeline.type.TaskKind;

/**
 * A TERRAFORM_JOB handler: dispatch (side-effect, must be idempotent) then poll the returned handle to
 * terminal. Idempotency is a registration contract (O28): duplicate submits must be harmless and
 * "already-in-desired-state" must be success (INSTALL exists = success, DELETE not-found = success).
 */
public interface TerraformJobHandler extends PipelineHandler {

    @Override
    default TaskKind kind() {
        return TaskKind.TERRAFORM_JOB;
    }

    /** idempotent dispatch; returns the handle (job_id) on Accepted. */
    TerraformDispatchOutcome dispatch(TerraformDispatchContext ctx);

    /** read the job's status (read-only). */
    TerraformPollOutcome poll(TerraformPollContext ctx);
}
