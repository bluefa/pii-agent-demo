package com.bff.pipeline.ops;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A global runtime setting (R5 — "settings are data"). Key/value; edited via the settings API and read at
 * runtime (no redeploy). Per-task duration knobs are NOT here — they are frozen on the task row at creation.
 */
@Entity
@Table(name = "setting")
@Getter
@Setter
@NoArgsConstructor
public class Setting {

    @Id
    @Column(name = "setting_key")
    private String key;

    @Column(name = "setting_value", nullable = false)
    private String value;
}
