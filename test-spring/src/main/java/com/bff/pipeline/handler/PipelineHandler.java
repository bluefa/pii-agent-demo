package com.bff.pipeline.handler;

import com.bff.pipeline.domain.TaskKind;

/**
 * A task's code class. Declares a stable {@link #key()} (independent of the class name — rename-safe;
 * single source of the key string) and its {@link #kind()}. Recipes reference handlers by class
 * (compile-time safe); the stored {@code task.handler_key} is derived from {@code key()}.
 *
 * <p>Non-compatible behavior changes are managed append-only as {@code _V1/_V2} (a new handler with a
 * new key), so old snapshots always resolve.
 */
public interface PipelineHandler {

    /** stable identifier, e.g. {@code "aws.tf.network"}. */
    String key();

    TaskKind kind();
}
