# Team Delta — DevOps & Packaging

**Code name:** Delta  
**Focus area:** Docker packaging, bare-metal installation, runtime configuration  
**Tier coverage:** Infrastructure layer (no agent ownership)

---

## Charter

Team Delta ensures that the application can be reliably started, stopped, and operated by anyone with Docker or a Linux terminal — without any manual configuration steps beyond running a single command. Team Delta owns the deployment artefacts and is responsible for ensuring that the application starts cleanly in all supported environments.

---

## Files Owned

| File | Description |
|---|---|
| `docker/Dockerfile` | Multi-stage Docker image build |
| `docker-compose.yml` | Single-service compose for production |
| `.dockerignore` | Files excluded from Docker build context |
| `install.sh` | Bare-metal Linux install and start script |

---

## Team Members & Sub-roles

| Sub-role | Responsibility |
|---|---|
| DevOps Lead | Owns Dockerfile, docker-compose, CI decisions |
| Platform Engineer | Owns `install.sh`, system dependency checking, startup scripts |

---

## Workflow

1. When `requirements.txt` or `package.json` changes, Delta rebuilds and tests the Docker image.
2. Any new system-level dependency (e.g. a new WeasyPrint shared lib) must be added to the Dockerfile **and** documented in `install.sh` with the distro-specific package name.
3. Environment variable changes must be reflected in Dockerfile `ENV` directives, `docker-compose.yml` `environment` block, and `install.sh` exports — all three simultaneously.
4. Before merging a Dockerfile change, a clean `docker compose up --build` must succeed from scratch with `--no-cache`.

---

## Interfaces with Other Teams

| Team | Interface |
|---|---|
| Team Alpha | `requirements.txt` drives the Python layer in the Dockerfile |
| Team Beta | `npm run build` is called in the Dockerfile's Node stage; Beta must keep the build clean |
| Team Gamma | `DATABASE_URL` env var points to the SQLite path inside the container; Delta sets the volume mount |

---

## Supported Environments

| Environment | Entry point | Port | Notes |
|---|---|---|---|
| Docker (Linux/Mac/Win) | `docker compose up --build` | 8000 | Recommended for production |
| Linux bare-metal | `./install.sh` | 8000 | Requires python3, node, npm |
| Windows dev | Manual venv + `npm run dev` | 8000 / 5173 | Dev only; not a Delta target |

---

## Docker Architecture

### Multi-stage build

**Stage 1 — frontend-build** (`node:20-alpine`)
- Copies `frontend/package*.json` and runs `npm ci --legacy-peer-deps`.
- Copies full `frontend/` source and runs `npm run build`.
- Vite writes the bundle to `../backend/static/` (i.e. `/app/backend/static` in the stage).

**Stage 2 — runtime** (`python:3.11-slim`)
- Installs WeasyPrint system dependencies via `apt-get`.
- Copies `backend/requirements.txt` and runs `pip install`.
- Copies `backend/` source files.
- Copies `/app/backend/static` from Stage 1 into `./static`.
- Creates `uploads/`, `exports/`, `data/` directories.
- Exposes port 8000.
- CMD: `uvicorn main:app --host 0.0.0.0 --port 8000`

The final image is a single Python container that serves both the API and the frontend static files. No nginx is required.

---

## Environment Variables Reference

| Variable | Default in container | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./data/templates.sqlite` | SQLite file path inside container |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded `.docx` files |
| `EXPORT_DIR` | `exports` | Directory for generated export files |
| `STATIC_DIR` | `static` | Directory of built frontend assets |
| `ALLOWED_ORIGINS` | `http://localhost:8000` | CORS allowed origins |

---

## Volume Mounts (docker-compose)

| Host path | Container path | Purpose |
|---|---|---|
| `./data` | `/app/data` | SQLite database — **must be persisted** |
| `./uploads` | `/app/uploads` | Uploaded source documents |
| `./exports` | `/app/exports` | Generated export files |

**Rule:** Never remove the `./data` volume mount. Doing so destroys all template data.

---

## `.dockerignore` Policy

The following are excluded from the Docker build context to keep image size minimal and prevent secrets from leaking:

- `frontend/node_modules/` — reinstalled during build
- `backend/venv/` — recreated during build
- `backend/__pycache__/` and `**/*.pyc`
- `backend/uploads/`, `backend/exports/`, `backend/data/` — runtime data, not source
- `backend/static/` — produced by Stage 1, not part of source
- `.env` files

---

## `install.sh` Responsibilities

The install script must:
1. Check for `python3`, `node`, and `npm` and exit with a clear error if any is missing.
2. Run `npm ci && npm run build` in `frontend/`.
3. Create and activate a Python venv in `backend/venv/`.
4. Run `pip install -r requirements.txt` in the venv.
5. Print a hint about WeasyPrint system dependencies if the import fails.
6. Create `uploads/`, `exports/`, `data/` directories.
7. Start `uvicorn main:app` on port 8000 with all required env vars set.

The script must be idempotent — running it a second time must not break a working installation.

---

## Standards & Constraints

- The Docker image must build from a clean context with `--no-cache` before any merge.
- The image must not contain secrets, `.env` files, or local `node_modules`.
- `install.sh` must run on Debian/Ubuntu and RHEL/Fedora without modification (use `command -v` for checks, not distro-specific paths).
- Port 8000 is the canonical external port. Never change it without a version bump and policy update.
