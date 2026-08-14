package com.example.lineage;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * Slim projection of an OpenLineage RunEvent. Only the fields this service
 * consumes are declared; everything else is ignored so provider upgrades
 * that add or reshape facets do not break deserialization.
 *
 * NOTE: facet paths (airflowDagRun.dagRun.*) depend on the
 * apache-airflow-providers-openlineage version. Verify against a payload
 * captured from the actual Composer environment before deploying.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LineageEvent(String eventType, OffsetDateTime eventTime, Run run, Job job) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Job(String namespace, String name) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Run(String runId, RunFacets facets) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RunFacets(AirflowDagRun airflowDagRun, NominalTime nominalTime) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AirflowDagRun(DagRun dagRun) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DagRun(
            @JsonProperty("logical_date") OffsetDateTime logicalDate,
            @JsonProperty("run_type") String runType) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record NominalTime(OffsetDateTime nominalStartTime) {}

    /** logical_date with a fallback to nominalTime for provider variants. */
    public OffsetDateTime resolveLogicalDate() {
        if (run == null || run.facets() == null) {
            return null;
        }
        AirflowDagRun adr = run.facets().airflowDagRun();
        if (adr != null && adr.dagRun() != null && adr.dagRun().logicalDate() != null) {
            return adr.dagRun().logicalDate();
        }
        NominalTime nominal = run.facets().nominalTime();
        return nominal != null ? nominal.nominalStartTime() : null;
    }

    public String resolveRunType() {
        if (run == null || run.facets() == null || run.facets().airflowDagRun() == null
                || run.facets().airflowDagRun().dagRun() == null) {
            return null;
        }
        return run.facets().airflowDagRun().dagRun().runType();
    }
}
