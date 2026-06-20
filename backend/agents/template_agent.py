"""Team Alpha — Core Engine: template CRUD, placeholder detection, versioning."""
import re
from typing import Any
from sqlalchemy.orm import Session
from models import Template, TemplateVersion
from schemas import FieldSchema, TemplateCreate, TemplateUpdate

PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


class TemplateAgent:
    def detect_fields(self, html: str) -> list[FieldSchema]:
        """Extract {{variable}} placeholders from HTML content."""
        names = list(dict.fromkeys(PLACEHOLDER_RE.findall(html)))
        return [
            FieldSchema(
                name=n,
                label=n.replace("_", " ").title(),
                field_type="text",
                required=False,
                default_value="",
            )
            for n in names
        ]

    def create(self, db: Session, data: TemplateCreate) -> Template:
        if not data.fields_json:
            data.fields_json = self.detect_fields(data.content_html)
        row = Template(
            name=data.name,
            description=data.description,
            category=data.category,
            content_html=data.content_html,
            fields_json=[f.model_dump() for f in data.fields_json],
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        self._snapshot(db, row)
        return row

    def update(self, db: Session, template: Template, data: TemplateUpdate) -> Template:
        if data.name is not None:
            template.name = data.name
        if data.description is not None:
            template.description = data.description
        if data.category is not None:
            template.category = data.category
        if data.content_html is not None:
            template.content_html = data.content_html
            detected = self.detect_fields(data.content_html)
            existing_names = {f["name"] for f in (template.fields_json or [])}
            for f in detected:
                if f.name not in existing_names:
                    template.fields_json = list(template.fields_json or []) + [f.model_dump()]
        if data.fields_json is not None:
            template.fields_json = [f.model_dump() for f in data.fields_json]
        db.commit()
        db.refresh(template)
        self._snapshot(db, template)
        return template

    def _snapshot(self, db: Session, template: Template) -> None:
        last = (
            db.query(TemplateVersion)
            .filter_by(template_id=template.id)
            .order_by(TemplateVersion.version_number.desc())
            .first()
        )
        version_number = (last.version_number + 1) if last else 1
        snap = TemplateVersion(
            template_id=template.id,
            version_number=version_number,
            content_html=template.content_html,
            fields_json=template.fields_json,
        )
        db.add(snap)
        db.commit()
