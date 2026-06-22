# test-spring — code style & restructure conventions

Shared spec for restructuring the ADR-016 V1 reference impl to the production
`SelfInstallationApplication` house style. Every stage and every delegated agent
follows this. Behavior is preserved — the test suite is the contract.

## 1. Package layout (production parity)

Top-level packages under `com.bff.pipeline`:

| package | holds |
|---------|-------|
| `config` | Spring `@Configuration` beans **and** the documented `@Value` global settings class |
| `client` | Feign clients + IM transport translation |
| `dto` | immutable value objects / API views / call outcomes / contexts (Builder classes) |
| `entity` | JPA `@Entity` classes |
| `type` | enums |
| `exception` | `Throwable` subclasses + fault value types |
| `repository` | Spring Data repositories |
| `service` | all services, hierarchical (see below) |

`service` sub-packages (cohesion — confirmed direction):

- `service` (top) — pipeline lifecycle services: creation, query, control, status derivation, event recording, alerting, settings access
- `service.handler` — pipeline task handlers (TERRAFORM_JOB / CONDITION_CHECK strategies) + registry + examples
- `service.reconciler` — the tick engine: reconciler, task-state advancer, retention pruner, tick budget, leader election, scheduler
- `service.external` — fire-and-forget external-call launch + observation writer + per-call deadline runner

**Skipped on purpose** (YAGNI — engine-only V1, no HTTP layer): `controller`,
`advice`, `filter`. `constants` / `util` are created only if real content exists.
No empty directories.

## 2. No records — Builder classes

- **No `record`.** Every former record becomes an immutable class with Lombok
  `@Getter @Builder`. Add `@EqualsAndHashCode`/`@ToString` only where value
  equality or readable logging is actually relied on (e.g. test assertions).
- **Accessors are `getX()` / `isX()`** (boolean) — matches the existing entity
  convention, so the whole codebase reads one way. Fluent `x()` accessors are gone.
- **Construction is via `.builder()...build()`.** Direct constructor calls
  (`new X(...)`) are minimized to: JPA entities (Hibernate needs a no-arg ctor +
  setters — entities are NOT builderized), Spring beans (DI constructs them), and
  exceptions. Everything value-shaped is built.
- Sealed interfaces (`*Outcome`, `ImFault`) keep their algebra: cases become
  `final class ... implements X` with `@Getter @Builder`. Pattern matching
  (`case Accepted a -> a.getHandle()`) still works on classes.

## 3. Null-safety (zero NPE)

- Annotate every parameter, field, and return that can be null with
  `@Nullable`; everything else is `@NonNull` (package-level `@NonNullApi` where it
  reads cleaner). Use `org.springframework.lang.NonNull/@Nullable`.
- No raw deref of a nullable. Repository lookups return `Optional` and are
  consumed with `.map/.orElse/.orElseThrow` — never `.get()` on an unchecked
  Optional.
- Builder-built value objects validate required fields (Lombok builder leaves
  them null otherwise) — guard required fields at the boundary they enter the
  engine, not deep inside.
- A nullable that reaches a branch is handled explicitly; a "can't happen" null
  throws `IllegalStateException` with context, never silently NPEs.

## 4. Settings → `@Value` global config

- Drop the DB-backed `Setting` entity / `SettingRepository` / `SettingsService`
  (runtime PUT) / `RuntimeSettings` (DB overlay) / `PipelineSettings`
  (`@ConfigurationProperties`).
- One documented global config component in `config` injects every knob with
  `@Value("${pipeline.*}")` from `application.yml`. Each field carries a javadoc
  line explaining the knob (cadence, timeout, budget, retention).
- **ADR divergence (intentional, "우선은"):** settings move from runtime-tunable
  (DB, no redeploy) to deploy-time (yaml). The per-task freeze semantics are
  unchanged (knobs still frozen onto the task row at creation).

## 5. Intent-revealing, system-specific names

No generic names. A class/method name states what it does **in this pipeline
system**. Rename map (engine + value types; views in `dto` keep clear names):

| current | renamed |
|---------|---------|
| `Reconciler` | `PipelineReconciler` |
| `TaskAdvancer` | `PipelineTaskAdvancer` |
| `TaskCheckPruner` | `TaskCheckRetentionPruner` |
| `TickBudget` | `ExternalCallTickBudget` |
| `PipelineDeriver` | `PipelineStatusDeriver` |
| `PipelineScheduler` | `ReconcileTickScheduler` |
| `ExternalCalls` | `ExternalCallLauncher` |
| `ExternalCallExecutor` / `VirtualThreadExternalCallExecutor` | kept — already specific, renaming is churn |
| `ObservationWriter` | `TaskCheckObservationWriter` |
| `NewRunWriter` | `PipelineRunWriter` (writes a new pipeline run: pipeline + tasks + snapshot + event) |
| `EventRecorder` | `PipelineEventRecorder` |
| `AlertService` | `PipelineAlertService` |
| `Notifier` | `PipelineAlertNotifier` |
| `Leader` | `ReconcileLeader` |
| `SingleNodeLeader` | `SingleNodeReconcileLeader` |
| `PostgresAdvisoryLockLeader` | `PostgresAdvisoryLockReconcileLeader` |
| `HandlerRegistry` | `PipelineHandlerRegistry` |
| `Observation` | `TaskCheckObservation` |
| `CallOutcome` | `ExternalCallOutcome` |
| `CreationRequest` / `CreationResult` | `PipelineCreationRequest` / `PipelineCreationResult` |
| `DispatchOutcome` / `PollOutcome` / `CheckOutcome` | `TerraformDispatchOutcome` / `TerraformPollOutcome` / `ConditionCheckOutcome` |
| `DispatchContext` / `PollContext` / `CheckContext` | `TerraformDispatchContext` / `TerraformPollContext` / `ConditionCheckContext` |

Methods: intent in the verb + system noun (`advanceDispatching` →
`advanceDispatchingTaskFromObservation`, etc., applied where the current name is
under-specified — not blanket renaming).

## 6. Single-responsibility methods

One method = one reason to change. Extract distinct business steps (a guard, a
classification, a schedule write, a transition) into named private methods whose
name states the step. Readability is the priority on this hard state machine —
prefer a few extra well-named methods over one dense block.

## 7. Method signatures — at most 3 parameters

Every method takes **3 parameters or fewer**. Collapse a longer signature with a
Builder-built parameter object (a `dto` value class), never a positional blob.
Bundle the values that travel together — e.g. the fire-and-forget call path
(`taskId`, `attemptId`, `handle`, `name`, ...) becomes one command object built
via `.builder()`. When the object crosses the async boundary it holds scalars,
never a detached entity (§3 / D-T4 discipline). Methods already at ≤3 params are
left alone; constructors of Spring beans (DI-injected) are exempt.

## 8. Prefer Stream over for-loops

Prefer the Stream API to an imperative `for`/`for-each` wherever it reads more
clearly (map / filter / collect / reduce / findFirst / anyMatch). Keep a loop
only where a stream would be contorted — an index combined with side-effecting
writes (use `IntStream.range(...)` if the index is genuinely needed), an early
`break`/`return` with non-trivial state, or a measured hot path. Never force a
side-effecting `forEach` where a plain loop is clearer; mark a deliberately-kept
loop with a one-line reason.
