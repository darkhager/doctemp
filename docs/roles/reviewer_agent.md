# Role: ReviewerAgent

**Tier:** Reviewer  
**File:** `backend/agents/reviewer_agent.py`  
**Owning Team:** Team Alpha — Core Engine (policy enforced by Engineering Lead)  
**Reports to:** ManagerAgent (the only caller)  
**Supervises:** Nothing — the Reviewer is a terminal node; it calls no other agent

---

## Purpose

The ReviewerAgent is the quality gate of the system. It validates every significant input and output before it is committed to the database, returned to the API, or written to disk. It is stateless — it never reads from or writes to the database.

The Reviewer does not fix problems. It detects them, classifies them as errors (blocking) or warnings (non-blocking), and returns a structured `ReviewResult`. The Manager decides what to do with that result.

---

## Responsibilities

| # | Responsibility |
|---|---|
| 1 | Validate template name, content, and field list before a template is saved |
| 2 | Validate filled HTML before export — detect unfilled placeholders and blank fields |
| 3 | Validate exported file bytes — check for empty files and invalid format headers |
| 4 | Return a structured `ReviewResult` with `passed`, `warnings`, and `errors` |
| 5 | Never modify the data it reviews |
| 6 | Never call another agent |

---

## ReviewResult

```python
@dataclass
class ReviewResult:
    passed: bool           # False if any error found; True even if warnings exist
    warnings: list[str]    # Non-blocking issues — operation continues
    errors: list[str]      # Blocking issues — Manager raises ValueError
```

**Rule:** `passed` is `True` if and only if `errors` is empty. Warnings alone do not set `passed = False`.

---

## Methods

### `review_template(name, html, fields) → ReviewResult`

Called before any template is saved (create or update).

| Check | Severity | Condition |
|---|---|---|
| Name is empty | Error | `name` is blank after strip |
| Content is empty | Error | HTML stripped of tags is empty |
| Content is very short | Warning | Stripped content < 10 characters |
| Orphaned placeholders | Warning | `{{x}}` found in HTML but `x` not in field list |
| Declared but unused fields | Warning | Field declared in list but `{{field}}` not in HTML |

**Inputs:** `name: str`, `html: str`, `fields: list[dict]`  
**Output:** `ReviewResult`  
**Side effects:** None

---

### `review_filled_html(html, field_values) → ReviewResult`

Called immediately before rendering, after placeholders have been substituted.

| Check | Severity | Condition |
|---|---|---|
| Unfilled placeholders remain | Warning | `{{anything}}` still present in HTML after fill |
| Blank field values | Warning | One or more `field_values` values are empty string |

**Note:** Unfilled placeholders are a warning, not an error. The user may intentionally leave some blank; the document will contain the literal `{{field_name}}` token.

**Inputs:** `html: str`, `field_values: dict[str, str]`  
**Output:** `ReviewResult`  
**Side effects:** None

---

### `review_export_bytes(data, fmt) → ReviewResult`

Called after the RenderAgent has produced the file bytes, before they are written to disk.

| Check | Severity | Condition |
|---|---|---|
| Empty file | Error | `data` is empty bytes |
| Invalid DOCX header | Error | `fmt == "docx"` and bytes do not start with `PK` (ZIP magic) |
| Invalid PDF header | Error | `fmt == "pdf"` and bytes do not start with `%PDF` |
| Unusually small file | Warning | File size < 500 bytes |

**Inputs:** `data: bytes`, `fmt: str`  
**Output:** `ReviewResult`  
**Side effects:** None

---

## What the Reviewer Must NOT Do

- Modify, transform, or fix the data it receives.
- Write to or read from the database or file system.
- Call any other agent (ConversionAgent, StorageAgent, etc.).
- Cache results between calls — each call is fully independent.
- Raise exceptions for warnings — all findings are returned in `ReviewResult`.

---

## Error vs Warning Decision Guide

Use this table when adding new checks:

| Use **Error** when… | Use **Warning** when… |
|---|---|
| The output would be corrupt or unusable | The output is usable but possibly incomplete |
| The check indicates a programmer or data error | The check indicates a user oversight |
| The operation should never succeed in this state | The user may have intentionally chosen this state |
| Example: empty file bytes | Example: a field left blank |

---

## Changing Review Logic

Changes to this file have the highest impact on system behaviour. Before modifying:

1. List which existing calls currently pass or fail the check you are changing.
2. Get review from the Engineering Lead (see `COMPANY_POLICY.md` §6.1).
3. Add or update tests for every changed check path.
4. Do not loosen an Error to a Warning without explicit product approval.

---

## Testing

All checks must have dedicated test cases in `backend/tests/test_api.py` under the `# Reviewer Agent tests` section.

Minimum required tests per method:
- One test for the passing case
- One test per Error condition
- One test per Warning condition that is distinct in its trigger

Current test coverage target: **100% branch coverage** (see `COMPANY_POLICY.md` §9).
