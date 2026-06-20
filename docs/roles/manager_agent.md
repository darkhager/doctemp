# Role: ManagerAgent

**Tier:** Manager  
**File:** `backend/agents/manager_agent.py`  
**Owning Team:** Team Alpha — Core Engine  
**Reports to:** API Layer (`main.py`)  
**Supervises:** TemplateAgent, ConversionAgent, RenderAgent, StorageAgent, ReviewerAgent

---

## Purpose

The ManagerAgent is the orchestration hub of the system. It owns all multi-step workflows that require more than one agent to complete. No API route should call a worker agent directly for a multi-step operation — it must go through the Manager.

The Manager does not implement domain logic itself. It delegates to workers, sequences the steps, and enforces the Reviewer gate on inputs and outputs before returning results.

---

## Responsibilities

| # | Responsibility |
|---|---|
| 1 | Receive a high-level work order from the API layer |
| 2 | Decompose the order into a sequence of worker calls |
| 3 | Pass outputs through ReviewerAgent before returning them |
| 4 | Raise `ValueError` if the reviewer finds blocking errors |
| 5 | Surface reviewer warnings in the returned outcome object |
| 6 | Never implement domain logic directly — always delegate |

---

## Workflows Owned

### `import_docx(file_bytes, original_name, db)`

Orchestrates the full DOCX import pipeline:

```
StorageAgent.save_upload()
    → ConversionAgent.docx_to_html()
    → ReviewerAgent.review_template()   ← review gate
    → TemplateAgent.create()
    → returns ImportOutcome
```

**Inputs:** Raw file bytes, original filename, database session  
**Outputs:** `ImportOutcome` — contains `template_id`, `name`, `fields_detected`, `message`, `review`  
**Raises:** `Exception` (propagated from any worker) on hard failure

---

### `export_template(content_html, field_values, fmt)`

Orchestrates the full fill-and-export pipeline:

```
ReviewerAgent.review_filled_html()     ← pre-export gate
    → RenderAgent.to_docx() or to_pdf()
    → ReviewerAgent.review_export_bytes() ← post-render gate
    → StorageAgent.save_export()
    → returns ExportOutcome
```

**Inputs:** Template HTML string, field value dict, format string (`"docx"` or `"pdf"`)  
**Outputs:** `ExportOutcome` — contains `file_bytes`, `suffix`, `stored_filename`, `export_path`, `review`  
**Raises:** `ValueError` if the reviewer finds errors; re-raises render exceptions

---

### `save_template(db, name, html, fields, template_id, description, category)`

Orchestrates create-or-update with a review gate:

```
ReviewerAgent.review_template()    ← gate
    → TemplateAgent.create() or TemplateAgent.update()
    → returns (Template, ReviewResult)
```

**Inputs:** DB session, template metadata, HTML content, field list, optional existing template ID  
**Outputs:** Tuple of `(Template ORM object, ReviewResult)`  
**Raises:** `ValueError` if review fails; `LookupError` if `template_id` not found

---

## What the Manager Must NOT Do

- Implement document conversion, rendering, or file I/O directly.
- Write to the database directly (all DB writes go through worker agents).
- Bypass the ReviewerAgent gate, even for internal or test calls.
- Call the ReviewerAgent for anything other than passing its result through — the Reviewer decides; the Manager enforces.

---

## Constructor Dependencies

```python
ManagerAgent(
    storage: StorageAgent,
    conversion: ConversionAgent,
    template: TemplateAgent,
    render: RenderAgent,
    reviewer: ReviewerAgent,
)
```

All dependencies are injected at startup in `main.py`. The Manager does not instantiate its own workers.

---

## Outcome Types

### `ImportOutcome`
| Field | Type | Description |
|---|---|---|
| `template_id` | `int` | ID of the created template |
| `name` | `str` | Derived template name |
| `fields_detected` | `list[dict]` | Field list as dicts |
| `message` | `str` | Human-readable summary, includes warnings |
| `review` | `ReviewResult` | Full review result |

### `ExportOutcome`
| Field | Type | Description |
|---|---|---|
| `file_bytes` | `bytes` | Raw exported file |
| `suffix` | `str` | `"docx"` or `"pdf"` |
| `stored_filename` | `str` | UUID filename on disk |
| `export_path` | `str` | Absolute path to file |
| `review` | `ReviewResult` | Combined pre+post review result |

---

## Error Handling Policy

| Condition | Behaviour |
|---|---|
| `ReviewResult.passed == False` | Raise `ValueError` with joined error messages |
| Worker raises an exception | Propagate — do not catch and hide |
| `template_id` not found in save_template | Raise `LookupError` |
| Unknown export format | Caller (API layer) validates this before calling Manager |

---

## Testing

Tests for Manager workflows are in `backend/tests/test_api.py` under the `# Manager Agent tests` section.  
Key scenarios to cover:
- Empty template name rejected (HTTP 422)
- Valid template saved and fields auto-detected
- Import pipeline end-to-end with a real `.docx` fixture
- Export rejected when reviewer finds a byte-level error
