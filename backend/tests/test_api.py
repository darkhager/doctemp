import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

TEST_DB = "sqlite:///./test_templates.sqlite"
engine_test = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine_test)
    yield
    Base.metadata.drop_all(bind=engine_test)


client = TestClient(app)


def test_create_and_list_template():
    r = client.post("/api/templates/", json={"name": "Invoice", "content_html": "<p>Dear {{client_name}}</p>"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Invoice"
    assert any(f["name"] == "client_name" for f in data["fields_json"])

    r2 = client.get("/api/templates/")
    assert r2.status_code == 200
    assert len(r2.json()) == 1


def test_update_template():
    r = client.post("/api/templates/", json={"name": "Letter"})
    tid = r.json()["id"]
    r2 = client.put(f"/api/templates/{tid}", json={"name": "Updated Letter"})
    assert r2.status_code == 200
    assert r2.json()["name"] == "Updated Letter"


def test_delete_template():
    r = client.post("/api/templates/", json={"name": "Temp"})
    tid = r.json()["id"]
    r2 = client.delete(f"/api/templates/{tid}")
    assert r2.status_code == 204
    assert client.get(f"/api/templates/{tid}").status_code == 404


def test_placeholder_detection():
    from agents.template_agent import TemplateAgent
    agent = TemplateAgent()
    fields = agent.detect_fields("<p>Hello {{first_name}} {{last_name}}</p>")
    names = [f.name for f in fields]
    assert names == ["first_name", "last_name"]


def test_fill_template():
    from agents.conversion_agent import ConversionAgent
    agent = ConversionAgent()
    result = agent.fill_template("<p>Hello {{name}}</p>", {"name": "Alice"})
    assert result == "<p>Hello Alice</p>"


def test_duplicate_template():
    r = client.post("/api/templates/", json={"name": "Base"})
    tid = r.json()["id"]
    r2 = client.post(f"/api/templates/{tid}/duplicate")
    assert r2.status_code == 201
    assert "copy" in r2.json()["name"]


# ── Reviewer Agent tests ───────────────────────────────────────────────────────

def test_reviewer_passes_valid_template():
    from agents.reviewer_agent import ReviewerAgent
    r = ReviewerAgent().review_template("Invoice", "<p>Dear {{client_name}}</p>", [{"name": "client_name", "label": "Client Name", "field_type": "text", "required": False, "default_value": ""}])
    assert r.passed
    assert r.errors == []


def test_reviewer_fails_empty_name():
    from agents.reviewer_agent import ReviewerAgent
    r = ReviewerAgent().review_template("", "<p>Hello</p>", [])
    assert not r.passed
    assert any("name" in e.lower() for e in r.errors)


def test_reviewer_fails_empty_content():
    from agents.reviewer_agent import ReviewerAgent
    r = ReviewerAgent().review_template("Test", "", [])
    assert not r.passed
    assert any("empty" in e.lower() for e in r.errors)


def test_reviewer_warns_orphaned_placeholder():
    from agents.reviewer_agent import ReviewerAgent
    r = ReviewerAgent().review_template("Test", "<p>{{missing_field}}</p>", [])
    assert r.passed
    assert any("missing_field" in w for w in r.warnings)


def test_reviewer_flags_unfilled_export():
    from agents.reviewer_agent import ReviewerAgent
    r = ReviewerAgent().review_filled_html("<p>Hello {{name}}</p>", {})
    assert r.passed
    assert any("unfilled" in w.lower() for w in r.warnings)


def test_reviewer_validates_export_bytes():
    from agents.reviewer_agent import ReviewerAgent
    r = ReviewerAgent().review_export_bytes(b"", "docx")
    assert not r.passed


# ── Manager Agent tests ───────────────────────────────────────────────────────

def test_manager_rejects_empty_template():
    r = client.post("/api/templates/", json={"name": "", "content_html": ""})
    assert r.status_code == 422


def test_manager_save_workflow():
    r = client.post("/api/templates/", json={
        "name": "Contract",
        "content_html": "<p>This agreement between {{party_a}} and {{party_b}}.</p>",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Contract"
    field_names = [f["name"] for f in data["fields_json"]]
    assert "party_a" in field_names
    assert "party_b" in field_names
