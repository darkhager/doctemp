# Role: ConversionAgent

**Tier:** Worker  
**File:** `backend/agents/conversion_agent.py`  
**Owning Team:** Team Alpha — Core Engine  
**Reports to:** ManagerAgent  
**Supervises:** Nothing

---

## Purpose

The ConversionAgent handles all bi-directional conversion between `.docx` file format and the HTML representation used internally by the template engine. It is the only component that reads from uploaded `.docx` files.

---

## Responsibilities

| # | Responsibility |
|---|---|
| 1 | Parse an uploaded `.docx` file into an HTML string |
| 2 | Preserve `{{placeholder}}` tokens found in the source document |
| 3 | Detect and return the list of placeholder fields found in the parsed HTML |
| 4 | Substitute `{{variable}}` placeholders in HTML with provided values (fill) |
| 5 | Convert paragraph styles (Heading 1–3, body, lists) to equivalent HTML tags |
| 6 | Convert `.docx` tables to HTML `<table>` markup |

---

## Methods

### `docx_to_html(docx_path: str | Path) → tuple[str, list[FieldSchema]]`

Reads a `.docx` file from disk using `python-docx` and converts its content to HTML.

**Conversion rules:**

| DOCX element | HTML output |
|---|---|
| Heading 1 style | `<h1>…</h1>` |
| Heading 2 style | `<h2>…</h2>` |
| Heading 3 style | `<h3>…</h3>` |
| Body paragraph | `<p>…</p>` |
| Empty paragraph | `<p><br></p>` |
| Bold run | `<strong>…</strong>` |
| Italic run | `<em>…</em>` |
| Underlined run | `<u>…</u>` |
| Table | `<table><tr><td/th>…</td/th></tr></table>` |

**Placeholder preservation:**  
HTML special characters (`<`, `>`, `&`) are escaped. However `{{` and `}}` sequences that were escaped back through `&lt;` and `&gt;` are restored, so placeholders already typed in the source document survive conversion intact.

**Returns:** `(html_string, list_of_FieldSchema)`  
The field list is derived by scanning the resulting HTML for `{{variable}}` tokens.

---

### `fill_template(html: str, values: dict[str, str]) → str`

Replaces every `{{variable_name}}` in the HTML string with the corresponding value from `values`.

- If a key is present in the HTML but missing from `values`, the placeholder is left as-is.
- Does not modify the input string; returns a new string.
- No HTML escaping is applied to the substituted values — the caller is responsible for ensuring values are safe for the output context.

**Inputs:** HTML string, dict of `{field_name: value}`  
**Output:** Filled HTML string

---

## What the ConversionAgent Must NOT Do

- Write to the database.
- Save or delete files — all file I/O is StorageAgent's responsibility.
- Call TemplateAgent, RenderAgent, or StorageAgent.
- Validate the quality of the output — that is ReviewerAgent's responsibility.
- Attempt to parse formats other than `.docx` (no `.doc`, `.odt`, `.rtf`).

---

## Supported Input

| Format | Supported | Notes |
|---|---|---|
| `.docx` (OOXML) | Yes | Via `python-docx` library |
| `.doc` (legacy binary) | No | Not supported; user must convert to `.docx` first |
| `.odt`, `.rtf` | No | Out of scope |
| HTML string (fill) | Yes | `fill_template()` input |

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Images | Images in `.docx` files are silently dropped during conversion |
| Complex formatting | Font sizes, colors, and custom styles are not preserved |
| Nested tables | Only the outer table is parsed; nested tables are flattened |
| Headers & footers | Page headers and footers in `.docx` are not extracted |
| Bullet lists | Converted to plain `<p>` paragraphs (list detection not implemented in v1) |

These limitations are acceptable for v1. Improvements are tracked as backlog items.

---

## Dependencies

| Library | Usage |
|---|---|
| `python-docx` | Reading `.docx` paragraph, run, and table structure |
| `re` (stdlib) | Placeholder detection via regex |

---

## Input / Output Contract

```
docx_to_html(docx_path)
    input:  path to a .docx file (string or Path)
    output: (html: str, fields: list[FieldSchema])

fill_template(html, values)
    input:  html: str, values: dict[str, str]
    output: str (filled HTML)
```

---

## Testing

Key test scenarios:
- Plain `.docx` with body paragraphs converts to `<p>` tags
- Heading styles produce correct `<h1>`/`<h2>`/`<h3>`
- Bold/italic/underline runs produce inline tags
- `{{placeholder}}` tokens survive the conversion
- `fill_template` replaces known keys and leaves unknown keys intact
- `fill_template` with empty `values` returns HTML unchanged
