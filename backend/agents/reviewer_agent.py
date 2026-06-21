"""Reviewer Tier — validates outputs before they leave the system."""
import re
from dataclasses import dataclass, field

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")
UNFILLED_RE = re.compile(r"\{\{\s*\w+\s*\}\}")


@dataclass
class ReviewResult:
    passed: bool
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)



class ReviewerAgent:
    """Reviewer Tier: checks templates and exports for quality issues."""

    def review_template(self, name: str, html: str, fields: list[dict]) -> ReviewResult:
        """Review a template before it is saved or returned."""
        warnings: list[str] = []
        errors: list[str] = []

        if not name or not name.strip():
            errors.append("Template name must not be empty.")

        stripped = re.sub(r"<[^>]+>", "", html).strip()
        if not stripped:
            errors.append("Template content is empty.")
        elif len(stripped) < 10:
            warnings.append("Template content is very short — may not produce a useful document.")

        detected_names = set(PLACEHOLDER_RE.findall(html))
        declared_names = {f["name"] for f in fields}

        orphaned = detected_names - declared_names
        if orphaned:
            warnings.append(
                f"Placeholder(s) found in content but not in field list: {', '.join(sorted(orphaned))}. "
                "They will still be substituted but won't appear in the fill form."
            )

        declared_but_missing = declared_names - detected_names
        if declared_but_missing:
            warnings.append(
                f"Field(s) declared but not used in template content: {', '.join(sorted(declared_but_missing))}."
            )

        return ReviewResult(passed=len(errors) == 0, warnings=warnings, errors=errors)

    def review_filled_html(self, html: str, field_values: dict[str, str]) -> ReviewResult:
        """Review filled HTML before export — flag any unfilled placeholders."""
        warnings: list[str] = []
        errors: list[str] = []

        unfilled = UNFILLED_RE.findall(html)
        if unfilled:
            warnings.append(
                f"Export contains {len(unfilled)} unfilled placeholder(s): "
                f"{', '.join(dict.fromkeys(unfilled))}. They will appear as-is in the document."
            )

        empty_fields = [k for k, v in field_values.items() if not v.strip()]
        if empty_fields:
            warnings.append(f"Field(s) left blank: {', '.join(empty_fields)}.")

        return ReviewResult(passed=True, warnings=warnings, errors=errors)

    def review_export_bytes(self, data: bytes, fmt: str) -> ReviewResult:
        """Review exported file bytes for basic validity."""
        warnings: list[str] = []
        errors: list[str] = []

        if not data:
            errors.append(f"Exported {fmt.upper()} file is empty.")
        elif fmt == "docx" and not data.startswith(b"PK"):
            errors.append("Exported DOCX does not appear to be a valid ZIP/DOCX file.")
        elif fmt == "pdf" and not data.startswith(b"%PDF"):
            errors.append("Exported PDF does not start with a valid PDF header.")

        if len(data) < 500:
            warnings.append(f"Exported {fmt.upper()} file is unusually small ({len(data)} bytes).")

        return ReviewResult(passed=len(errors) == 0, warnings=warnings, errors=errors)
