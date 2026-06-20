from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class FieldSchema(BaseModel):
    name: str
    label: str
    field_type: str = "text"
    required: bool = False
    default_value: str = ""


class TemplateCreate(BaseModel):
    name: str
    description: str = ""
    category: str = "General"
    content_html: str = ""
    fields_json: list[FieldSchema] = []


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    content_html: Optional[str] = None
    fields_json: Optional[list[FieldSchema]] = None


class TemplateOut(BaseModel):
    id: int
    name: str
    description: str
    category: str
    content_html: str
    fields_json: list[Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateVersionOut(BaseModel):
    id: int
    template_id: int
    version_number: int
    content_html: str
    fields_json: list[Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ExportRequest(BaseModel):
    format: str = "docx"
    field_values: dict[str, str] = {}


class ImportResult(BaseModel):
    template_id: int
    name: str
    fields_detected: list[FieldSchema]
    message: str


class UploadedDocumentOut(BaseModel):
    id: int
    filename: str
    original_name: str
    template_id: Optional[int]
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentCreate(BaseModel):
    name: str
    template_id: Optional[int] = None
    content_html: str = ""


class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    content_html: Optional[str] = None


class DocumentOut(BaseModel):
    id: int
    name: str
    template_id: Optional[int]
    content_html: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
