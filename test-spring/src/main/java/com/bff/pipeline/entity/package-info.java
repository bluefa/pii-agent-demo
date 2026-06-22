/**
 * JPA {@code @Entity} classes.
 *
 * <p>Non-null by default (Stage D): every parameter, field, and return is {@code @NonNull}
 * unless explicitly marked {@link org.springframework.lang.Nullable}. Optional columns
 * (those without {@code @Column(nullable=false)}) are individually {@code @Nullable}.
 */
@org.springframework.lang.NonNullApi
@org.springframework.lang.NonNullFields
package com.bff.pipeline.entity;
