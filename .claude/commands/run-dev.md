# Start Development Environment

## Docker (recommended — single command)

```bash
docker compose up --build
# App available at http://localhost:8000
```

## Bare-metal (hot-reload)

Terminal 1 — Backend:
```bash
cd backend
python3 -m venv venv
# Windows:
venv\Scripts\Activate.ps1
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Terminal 2 — Frontend:
```bash
cd frontend
npm install
npm run dev
# Frontend at http://localhost:5173 (proxies /api → :8000)
```

## Run tests

```bash
cd backend
source venv/bin/activate   # or venv\Scripts\Activate.ps1
pytest tests/ -v
```

Tests use in-memory SQLite — no database setup needed.

## Data locations

| Item | Path |
|---|---|
| SQLite database | `backend/data/templates.sqlite` |
| Uploaded source files | `backend/uploads/` |
| Generated exports | `backend/exports/` |

The database is the only file needed for disaster recovery. Uploads and exports are ephemeral.
