# Team Gamma — Data & Storage

**Code name:** Gamma  
**Focus area:** Database schema, file system abstraction, data persistence  
**Tier coverage:** Worker tier (StorageAgent), database foundation (models, migrations)

---

## Charter

Team Gamma owns the data layer. This means the SQLite database schema, all SQLAlchemy ORM models, the `StorageAgent` for file I/O, and any future migration tooling. No other team modifies `models.py` without Gamma's review. Team Gamma ensures that data is stored correctly, consistently, and can survive an application restart.

---

## Files Owned

| File | Description |
|---|---|
| `backend/models.py` | SQLAlchemy ORM model definitions |
| `backend/database.py` | Engine creation, session factory, `get_db` dependency |
| `backend/agents/storage_agent.py` | File I/O abstraction for uploads and exports |

---

## Team Members & Sub-roles

| Sub-role | Responsibility |
|---|---|
| Data Lead | Owns schema design, `models.py`, and `database.py` |
| Storage Engineer | Owns `storage_agent.py`, file naming conventions, retention policy |

---

## Workflow

1. Any schema change starts as a proposal with the old and new column definitions shown.
2. Data Lead reviews for normalisation, nullable vs. required, and JSON column usage.
3. Change is applied to `models.py`. Since SQLite auto-creates tables on startup via `Base.metadata.create_all()`, development environments pick up new columns on next start.
4. **Migration note:** Adding non-nullable columns to an existing production database requires a migration step. Team Gamma is responsible for providing the SQL migration script and documenting it.
5. Storage engineer reviews any change to file directory structure or naming convention.

---

## Interfaces with Other Teams

| Team | Interface |
|---|---|
| Team Alpha | Alpha reads from `models.py` and calls `StorageAgent`. Gamma approves schema changes; Alpha does not alter `models.py` unilaterally. |
| Team Beta | No direct interface. Beta reads ORM data through API responses shaped by `schemas.py` (Alpha's file). |
| Team Delta | Gamma's `database.py` reads `DATABASE_URL` from env. Delta sets this in Dockerfile and `docker-compose.yml`. |

---

## Database Schema Reference

### `templates`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `name` | VARCHAR(255) | Not null |
| `description` | TEXT | Default `""` |
| `category` | VARCHAR(100) | Default `"General"` |
| `content_html` | TEXT | Full TipTap HTML output |
| `fields_json` | JSON | `list[FieldSchema]` as stored dicts |
| `created_at` | DATETIME | Set on insert |
| `updated_at` | DATETIME | Updated on every save |

### `template_versions`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `template_id` | INTEGER FK → `templates.id` | Cascade delete |
| `version_number` | INTEGER | Sequential per template, starts at 1 |
| `content_html` | TEXT | Snapshot of content at save time |
| `fields_json` | JSON | Snapshot of fields at save time |
| `created_at` | DATETIME | |

### `uploaded_documents`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `filename` | VARCHAR(255) | UUID stored filename on disk |
| `original_name` | VARCHAR(255) | Original upload filename |
| `template_id` | INTEGER FK → `templates.id` nullable | |
| `uploaded_at` | DATETIME | |

---

## JSON Column Policy

`fields_json` stores a `list` of field objects. Each element must conform to:

```json
{
  "name": "client_name",
  "label": "Client Name",
  "field_type": "text",
  "required": false,
  "default_value": ""
}
```

Allowed `field_type` values: `"text"`, `"textarea"`, `"date"`, `"number"`.

Any addition of a new `field_type` must be reflected in:
1. `schemas.py` (Pydantic validation)
2. `frontend/src/types/index.ts`
3. `frontend/src/components/FillForm/FillFormPage.tsx` (input type switch)

---

## Standards & Constraints

- SQLite is the only supported database in v1. `database.py` may be extended later for PostgreSQL without breaking the rest of the app (SQLAlchemy abstracts this).
- JSON columns must never store raw HTML. HTML belongs in `content_html` (a TEXT column), not in JSON.
- All new columns must have sensible defaults so that existing rows remain valid after a schema change.
- `Base.metadata.create_all()` is called once at startup in `main.py`. Gamma must verify this works correctly after any schema change.

---

## File System Ownership

| Directory | Purpose | Retention |
|---|---|---|
| `backend/uploads/` | Uploaded source `.docx` files | Persistent; manual cleanup only |
| `backend/exports/` | Generated `.docx`/`.pdf` export files | Ephemeral; safe to delete anytime |
| `backend/data/` | SQLite database file | **Never delete in production** |

Team Gamma is responsible for the backup and restore runbook for `backend/data/templates.sqlite`.
