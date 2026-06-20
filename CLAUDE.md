# CLAUDE.md — Doc Template Studio

This file gives Claude Code full context for working inside this project.

---

## What This Project Is

A fully **offline** local web app for document template creation and editing.

| Capability | Detail |
|---|---|
| Template authoring | WYSIWYG editor (TipTap) with `{{variable}}` placeholder support |
| DOCX import | Upload a `.docx` → auto-detect placeholders → create template |
| Fill & export | Fill template fields via a form → export `.docx` or `.pdf` |
| Local-only | Zero internet dependency. All processing runs on-device. |
| Packaging | `docker compose up --build` or `./install.sh` → opens on port 8000 |

---

## How to Start the App

```bash
# Production (Docker)
docker compose up --build
# → http://localhost:8000

# Linux bare-metal
chmod +x install.sh && ./install.sh
# → http://localhost:8000

# Development (hot-reload)
# Terminal 1 — backend
cd backend
python3 -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev   # → http://localhost:5173 (proxies /api → :8000)
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | FastAPI + Uvicorn |
| Database | SQLAlchemy + SQLite (`backend/data/templates.sqlite`) |
| DOCX I/O | python-docx |
| PDF export | WeasyPrint (local, no internet) |
| Frontend | React 18 + Vite + TypeScript |
| Editor | TipTap (headless WYSIWYG) |

---

## Project Structure

```
doc-template-studio/
├── backend/
│   ├── main.py                    # All FastAPI routes
│   ├── models.py                  # SQLAlchemy ORM models
│   ├── schemas.py                 # Pydantic request/response types
│   ├── database.py                # SQLite engine + session
│   ├── agents/
│   │   ├── manager_agent.py       # Manager tier — pipeline orchestration
│   │   ├── reviewer_agent.py      # Reviewer tier — quality gate
│   │   ├── template_agent.py      # Worker — template CRUD + field detection
│   │   ├── conversion_agent.py    # Worker — DOCX ↔ HTML conversion
│   │   ├── render_agent.py        # Worker — .docx / .pdf export
│   │   └── storage_agent.py       # Worker — file I/O (uploads + exports)
│   └── tests/test_api.py
├── frontend/src/
│   ├── api/client.ts              # All Axios API calls
│   ├── components/Editor/         # TipTap editor, toolbar, fields sidebar
│   ├── components/TemplateLibrary/
│   ├── components/FillForm/
│   └── components/Preview/
├── docker/Dockerfile
├── docker-compose.yml
├── install.sh
└── docs/                          # Full policy + role documentation
    ├── INDEX.md
    ├── COMPANY_POLICY.md
    ├── roles/                     # One file per agent
    └── teams/                     # One file per dev team
```

---

## Organisation — 3-Tier Agent Architecture

```
API Layer  (main.py)
    ↓
┌─────────────────────────────┐
│       MANAGER TIER          │   manager_agent.py
│       ManagerAgent          │   Orchestrates all multi-step workflows.
│                             │   Enforces the Reviewer gate.
└──────┬──────────────┬───────┘
       │              │
  delegates       enforces gate
       ↓              ↓
┌──────────────┐  ┌────────────────┐
│ WORKER TIER  │  │ REVIEWER TIER  │   reviewer_agent.py
│              │  │ ReviewerAgent  │   Validates inputs/outputs.
│TemplateAgent │  │ Never modifies │   Returns ReviewResult.
│ConversionAgent  │ data it checks.│   Blocking errors → HTTP 422.
│RenderAgent   │  └────────────────┘
│StorageAgent  │
└──────────────┘
```

**The one inviolable rule: workers never call each other.** All cross-agent coordination goes through ManagerAgent.

---

## Development Teams

| Team | Code | Files Owned | Charter |
|---|---|---|---|
| Alpha | Core Engine | `main.py`, `schemas.py`, `agents/manager_agent.py`, `agents/reviewer_agent.py`, `agents/template_agent.py`, `agents/conversion_agent.py`, `agents/render_agent.py`, `tests/` | `docs/teams/team_alpha.md` |
| Beta | Editor Experience | `frontend/src/` | `docs/teams/team_beta.md` |
| Gamma | Data & Storage | `models.py`, `database.py`, `agents/storage_agent.py` | `docs/teams/team_gamma.md` |
| Delta | DevOps | `docker/`, `docker-compose.yml`, `install.sh`, `.dockerignore` | `docs/teams/team_delta.md` |

---

## Key Rules (from `docs/COMPANY_POLICY.md`)

1. **Offline-first** — No feature may make an external HTTP call.
2. **Quality gate** — Every export and every template save must pass ReviewerAgent before the result is returned.
3. **Single responsibility** — Each agent owns one domain and does not reach into another's.
4. **Reviewer is read-only** — ReviewerAgent never modifies data; it only inspects and reports.
5. **Manager is the coordinator** — The API layer calls ManagerAgent for multi-step work; it does not call workers directly for pipelines.
6. **Schema changes need Gamma approval** — `models.py` is owned by Team Gamma.
7. **Manager + Reviewer changes need Engineering Lead approval.**

---

## API Routes

```
POST   /api/templates/                  Create template (via Manager save_template)
GET    /api/templates/                  List templates (search, category filter)
GET    /api/templates/{id}              Get single template
PUT    /api/templates/{id}              Update template (via Manager save_template)
DELETE /api/templates/{id}             Delete template
POST   /api/templates/{id}/duplicate   Duplicate template
GET    /api/templates/{id}/fields      Get field list
GET    /api/templates/{id}/versions    Version history
POST   /api/templates/{id}/restore/{vid}  Restore a version
POST   /api/templates/import-docx      Upload .docx → import as template (via Manager)
POST   /api/templates/{id}/export      Fill + export .docx or .pdf (via Manager)
GET    /api/categories                 List distinct categories
```

---

## Running Tests

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\Activate.ps1 on Windows
pytest tests/test_api.py -v
```

Tests use in-memory SQLite — no database setup required.

---

## Documentation

Read `docs/INDEX.md` for the full navigation map.

- Company policy, standards, change management: `docs/COMPANY_POLICY.md`
- Per-agent role specification: `docs/roles/<agent_name>.md`
- Per-team charter: `docs/teams/team_<name>.md`

When making changes, update the relevant role doc in the same PR.
