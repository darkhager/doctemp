# THE BIBLE — Doc Template Studio

> The single source of truth. Every contributor and every agent — human or AI — follows
> this document. When in doubt, this file wins. Deeper detail lives in [`docs/`](docs/INDEX.md);
> this is the law that governs all of it.

---

## 1. The Project Goal (North Star)

**Build a fully offline, local web app for creating, editing, and exporting document templates.**

| Pillar | Meaning |
|---|---|
| **Offline-first** | Zero internet dependency. No feature may make an external HTTP/network call. All processing runs on-device. |
| **Template-centric** | Author reusable templates → generate concrete documents from them → edit, save, reopen, copy. |
| **Word-grade output** | Multi-page A4 editor with per-page orientation and auto-save; export to `.docx` (Word-compatible) and `.pdf`. |
| **Run from an extract** | Ships as an on-prem package that runs as a local web app (Windows + Linux), no cloud, no install ceremony. |

Stack: **FastAPI + SQLAlchemy/SQLite** (backend) · **React 18 + Vite + TypeScript** (frontend) ·
**python-docx** (.docx) · **WeasyPrint** (.pdf).

If a proposed change weakens any pillar above — especially *offline-first* — it is wrong by default.

---

## 2. The Inviolable Rules

These are absolute. They are not style preferences; breaking them is a defect.

1. **Offline-first** — No external HTTP/network call, ever. Everything runs locally.
2. **Workers never call each other** — All cross-agent coordination goes through the Manager.
3. **The Reviewer gate** — Every *save* and every *export* must pass `ReviewerAgent` before the result is returned.
4. **Single responsibility** — Each agent owns one domain and never reaches into another's.
5. **Reviewer is read-only** — `ReviewerAgent` inspects and reports; it never modifies the data it checks.
6. **Manager is the coordinator** — The API layer calls `ManagerAgent` for multi-step work; it does not call workers directly for pipelines.
7. **Schema changes need Gamma approval** — `models.py` is owned by Team Gamma.
8. **Manager + Reviewer changes need Engineering Lead approval.**

---

## 3. The Agent Members (3-Tier Organisation)

```
                     API Layer (main.py)
                           │  calls Manager for all multi-step work
                           ▼
            ┌───────────────────────────────┐
            │         MANAGER TIER          │   manager_agent.py
            │         ManagerAgent          │   Orchestrates every workflow.
            │                               │   Enforces the Reviewer gate.
            └───────┬───────────────┬───────┘
                    │ delegates     │ enforces gate
                    ▼               ▼
        ┌────────────────────┐  ┌────────────────────┐
        │     WORKER TIER    │  │    REVIEWER TIER   │   reviewer_agent.py
        │                    │  │    ReviewerAgent   │   Validates in/out.
        │  TemplateAgent     │  │  Read-only.        │   Blocking errors → HTTP 422.
        │  ConversionAgent   │  │  Never mutates.    │
        │  RenderAgent       │  └────────────────────┘
        │  StorageAgent      │
        └────────────────────┘
        (workers never call each other)
```

### Manager Tier — `ManagerAgent`
The conductor. Owns every multi-step pipeline (save, import, export). Decides which workers run,
in what order, and **always** routes their output through the Reviewer before returning. The API
layer talks to the Manager, not to workers. Role spec: [`docs/roles/manager_agent.md`](docs/roles/manager_agent.md).

### Reviewer Tier — `ReviewerAgent`
The quality gate. Inspects inputs and outputs and returns a `ReviewResult`. **Read-only** — it never
edits what it checks. Blocking errors become an HTTP 422. Nothing is saved or exported without its
pass. Role spec: [`docs/roles/reviewer_agent.md`](docs/roles/reviewer_agent.md).

### Worker Tier
Each worker owns exactly one domain and stays inside it:

| Worker | Owns | Responsibility |
|---|---|---|
| **TemplateAgent** | template CRUD + field detection | Create/read/update templates; detect `{{variables}}`. |
| **ConversionAgent** | DOCX ↔ HTML | Convert uploaded `.docx` to editable HTML and fill templates. |
| **RenderAgent** | export | Produce `.docx` (one A4 Word section per page, real header/footer) and `.pdf`. |
| **StorageAgent** | file I/O | Read/write uploads and exports on local disk. |

Role specs: [`docs/roles/`](docs/roles/). **A worker that needs another worker's output asks the
Manager — it does not call the other worker directly.**

---

## 4. Development Teams

| Team | Code | Owns | Charter |
|---|---|---|---|
| **Alpha** | Core Engine | `main.py`, `schemas.py`, all agents except Storage, `tests/` | [`docs/teams/team_alpha.md`](docs/teams/team_alpha.md) |
| **Beta** | Editor Experience | `frontend/src/` | [`docs/teams/team_beta.md`](docs/teams/team_beta.md) |
| **Gamma** | Data & Storage | `models.py`, `database.py`, `agents/storage_agent.py` | [`docs/teams/team_gamma.md`](docs/teams/team_gamma.md) |
| **Delta** | DevOps | `docker/`, `docker-compose.yml`, `install.sh` | [`docs/teams/team_delta.md`](docs/teams/team_delta.md) |

**Approval gates:**
- Changing `models.py` (schema) → **Team Gamma** approval.
- Changing `manager_agent.py` or `reviewer_agent.py` → **Engineering Lead** approval.
- Touching another team's files → that team's review.

---

## 5. The Working Method (Skills)

This repo carries the reasoning skills every agent runs by. They live in [`skills/`](skills/) and are
binding working method, not decoration.

| Skill | When it runs | What it enforces |
|---|---|---|
| [`careful-reasoning`](skills/careful-reasoning/SKILL.md) | Always, before every response | Think first; recheck results; no assumptions without evidence; say "I don't know" when unknown. |
| [`reasoning-default`](skills/reasoning-default/SKILL.md) | Any analyze/debug/plan/decide/explain task | Root-cause framework (Pause → Problem → Cause → Resolution → Path); label claims **Known / Likely / Unknown**; smallest complete answer. |
| [`ponytail`](skills/ponytail/SKILL.md) | Any code change | Decision ladder: **YAGNI → stdlib → platform → existing deps → one-liner → minimal code**. No unrequested abstractions. Mark deliberate shortcuts with `ponytail:` comments. |

**Never simplify away** (even under ponytail): input validation, error handling that prevents data
loss, security, accessibility, explicit user requests, and the Inviolable Rules in §2.

---

## 6. Definition of Done

A change is complete only when **all** hold:

1. It upholds every pillar in §1 and breaks no rule in §2.
2. Saves/exports pass the Reviewer gate.
3. It stays inside the owning team's files, or has the required approval (§4).
4. Backend tests pass: `cd backend && pytest tests/test_api.py -v`.
5. Frontend type-checks clean: `cd frontend && npx tsc --noEmit`.
6. No external network call was introduced.
7. The relevant `docs/` role/team file is updated in the same change.

---

*Read [`docs/INDEX.md`](docs/INDEX.md) for the full navigation map. This Bible governs; the docs elaborate.*
