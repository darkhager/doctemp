# Doc Template Studio

A fully **offline** web app for creating, editing, and filling document templates — runs on a single local port.

## Features

- WYSIWYG template editor (TipTap) with `{{variable}}` placeholder support
- Import `.docx` → auto-detect placeholders → template
- Fill template via a dynamic form → export to `.docx` or `.pdf`
- Template library with categories, search, duplicate, version history
- Zero cloud dependencies — all processing is local

## Quick Start

### Docker (recommended)

```bash
docker compose up --build
# Open http://localhost:8000
```

### Linux bare-metal (no Docker)

```bash
chmod +x install.sh && ./install.sh
# Open http://localhost:8000
```

Requires: `python3 >= 3.10`, `node >= 18`, `npm`.

### Development mode (hot-reload)

```bash
# Terminal 1 — backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev    # http://localhost:5173 (proxies /api → :8000)
```

## Project Structure

```
doc-template-studio/
├── backend/
│   ├── agents/           # Team Alpha/Gamma agent modules
│   │   ├── template_agent.py    # placeholder detection, CRUD
│   │   ├── conversion_agent.py  # DOCX ↔ HTML template
│   │   ├── render_agent.py      # .docx / .pdf export
│   │   └── storage_agent.py     # file I/O
│   ├── main.py           # FastAPI routes
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   └── database.py       # SQLite engine
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Editor/          # TipTap editor + toolbar + fields sidebar
│       │   ├── TemplateLibrary/ # Browse, search, import
│       │   ├── FillForm/        # Dynamic fill form + tab preview
│       │   └── Preview/         # Rendered document preview
│       └── api/client.ts        # Axios API wrappers
├── docker/Dockerfile
├── docker-compose.yml
└── install.sh
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/templates/` | List templates (filter by category/search) |
| POST | `/api/templates/` | Create template |
| PUT | `/api/templates/{id}` | Update template |
| DELETE | `/api/templates/{id}` | Delete template |
| POST | `/api/templates/import-docx` | Upload `.docx` → import as template |
| POST | `/api/templates/{id}/export` | Export filled template (docx/pdf) |
| GET | `/api/templates/{id}/fields` | List template fields |
| GET | `/api/templates/{id}/versions` | Version history |

## Team Organization

| Team | Scope |
|---|---|
| Alpha — Core Engine | FastAPI routes, agent orchestration, DOCX I/O |
| Beta — Editor Experience | TipTap editor UI, template library, fill form |
| Gamma — Data & Storage | SQLite schema, file storage, versioning |
| Delta — DevOps & Packaging | Docker, install.sh, port config |

## Tests

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```
