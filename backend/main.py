import os
import uuid
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import engine, get_db, Base
from models import Template, TemplateVersion, UploadedDocument, Document
from schemas import (
    TemplateCreate, TemplateUpdate, TemplateOut, TemplateVersionOut,
    ExportRequest, ImportResult,
    DocumentCreate, DocumentUpdate, DocumentOut,
    FieldSchema,
)
from agents.template_agent import TemplateAgent
from agents.conversion_agent import ConversionAgent
from agents.render_agent import RenderAgent
from agents.reviewer_agent import ReviewerAgent

Base.metadata.create_all(bind=engine)

_HERE = Path(__file__).parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(_HERE / "uploads")))
EXPORT_DIR = Path(os.getenv("EXPORT_DIR", str(_HERE / "exports")))
STATIC_DIR = os.getenv("STATIC_DIR", str(_HERE / "static"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Doc Template Studio API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

template_agent = TemplateAgent()
conversion_agent = ConversionAgent()
render_agent = RenderAgent()
reviewer = ReviewerAgent()


# ── Storage helpers ───────────────────────────────────────────────────────────

def _save_upload(data: bytes, original_name: str) -> Path:
    path = UPLOAD_DIR / f"{uuid.uuid4().hex}{Path(original_name).suffix}"
    path.write_bytes(data)
    return path

def _save_export(data: bytes, suffix: str) -> Path:
    path = EXPORT_DIR / f"{uuid.uuid4().hex}.{suffix}"
    path.write_bytes(data)
    return path


# ── Review + save helper ──────────────────────────────────────────────────────

def _reviewed_save(db, name, html, fields, template_id=None, description="", category="General"):
    review = reviewer.review_template(name, html, fields)
    if not review.passed:
        raise ValueError(f"Template review failed: {'; '.join(review.errors)}")
    field_objs = [FieldSchema(**f) for f in fields]
    if template_id is None:
        return template_agent.create(db, TemplateCreate(
            name=name, description=description, category=category,
            content_html=html, fields_json=field_objs,
        ))
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t:
        raise LookupError(f"Template {template_id} not found")
    return template_agent.update(db, t, TemplateUpdate(
        name=name, description=description, category=category,
        content_html=html, fields_json=field_objs,
    ))


# ── Export helper ─────────────────────────────────────────────────────────────

def _export_file(content_html: str, field_values: dict, fmt: str, label: str) -> FileResponse:
    fill_review = reviewer.review_filled_html(content_html, field_values)
    file_bytes = (render_agent.to_docx(content_html, field_values)
                  if fmt == "docx" else render_agent.to_pdf(content_html, field_values))
    byte_review = reviewer.review_export_bytes(file_bytes, fmt)
    errors = fill_review.errors + byte_review.errors
    if errors:
        raise ValueError(f"Export review failed: {'; '.join(errors)}")
    path = _save_export(file_bytes, fmt)
    mime = ("application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            if fmt == "docx" else "application/pdf")
    return FileResponse(path=str(path), media_type=mime, filename=f"{label.replace(' ', '_')}.{fmt}")


# ── Templates ─────────────────────────────────────────────────────────────────

@app.post("/api/templates/", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    try:
        return _reviewed_save(db, data.name, data.content_html,
                              [f.model_dump() for f in data.fields_json],
                              description=data.description, category=data.category)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/templates/", response_model=list[TemplateOut])
def list_templates(category: str | None = None, search: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Template)
    if category: q = q.filter(Template.category == category)
    if search:   q = q.filter(Template.name.ilike(f"%{search}%"))
    return q.order_by(Template.updated_at.desc()).all()


@app.get("/api/templates/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t: raise HTTPException(status_code=404, detail="Template not found")
    return t


@app.put("/api/templates/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t: raise HTTPException(status_code=404, detail="Template not found")
    new_fields = [f.model_dump() for f in data.fields_json] if data.fields_json is not None else (t.fields_json or [])
    try:
        return _reviewed_save(
            db,
            data.name        if data.name        is not None else t.name,
            data.content_html if data.content_html is not None else t.content_html,
            new_fields, template_id=template_id,
            description=data.description if data.description is not None else t.description,
            category   =data.category    if data.category    is not None else t.category,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/api/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t: raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t); db.commit()


@app.post("/api/templates/{template_id}/duplicate", response_model=TemplateOut, status_code=201)
def duplicate_template(template_id: int, db: Session = Depends(get_db)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t: raise HTTPException(status_code=404, detail="Template not found")
    return template_agent.create(db, TemplateCreate(
        name=f"{t.name} (copy)", description=t.description, category=t.category,
        content_html=t.content_html, fields_json=t.fields_json or [],
    ))


@app.get("/api/templates/{template_id}/fields")
def get_fields(template_id: int, db: Session = Depends(get_db)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t: raise HTTPException(status_code=404, detail="Template not found")
    return t.fields_json or []


@app.get("/api/templates/{template_id}/versions", response_model=list[TemplateVersionOut])
def list_versions(template_id: int, db: Session = Depends(get_db)):
    return (db.query(TemplateVersion).filter(TemplateVersion.template_id == template_id)
            .order_by(TemplateVersion.version_number.desc()).all())


@app.post("/api/templates/{template_id}/restore/{version_id}", response_model=TemplateOut)
def restore_version(template_id: int, version_id: int, db: Session = Depends(get_db)):
    t = db.query(Template).filter(Template.id == template_id).first()
    v = db.query(TemplateVersion).filter(
        TemplateVersion.id == version_id, TemplateVersion.template_id == template_id).first()
    if not t or not v: raise HTTPException(status_code=404, detail="Not found")
    return template_agent.update(db, t, TemplateUpdate(content_html=v.content_html, fields_json=v.fields_json))


@app.post("/api/templates/import-docx", response_model=ImportResult, status_code=201)
async def import_docx(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")
    try:
        full_path = _save_upload(await file.read(), file.filename)
        html, fields = conversion_agent.docx_to_html(full_path)
        stem = Path(file.filename).stem.replace("_", " ").replace("-", " ").title()
        fields_dicts = [f.model_dump() for f in fields]
        review = reviewer.review_template(stem, html, fields_dicts)
        tmpl = template_agent.create(db, TemplateCreate(
            name=stem, description=f"Imported from {file.filename}",
            category="Imported", content_html=html, fields_json=fields,
        ))
        db.add(UploadedDocument(filename=file.filename, original_name=file.filename, template_id=tmpl.id))
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    msg = f"Imported successfully. {len(fields)} placeholder(s) detected."
    if review.warnings:
        msg += " Warnings: " + "; ".join(review.warnings)
    return ImportResult(template_id=tmpl.id, name=tmpl.name, fields_detected=fields_dicts, message=msg)


@app.post("/api/templates/{template_id}/export")
async def export_template(template_id: int, request: ExportRequest, db: Session = Depends(get_db)):
    t = db.query(Template).filter(Template.id == template_id).first()
    if not t: raise HTTPException(status_code=404, detail="Template not found")
    fmt = request.format.lower()
    if fmt not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'docx' or 'pdf'.")
    try:
        return _export_file(t.content_html, request.field_values, fmt, t.name)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")


# ── Documents ─────────────────────────────────────────────────────────────────

@app.post("/api/documents/", response_model=DocumentOut, status_code=201)
def create_document(data: DocumentCreate, db: Session = Depends(get_db)):
    doc = Document(name=data.name, template_id=data.template_id, content_html=data.content_html)
    db.add(doc); db.commit(); db.refresh(doc)
    return doc


@app.get("/api/documents/", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)):
    return db.query(Document).order_by(Document.updated_at.desc()).all()


@app.get("/api/documents/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    return doc


@app.put("/api/documents/{doc_id}", response_model=DocumentOut)
def update_document(doc_id: int, data: DocumentUpdate, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    if data.name is not None:         doc.name = data.name
    if data.content_html is not None: doc.content_html = data.content_html
    db.commit(); db.refresh(doc)
    return doc


@app.delete("/api/documents/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc); db.commit()


@app.post("/api/documents/{doc_id}/copy", response_model=DocumentOut, status_code=201)
def copy_document(doc_id: int, db: Session = Depends(get_db)):
    src = db.query(Document).filter(Document.id == doc_id).first()
    if not src: raise HTTPException(status_code=404, detail="Document not found")
    copy = Document(name=f"{src.name} (copy)", template_id=src.template_id, content_html=src.content_html)
    db.add(copy); db.commit(); db.refresh(copy)
    return copy


@app.post("/api/documents/{doc_id}/export")
async def export_document(doc_id: int, request: ExportRequest, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    fmt = request.format.lower()
    if fmt not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="Unsupported format")
    try:
        return _export_file(doc.content_html, request.field_values, fmt, doc.name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")


# ── Categories ────────────────────────────────────────────────────────────────

@app.get("/api/categories")
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Template.category).distinct().all()
    return sorted({r[0] for r in rows if r[0]})


# ── Static frontend ───────────────────────────────────────────────────────────

static_path = Path(STATIC_DIR)
if static_path.exists() and any(static_path.iterdir()):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
