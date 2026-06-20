# Role: TemplateAgent

**Tier:** Worker  
**File:** `backend/agents/template_agent.py`  
**Owning Team:** Team Alpha — Core Engine  
**Reports to:** ManagerAgent  
**Supervises:** Nothing

---

## Purpose

The TemplateAgent owns the lifecycle of `Template` and `TemplateVersion` records in the database. It is responsible for creating, updating, and versioning templates, and for detecting `{{placeholder}}` variables from HTML content.

---

## Responsibilities

| # | Responsibility |
|---|---|
| 1 | Parse HTML content and extract `{{variable_name}}` placeholder names |
| 2 | Create new `Template` rows in the database |
| 3 | Update existing `Template` rows, merging new detected fields with existing ones |
| 4 | Snapshot every save as a `TemplateVersion` record |
| 5 | Return the saved ORM object to the caller |

---

## Methods

### `detect_fields(html: str) → list[FieldSchema]`

Scans HTML for all `{{variable_name}}` tokens using the regex `\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}`.

- Returns one `FieldSchema` per unique name, in order of first appearance.
- Sets default label as title-cased name with underscores replaced by spaces.
- Default `field_type` is `"text"`, `required` is `False`.

**Does not write to the database.**

---

### `create(db: Session, data: TemplateCreate) → Template`

Creates a new `Template` row.

- If `data.fields_json` is empty, calls `detect_fields(data.content_html)` automatically.
- Commits the row to the database.
- Immediately calls `_snapshot()` to record version 1.
- Returns the refreshed ORM object.

---

### `update(db: Session, template: Template, data: TemplateUpdate) → Template`

Updates an existing `Template` row.

- Applies only the fields present in `data` (all fields are `Optional`).
- When `content_html` changes, runs `detect_fields()` and merges any newly found placeholders into `fields_json` without removing existing ones.
- When `fields_json` is explicitly supplied, it overwrites the existing field list entirely.
- Commits and calls `_snapshot()` to record the new version.
- Returns the refreshed ORM object.

---

### `_snapshot(db: Session, template: Template) → None`  *(private)*

Creates a `TemplateVersion` row from the current state of a `Template`.

- Version numbers are sequential integers starting at 1 per template.
- Called automatically at the end of `create()` and `update()`.
- Not to be called externally.

---

## Data Owned

| Model | Operation | Notes |
|---|---|---|
| `Template` | CREATE, UPDATE, READ | Does not DELETE — deletion is handled by the API layer directly |
| `TemplateVersion` | CREATE, READ | Versions are append-only; never updated or deleted |

---

## Placeholder Detection Rules

| Rule | Detail |
|---|---|
| Valid variable names | `[a-zA-Z_][a-zA-Z0-9_]*` — same as Python identifiers |
| Whitespace inside braces | Tolerated: `{{ name }}` and `{{name}}` are the same |
| Duplicate names | Deduplicated — only the first occurrence creates a field |
| Nesting | Not supported — `{{{{nested}}}}` is not detected |
| Case sensitivity | `{{Name}}` and `{{name}}` are treated as different fields |

---

## What the TemplateAgent Must NOT Do

- Call ConversionAgent, RenderAgent, or StorageAgent.
- Make routing or orchestration decisions.
- Delete templates — that is the API layer's responsibility.
- Raise HTTP exceptions — only Python exceptions.

---

## Input / Output Contract

**`create()` Input (`TemplateCreate`):**
```
name: str (required)
description: str = ""
category: str = "General"
content_html: str = ""
fields_json: list[FieldSchema] = []
```

**`update()` Input (`TemplateUpdate`):**
```
name: Optional[str]
description: Optional[str]
category: Optional[str]
content_html: Optional[str]
fields_json: Optional[list[FieldSchema]]
```

All outputs are refreshed SQLAlchemy `Template` ORM objects.

---

## Testing

Key test scenarios:
- `detect_fields` extracts correct names in order
- `detect_fields` deduplicates correctly
- `create` auto-detects fields when `fields_json` is empty
- `update` merges new fields without removing existing ones
- `update` overwrites field list when `fields_json` is explicitly provided
- `_snapshot` increments version numbers correctly
