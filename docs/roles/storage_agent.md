# Role: StorageAgent

**Tier:** Worker  
**File:** `backend/agents/storage_agent.py`  
**Owning Team:** Team Gamma — Data & Storage  
**Reports to:** ManagerAgent  
**Supervises:** Nothing

---

## Purpose

The StorageAgent is the single point of contact for all file system I/O within the application. It owns the `uploads/` and `exports/` directories. No other agent reads from or writes to these directories directly — all file operations must go through the StorageAgent.

---

## Responsibilities

| # | Responsibility |
|---|---|
| 1 | Save uploaded file bytes to the `uploads/` directory with a UUID filename |
| 2 | Return the stored filename and full path after saving |
| 3 | Save exported file bytes to the `exports/` directory with a UUID filename |
| 4 | Provide a path-lookup helper for uploaded files |
| 5 | Provide a path-lookup helper for exported files |
| 6 | Delete uploaded files by stored filename when requested |
| 7 | Ensure `uploads/` and `exports/` directories exist on initialisation |

---

## Methods

### `__init__(upload_dir, export_dir)`

Creates the `uploads/` and `exports/` directories if they do not exist.

**Default values:**
- `upload_dir = "uploads"` (relative to working directory)
- `export_dir = "exports"` (relative to working directory)

Both paths are converted to `pathlib.Path` objects internally.

---

### `save_upload(data: bytes, original_name: str) → tuple[str, str]`

Saves raw file bytes as a new file in `uploads/`.

- Generates a UUID hex filename while preserving the original file extension.
- Example: `invoice_template.docx` → `a3f8c2d1b4e7...f9.docx`
- Returns `(stored_filename, full_path_str)`.

**Why UUID names?** Prevents filename collisions and avoids exposing the original name on disk.

---

### `get_upload_path(filename: str) → Path`

Returns the full `Path` object for a given stored upload filename.  
Does not verify whether the file exists — the caller is responsible for existence checks.

---

### `save_export(data: bytes, suffix: str) → tuple[str, str]`

Saves raw file bytes as a new file in `exports/`.

- Generates a UUID hex filename with the given suffix (`"docx"` or `"pdf"`).
- Returns `(stored_filename, full_path_str)`.

The full path is returned to the API layer so it can be served with `FileResponse`.

---

### `get_export_path(filename: str) → Path`

Returns the full `Path` object for a given stored export filename.

---

### `delete_upload(filename: str) → None`

Deletes a file from `uploads/` if it exists. Silently does nothing if the file is not found.

---

## What the StorageAgent Must NOT Do

- Read or parse the content of files it stores (it handles bytes, not documents).
- Write to the database — `UploadedDocument` rows are managed by the API layer.
- Call ConversionAgent, TemplateAgent, RenderAgent, or ReviewerAgent.
- Generate or validate file content.
- Serve files over HTTP — that is FastAPI's `FileResponse` responsibility.

---

## Directory Layout

```
backend/
├── uploads/          ← StorageAgent upload_dir
│   └── <uuid>.docx   ← uploaded source files
└── exports/          ← StorageAgent export_dir
    ├── <uuid>.docx   ← generated DOCX exports
    └── <uuid>.pdf    ← generated PDF exports
```

Neither directory is backed up by default. See `COMPANY_POLICY.md` §7.2 for data persistence rules.

---

## File Retention Policy

The StorageAgent does not implement automatic cleanup. Files in `uploads/` and `exports/` accumulate over time. In production:

- `exports/` files are ephemeral — they can be deleted safely at any time.
- `uploads/` files are source documents linked to templates via `UploadedDocument` rows. Deleting them does not delete the template, but the original file will no longer be accessible.

A cleanup cron job (future work) may call `delete_upload()` for orphaned records.

---

## Input / Output Contract

```
save_upload(data: bytes, original_name: str)
    input:  raw file bytes, original filename (for extension extraction)
    output: (stored_filename: str, full_path: str)

save_export(data: bytes, suffix: str)
    input:  raw file bytes, file extension without dot ("docx" or "pdf")
    output: (stored_filename: str, full_path: str)

get_upload_path(filename: str) → pathlib.Path
get_export_path(filename: str) → pathlib.Path

delete_upload(filename: str) → None
```

---

## Dependencies

| Library | Usage |
|---|---|
| `pathlib.Path` (stdlib) | Directory and file path management |
| `uuid` (stdlib) | UUID filename generation |

---

## Testing

Key test scenarios:
- `save_upload` creates a file with a UUID name and the correct extension
- `save_upload` returns a path that exists on disk
- `get_upload_path` returns a `Path` with the correct prefix
- `save_export` creates a file in the export directory
- `delete_upload` removes an existing file
- `delete_upload` does not raise when the file does not exist
- Constructor creates directories if they do not exist
