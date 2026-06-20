# Role: RenderAgent

**Tier:** Worker  
**File:** `backend/agents/render_agent.py`  
**Owning Team:** Team Alpha — Core Engine  
**Reports to:** ManagerAgent  
**Supervises:** Nothing

---

## Purpose

The RenderAgent converts filled HTML content into a downloadable document. It is the final production step in the export workflow — it takes HTML that has already been filled with data and produces binary file output in `.docx` or `.pdf` format.

---

## Responsibilities

| # | Responsibility |
|---|---|
| 1 | Fill template placeholders with provided field values (via ConversionAgent) |
| 2 | Convert filled HTML to a valid `.docx` file using `python-docx` |
| 3 | Convert filled HTML to a valid `.pdf` file using WeasyPrint |
| 4 | Convert HTML `<table>` markup to a Word table within `.docx` output |
| 5 | Return raw file bytes to the caller |

---

## Methods

### `to_docx(content_html: str, field_values: dict[str, str] = None) → bytes`

Produces a `.docx` file from HTML content.

**Pipeline:**
1. Calls `ConversionAgent().fill_template(content_html, field_values)` to substitute placeholders.
2. Iterates over HTML lines and maps each to a Word element:

| HTML element | Word output |
|---|---|
| `<h1>` | `doc.add_heading(text, level=1)` |
| `<h2>` | `doc.add_heading(text, level=2)` |
| `<h3>` | `doc.add_heading(text, level=3)` |
| `<table>` | Word table via `_html_table_to_docx()` |
| `<p>`, `<br>`, other | `doc.add_paragraph(stripped_text)` |

3. Serialises the `Document` object to an in-memory `BytesIO` buffer.
4. Returns the buffer contents as `bytes`.

**Does not write to disk.** Disk writing is StorageAgent's responsibility.

---

### `to_pdf(content_html: str, field_values: dict[str, str] = None) → bytes`

Produces a `.pdf` file from HTML content.

**Pipeline:**
1. Calls `ConversionAgent().fill_template()` to substitute placeholders.
2. Wraps the filled HTML in a full `<!DOCTYPE html>` document with embedded CSS:
   - Font: Arial, 12pt
   - Margins: 2 cm
   - Table borders and alternating header style
3. Passes the full HTML string to `weasyprint.HTML(string=…).write_pdf()`.
4. Returns the PDF bytes.

WeasyPrint is a local library — no network call is made.

---

### `_html_table_to_docx(doc, table_html) → None`  *(private)*

Parses `<table>…</table>` HTML and builds a `python-docx` table.

- Detects column count from the row with the most `<td>`/`<th>` cells.
- Creates a table with `"Table Grid"` style.
- First row cells map to data rows (header distinction relies on WeasyPrint for PDF; in DOCX the first row is not separately styled in v1).

---

## What the RenderAgent Must NOT Do

- Call TemplateAgent, StorageAgent, or ReviewerAgent.
- Write files to disk — return bytes only.
- Make any network calls.
- Apply business validation — that is the Reviewer's job.
- Accept format strings other than `"docx"` and `"pdf"` — format selection is validated upstream in the API layer.

---

## Output Format Reference

| Format | MIME type | File extension | Magic bytes |
|---|---|---|---|
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | `PK` (ZIP) |
| PDF | `application/pdf` | `.pdf` | `%PDF` |

---

## Dependencies

| Library | Usage |
|---|---|
| `python-docx` | Building `.docx` document objects |
| `weasyprint` | HTML → PDF rendering (local, no internet) |
| `io.BytesIO` (stdlib) | In-memory buffer for DOCX serialisation |
| `re` (stdlib) | HTML tag stripping for plain-text conversion |

### WeasyPrint system requirements

WeasyPrint requires native libraries. These are pre-installed in the Docker image. For bare-metal Linux, `install.sh` prints the required package names if WeasyPrint is not importable.

| Distro | Required packages |
|---|---|
| Debian/Ubuntu | `libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0 fonts-liberation` |
| RHEL/Fedora | `pango cairo gdk-pixbuf2 liberation-fonts` |

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Inline bold/italic in DOCX | Not preserved — DOCX output contains plain text only in v1 |
| Images | Not supported in any output format |
| Page breaks | Not inserted automatically |
| PDF font embedding | Uses system fonts; output may differ across machines |

---

## Testing

Key test scenarios:
- `to_docx` returns bytes starting with `PK` (valid ZIP/DOCX)
- `to_pdf` returns bytes starting with `%PDF`
- Both methods with an empty `field_values` dict do not raise
- Table HTML produces a table in DOCX output
- Unfilled `{{placeholder}}` tokens appear verbatim in the output (not stripped)
