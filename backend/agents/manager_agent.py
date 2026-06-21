"""Manager Tier — orchestrates multi-step workflows across agent teams."""
from dataclasses import dataclass
from pathlib import Path
from sqlalchemy.orm import Session

from agents.storage_agent import StorageAgent
from agents.conversion_agent import ConversionAgent
from agents.template_agent import TemplateAgent
from agents.render_agent import RenderAgent
from agents.reviewer_agent import ReviewerAgent, ReviewResult
from schemas import TemplateCreate


@dataclass
class ImportOutcome:
    template_id: int
    name: str
    fields_detected: list[dict]
    message: str
    review: ReviewResult


@dataclass
class ExportOutcome:
    file_bytes: bytes
    suffix: str
    stored_filename: str
    export_path: str
    review: ReviewResult


class ManagerAgent:
    """
    Manager Tier: coordinates Team Alpha/Gamma agents end-to-end.
    Routes work, enforces the Reviewer gate, and surfaces warnings/errors.
    """

    def __init__(
        self,
        storage: StorageAgent,
        conversion: ConversionAgent,
        template: TemplateAgent,
        render: RenderAgent,
        reviewer: ReviewerAgent,
    ):
        self.storage = storage
        self.conversion = conversion
        self.template = template
        self.render = render
        self.reviewer = reviewer

    # ── Workflow 1: Import DOCX → Template ────────────────────────────────────

    def import_docx(self, file_bytes: bytes, original_name: str, db: Session) -> ImportOutcome:
        """
        Full pipeline:
          StorageAgent.save → ConversionAgent.docx_to_html
          → ReviewerAgent.review_template → TemplateAgent.create
        """
        stored_name, full_path = self.storage.save_upload(file_bytes, original_name)

        html, fields = self.conversion.docx_to_html(full_path)
        stem = Path(original_name).stem.replace("_", " ").replace("-", " ").title()
        fields_as_dicts = [f.model_dump() for f in fields]

        review = self.reviewer.review_template(stem, html, fields_as_dicts)

        create_data = TemplateCreate(
            name=stem,
            description=f"Imported from {original_name}",
            category="Imported",
            content_html=html,
            fields_json=fields,
        )
        tmpl = self.template.create(db, create_data)

        msg_parts = [f"Imported successfully. {len(fields)} placeholder(s) detected."]
        if review.warnings:
            msg_parts.append("Warnings: " + "; ".join(review.warnings))

        return ImportOutcome(
            template_id=tmpl.id,
            name=tmpl.name,
            fields_detected=fields_as_dicts,
            message=" ".join(msg_parts),
            review=review,
        )

    # ── Workflow 2: Fill + Export ─────────────────────────────────────────────

    def export_template(
        self,
        content_html: str,
        field_values: dict[str, str],
        fmt: str,
    ) -> ExportOutcome:
        """
        Full pipeline:
          ReviewerAgent.review_filled → RenderAgent.to_*
          → ReviewerAgent.review_bytes → StorageAgent.save_export
        """
        fill_review = self.reviewer.review_filled_html(content_html, field_values)

        if fmt == "docx":
            file_bytes = self.render.to_docx(content_html, field_values)
            suffix = "docx"
        else:
            file_bytes = self.render.to_pdf(content_html, field_values)
            suffix = "pdf"

        byte_review = self.reviewer.review_export_bytes(file_bytes, suffix)

        all_warnings = fill_review.warnings + byte_review.warnings
        all_errors = fill_review.errors + byte_review.errors
        combined_review = ReviewResult(
            passed=len(all_errors) == 0,
            warnings=all_warnings,
            errors=all_errors,
        )

        if not combined_review.passed:
            raise ValueError(f"Export review failed: {'; '.join(all_errors)}")

        stored_name, export_path = self.storage.save_export(file_bytes, suffix)

        return ExportOutcome(
            file_bytes=file_bytes,
            suffix=suffix,
            stored_filename=stored_name,
            export_path=export_path,
            review=combined_review,
        )

    # ── Workflow 3: Save/Update Template with review gate ────────────────────

    def save_template(
        self,
        db: Session,
        name: str,
        html: str,
        fields: list[dict],
        template_id: int | None = None,
        description: str = "",
        category: str = "General",
    ):
        """
        ReviewerAgent.review_template → TemplateAgent.create / update
        Raises ValueError if review errors are found.
        """
        review = self.reviewer.review_template(name, html, fields)
        if not review.passed:
            raise ValueError(f"Template review failed: {'; '.join(review.errors)}")

        from schemas import TemplateCreate, TemplateUpdate, FieldSchema
        field_objs = [FieldSchema(**f) for f in fields]

        if template_id is None:
            data = TemplateCreate(
                name=name, description=description, category=category,
                content_html=html, fields_json=field_objs,
            )
            return self.template.create(db, data), review
        else:
            from models import Template as TemplateModel
            tmpl = db.query(TemplateModel).filter(TemplateModel.id == template_id).first()
            if not tmpl:
                raise LookupError(f"Template {template_id} not found")
            data = TemplateUpdate(
                name=name, description=description, category=category,
                content_html=html, fields_json=field_objs,
            )
            return self.template.update(db, tmpl, data), review
