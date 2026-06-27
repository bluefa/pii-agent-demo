package com.bff.pipeline.im;

/**
 * The result of polling a TERRAFORM_JOB (an IM transport value, not a persisted domain state — the persisted
 * outcome is {@code TaskStatus} + {@code ErrorCode}). {@code finished} distinguishes a still-running job from a
 * terminal one; on a finished job {@code succeeded} distinguishes SUCCEEDED from FAILED.
 */
public record TerraformPoll(boolean finished, boolean succeeded) {

    public static TerraformPoll running() {
        return new TerraformPoll(false, false);
    }

    public static TerraformPoll success() {
        return new TerraformPoll(true, true);
    }

    public static TerraformPoll failure() {
        return new TerraformPoll(true, false);
    }
}
