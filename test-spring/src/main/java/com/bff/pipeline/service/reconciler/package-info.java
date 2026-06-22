/**
 * The tick engine: reconciler, task-state advancer, retention pruner, tick budget, leader
 * election, and scheduler.
 *
 * <p>Non-null by default (Stage D): every parameter, field, and return is {@code @NonNull}
 * unless explicitly marked {@link org.springframework.lang.Nullable}.
 */
@org.springframework.lang.NonNullApi
@org.springframework.lang.NonNullFields
package com.bff.pipeline.service.reconciler;
