# v16 Interaction Scenarios — Target-Source Detail (screen-4)

Authority: `design/SIT Prototype Athena v16.html` (JS at HTML ~9100–9700). Maps every actionable
element → behavior, so implementation reproduces the flow and review can check it. Cross-checked
against the per-provider audits. `scenario-map` agent refines the per-element detail.

**Logic rule (locked / ADR):** in the impl, a "step transition" = **process-status refetch**, not a
raw `setStep`. The v16 prototype's `setStep(n)` is prototype navigation; the impl advances by
action → mock mutates processStatus → `getProject` refetch re-renders the matching step component.
The UI consumes the **domain** model; wire→domain happens in the adapter (`app/lib/api/**`).

## Per-step actionable elements

### Step 1 — 연동 대상 선택 (WAITING_TARGET_CONFIRMATION)
| element | provider | behavior |
|---|---|---|
| candidate row checkbox (check) | cloud | select resource; VM/EC2 rows expand endpoint-config panel |
| candidate row checkbox (UNcheck) | cloud | **open exclusion-reason popover** (preset reasons) → optional custom modal → store reason; row → 비대상 + reason chip |
| 연동 대상 승인 요청 | cloud/idc | validate (≥1 selected, configs done) → open **submit-approval modal** (3-stat) → 요청하기 → createApprovalRequest → refetch → step2 |
| IDC: 대상 추가/수정 | idc | open IdcTargetFormModal (IP/Domain · Port · DB Type · Source IP · credential) → save |
| Run Infra Scan | cloud | re-scan candidates |

### Step 2 — 승인 대기 (WAITING_APPROVAL)
| element | behavior |
|---|---|
| 전체 취소 | cancel approval request → refetch → back to step1 |
| (advance) | polling: ProcessStatusCard polls; on APPROVED → APPLYING_APPROVED → step3 |

### Step 3 — 반영중 (APPLYING_APPROVED)
| element | behavior |
|---|---|
| (advance) | **polling** (ProcessStatusCard, APPLYING_APPROVED) → INSTALLING → step4. No Next button (v16 prototype Next = nav only). |
| toolbar 연동 상태 filter | filter rows by Integrated/Pending/제외 (v16 has it; impl currently missing) |

### Step 4 — 설치 (INSTALLING)
| element | provider | behavior |
|---|---|---|
| 자동/수동 mode toggle (aws-mode-bar) | **aws** | switch AUTO ↔ MANUAL install layout (MISSING in impl — mount AwsInstallationModeSelector) |
| terraform download | aws MANUAL | download TF bundle (sync tab to avoid popup-block) |
| install task pipeline | all | shows per-task PENDING→IN_PROGRESS→DONE |
| (advance) | all | install complete → WAITING_CONNECTION_TEST → step5 |
| VPC Endpoint 상태 table | aws | resource table below cards (MISSING in impl) |

### Step 5 — 연결 테스트 (WAITING_CONNECTION_TEST) — **biggest rebuild**
| element | behavior |
|---|---|
| Run Test (header, `runConnTest`) | run connection test → progress bar fills, per-row Connection Status PENDING→Success/Fail, counts (성공·실패·대기) + % update |
| DB Credential `<select>` (per row) | pick credential (자격 증명 선택 / Key1…); on change re-evaluate gating |
| 논리 DB 확인 "설정" (per row, `openLogicalModal`) | open **logical-DB modal** (discovered ⊥ deny datasets) → stage add/remove → save |
| **완료 승인 요청** (`openReqApproval`) | **GATED**: enabled only when ALL Connection Status = Success AND 논리 DB 확인 done. → opens **req-approval modal** |
| req-approval modal → 요청하기 (`submitReqApproval`) | submit completion approval → (impl: action → refetch) → step6. Modal: 3-stat (전체 리소스 / 연동 논리 DB / 제외한 논리 DB) + summary table [DB Type, Resource Name, Region, 논리 DB 개수▸, 제외한 논리 DB▸] + pagination |
| IDC variant | `openIdcReqApproval` → #idcReqApprovalModal (3-stat 전체 연동 대상/연결 성공/연결 대기 + table [구분, 연동 대상, Port, DB Type, 상태] + iraWarn when blocked); iraSubmitBtn gated |

### Step 6 — 운영(검증 대기) (CONNECTION_VERIFIED)
| element | behavior |
|---|---|
| 연결 테스트 재실행 (`openConfirmStep('retest')`) | **open confirm-rewind modal** (#confirmStepModal) → confirm → back to step5, later state reset (impl currently a 준비중 toast stub — task B) |
| DB Credential column | idc/cloud read-only table shows credential (🔑 idc_svc_* / —) + `자격 증명 필요` conn state |

### Step 7 — 운영 (INSTALLATION_COMPLETE)
| element | behavior |
|---|---|
| 인프라 변경 | open infra-change flow |
| 연결 테스트 재실행 (`openConfirmStep('retest')`) | confirm-rewind modal → step5 |
| Healthy/Unhealthy | per-row health dot + Status tooltip |

## Modals (id → trigger → content → primary action → result)

| modal | trigger | primary action → result |
|---|---|---|
| submit-approval (3-stat) | step1 연동 대상 승인 요청 | 요청하기 → createApprovalRequest → step2 |
| exclusion-reason popover/modal | step1 uncheck candidate | pick/enter reason → row 비대상 |
| **req-approval** `#reqApprovalModal` (cloud) | step5 완료 승인 요청 | 요청하기 (`submitReqApproval`) → step6 |
| **idc-req-approval** `#idcReqApprovalModal` | step5 idc 완료 승인 요청 | 요청하기 (`submitIdcReqApproval`, gated by iraWarn) → step6 |
| logical-DB `#logicalModal` | step5/6/7 논리 DB 확인/관리 "설정" | save staged add/remove → table 논리 DB counts update |
| **confirm-rewind** `#confirmStepModal` | step6/7 연결 테스트 재실행 | confirm → step5 (reset later state) |
| credential modal | step5 credential register | save encrypted credential |

## Gating rules (button enabled iff …)

- step1 연동 대상 승인 요청: ≥1 selected AND all VM/endpoint configs complete.
- step5 완료 승인 요청 (cloud): ALL rows Connection Status = Success AND all 논리 DB 확인 done.
- step5 idc 완료 승인 요청: all targets have a credential AND all connections Success (else `iraWarn` shows, submit disabled).
- step6/7 재실행: always available; opens confirm-rewind (destructive → confirm required).

---
**Status:** DRAFT (from audits + v16 JS reading). `scenario-map` agent to refine per-element detail +
cite v16 line numbers; then Codex + opus review to unanimous before Phase D.
