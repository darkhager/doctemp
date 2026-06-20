# Doc Template Studio — Company Policy

**Version:** 1.0  
**Effective:** 2026-06-12  
**Owner:** Engineering Lead  
**Review cycle:** Every 6 months or after any major incident

---

## 1. Mission & Vision

**Mission:**  
Provide a fully offline, self-hosted document template platform that any organisation can operate without dependency on cloud services, third-party APIs, or internet connectivity.

**Vision:**  
Every document workflow — from template authoring to final export — should be deterministic, reviewable, and auditable within a single local environment.

**Core Principles:**
1. **Offline-first** — No feature may require an external network call.
2. **Quality-gated** — No output leaves the system without passing the Reviewer tier.
3. **Single responsibility** — Each agent owns one domain; it does not reach into another agent's domain directly.
4. **Transparency** — All warnings and review findings are surfaced to the caller, never silently swallowed.
5. **Portability** — The entire stack must run with `docker compose up` on any machine that has Docker installed.

---

## 2. Organisational Structure

```
┌─────────────────────────────────────────────────────────────┐
│  API Layer  (main.py)                                       │
│  Entry point for all HTTP requests. Delegates to Manager.  │
└────────────────────────┬────────────────────────────────────┘
                         │
             ┌───────────▼────────────┐
             │     MANAGER TIER       │
             │     ManagerAgent       │
             │                        │
             │  Owns multi-step       │
             │  workflow pipelines.   │
             │  Enforces the Reviewer │
             │  gate on all outputs.  │
             └──────┬──────────┬──────┘
                    │          │
           delegates         enforces
           to workers        review gate
                    │          │
       ┌────────────▼──┐  ┌────▼──────────────┐
       │  WORKER TIER  │  │  REVIEWER TIER    │
       │               │  │  ReviewerAgent    │
       │ TemplateAgent │  │                   │
       │ ConversionAgent│  │ Validates all     │
       │ RenderAgent   │  │ inputs/outputs    │
       │ StorageAgent  │  │ before they are   │
       └───────────────┘  │ committed or sent.│
                          └───────────────────┘
```

### Tier definitions

| Tier | Role | Can it write to DB? | Can it call other agents? |
|---|---|---|---|
| API Layer | HTTP gateway only | No | Only Manager |
| Manager | Pipeline orchestration | No (delegates to workers) | Yes — all workers + Reviewer |
| Reviewer | Quality gate | No | No |
| Worker | Domain execution | Yes (own domain only) | No — workers never call each other |

> **Key rule:** Workers do NOT call each other. Cross-worker coordination is always routed through the Manager.

---

## 3. Development Teams

| Team | Code Name | Scope |
|---|---|---|
| Team Alpha | Core Engine | Backend API routes, TemplateAgent, ConversionAgent, RenderAgent |
| Team Beta | Editor Experience | Frontend React app, TipTap editor, FillForm, TemplateLibrary |
| Team Gamma | Data & Storage | SQLite schema, StorageAgent, file I/O, migrations |
| Team Delta | DevOps & Packaging | Dockerfile, docker-compose, install.sh, CI, port config |

Each team owns the files listed in their team charter (`docs/teams/team_*.md`).  
Each individual agent role is documented in `docs/roles/*.md`.

---

## 4. Code Standards

### 4.1 Language & Style

- **Python (backend):** PEP 8. Type hints on all function signatures. No `Any` return types except where unavoidable.
- **TypeScript (frontend):** Strict mode enabled. No `as any` casts. All component props typed.
- Line length: 100 characters.
- No `print()` statements in production code; use Python's `logging` module if needed.

### 4.2 Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Python classes | PascalCase | `TemplateAgent` |
| Python functions/vars | snake_case | `detect_fields` |
| TypeScript components | PascalCase | `EditorPage` |
| TypeScript functions/vars | camelCase | `handleSave` |
| API routes | kebab-case nouns | `/api/templates/import-docx` |
| Database columns | snake_case | `fields_json`, `created_at` |
| Template placeholders | snake_case inside `{{}}` | `{{client_name}}` |

### 4.3 File Ownership

No agent file may be modified by a team that does not own it without a cross-team review. See section 6.

---

## 5. Review Policy

### 5.1 In-App Review Gate (Runtime)

Every output that leaves the system must pass the **ReviewerAgent** gate. This is not optional and not configurable.

| Event | Review check performed |
|---|---|
| Template saved (create or update) | `review_template(name, html, fields)` |
| Template exported | `review_filled_html()` + `review_export_bytes()` |
| DOCX imported | `review_template()` on converted output |

If `ReviewResult.passed == False`, the Manager raises `ValueError` and the API returns HTTP 422. The error detail is always returned to the caller — it is never silently dropped.

If `ReviewResult.warnings` is non-empty, the warnings are included in the response message. The operation proceeds.

### 5.2 Code Review (Development)

- All changes require at least one peer review before merging.
- Changes to `reviewer_agent.py` or `manager_agent.py` require review by the Engineering Lead.
- Changes to database schema (`models.py`) require review by Team Gamma lead.
- Frontend changes that touch API contracts must be reviewed together with the backend change.

### 5.3 Review Checklist

```
[ ] Does this change add, modify, or remove a ReviewerAgent check?
[ ] Are all new agent methods type-hinted?
[ ] Does any worker now call another worker directly? (disallowed)
[ ] Are new routes gated through the Manager?
[ ] Are new fields in models.py reflected in schemas.py and the frontend types?
[ ] Does the DOCX/PDF output still pass review_export_bytes()?
```

---

## 6. Change Management

### 6.1 Ownership Matrix

| File / Directory | Owning Team | Cross-team approval needed? |
|---|---|---|
| `backend/agents/manager_agent.py` | Alpha | Engineering Lead |
| `backend/agents/reviewer_agent.py` | Alpha | Engineering Lead |
| `backend/agents/template_agent.py` | Alpha | No |
| `backend/agents/conversion_agent.py` | Alpha | No |
| `backend/agents/render_agent.py` | Alpha | No |
| `backend/agents/storage_agent.py` | Gamma | No |
| `backend/models.py` | Gamma | Gamma Lead |
| `backend/schemas.py` | Alpha | If API contract changes |
| `backend/main.py` | Alpha | If new routes added |
| `frontend/src/` | Beta | If API contract changes |
| `docker/`, `docker-compose.yml`, `install.sh` | Delta | No |

### 6.2 Breaking Changes

A change is **breaking** if it:
- Removes or renames an existing API route.
- Changes the shape of `fields_json` in the database.
- Changes the ReviewerAgent's pass/fail logic for a previously-passing case.
- Changes how `{{placeholder}}` syntax is detected or filled.

Breaking changes require a version bump in `main.py`'s `version=` field and an entry in `CHANGELOG.md`.

---

## 7. Deployment Policy

### 7.1 Environments

| Environment | How to start | Port | Database |
|---|---|---|---|
| Production (Docker) | `docker compose up --build` | 8000 | `./data/templates.sqlite` (persisted volume) |
| Bare Linux | `./install.sh` | 8000 | `backend/data/templates.sqlite` |
| Development | `uvicorn main:app --reload` + `npm run dev` | 8000 / 5173 | `backend/data/templates.sqlite` |

### 7.2 Data Persistence

- The SQLite file at `./data/templates.sqlite` is the single source of truth.
- In Docker, `./data/` is mounted as a named volume. Never delete this directory in production without a backup.
- `./uploads/` and `./exports/` are ephemeral working directories. Files there are not required for disaster recovery.

### 7.3 No External Calls Policy

No code path — agent, route, or utility — may make an HTTP request to any external host. This is enforced by operating the app in a network-isolated environment. Any PR introducing `requests`, `httpx`, `urllib`, or similar outbound calls must be rejected unless explicitly approved for a future optional integration module.

---

## 8. Incident Response

| Severity | Definition | Response time | Owner |
|---|---|---|---|
| P1 | App will not start; data loss risk | Immediate | Engineering Lead |
| P2 | Export or import completely broken | Within 4 hours | Team Alpha Lead |
| P3 | A review check produces a false positive/negative | Within 1 business day | Reviewer owner |
| P4 | UI bug, cosmetic issue | Next sprint | Team Beta |

### Incident runbook (P1/P2)
1. Capture the full stack trace from uvicorn logs.
2. Reproduce against the last known-good commit.
3. If SQLite is corrupt, restore from last backup before debugging.
4. Do not modify `reviewer_agent.py` as a workaround during an incident.

---

## 9. Testing Policy

- All new agent methods must have at least one unit test in `backend/tests/test_api.py`.
- Tests use in-memory SQLite via `app.dependency_overrides[get_db]`. No production database is touched by tests.
- `pytest tests/ -v` must pass with zero failures before any merge.
- Minimum coverage targets:
  - `reviewer_agent.py`: 100% branch coverage
  - `manager_agent.py`: 80% branch coverage
  - Worker agents: 60% branch coverage

---

## 10. Documentation Policy

- Every agent class has exactly one doc file in `docs/roles/`.
- Every team has exactly one charter in `docs/teams/`.
- When a new public method is added to an agent, its role doc must be updated in the same PR.
- `COMPANY_POLICY.md` (this file) is updated by the Engineering Lead only.

---

## 11. Glossary

| Term | Definition |
|---|---|
| Agent | A Python class that owns one domain of the system. |
| Manager tier | The orchestration layer that coordinates multi-step pipelines. |
| Reviewer tier | The quality-gate layer that validates inputs/outputs before commit or delivery. |
| Worker tier | Domain-specific execution agents (Template, Conversion, Render, Storage). |
| Placeholder | A `{{variable_name}}` token inside template HTML that is substituted at fill time. |
| Review gate | A mandatory call to ReviewerAgent that must pass before the workflow continues. |
| Field | A declared input variable in a template, stored in `fields_json`. |
| Export | The act of filling a template with data and producing a `.docx` or `.pdf` file. |
| Import | The act of parsing an uploaded `.docx` and creating a template from it. |
