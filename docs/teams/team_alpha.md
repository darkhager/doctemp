# Team Alpha — Core Engine

**Code name:** Alpha  
**Focus area:** Backend API, agent orchestration, document processing  
**Tier coverage:** Manager tier, Reviewer tier, Worker tier (Template, Conversion, Render)

---

## Charter

Team Alpha owns the intelligence of the application. This includes the FastAPI route layer, all document-processing agents, the Manager and Reviewer tiers, and the schema contracts that the frontend depends on. Any feature that changes how documents are parsed, filled, reviewed, or exported is Team Alpha's responsibility.

---

## Files Owned

| File | Role |
|---|---|
| `backend/main.py` | API route definitions and agent wiring |
| `backend/schemas.py` | Pydantic request/response contracts |
| `backend/agents/manager_agent.py` | Manager tier — pipeline orchestration |
| `backend/agents/reviewer_agent.py` | Reviewer tier — quality gate |
| `backend/agents/template_agent.py` | Worker — template CRUD and field detection |
| `backend/agents/conversion_agent.py` | Worker — DOCX ↔ HTML conversion |
| `backend/agents/render_agent.py` | Worker — DOCX/PDF export rendering |
| `backend/tests/test_api.py` | All backend unit and integration tests |

---

## Team Members & Sub-roles

| Sub-role | Responsibility |
|---|---|
| Backend Lead | Owns `main.py`, `schemas.py`, architecture decisions |
| Agent Developer | Owns individual agent files, implements new agent methods |
| QA / Test Engineer | Owns `tests/`, writes and maintains pytest coverage |

---

## Workflow

1. **Feature request** arrives as a ticket with acceptance criteria.
2. Backend Lead assigns the agent file(s) that need changing.
3. Agent Developer implements, writes tests.
4. QA verifies test coverage meets policy minimums (`COMPANY_POLICY.md` §9).
5. Backend Lead reviews — checks for Manager/Reviewer gate compliance.
6. Merge only when `pytest tests/ -v` passes clean.

---

## Interfaces with Other Teams

| Team | Interface |
|---|---|
| Team Beta (Frontend) | `schemas.py` defines the API contract. Schema changes require Beta review. |
| Team Gamma (Storage) | Alpha calls `StorageAgent` for file I/O. Gamma owns the agent; Alpha does not modify it. |
| Team Delta (DevOps) | Alpha provides `requirements.txt`; Delta consumes it in Dockerfile. |

---

## Standards & Constraints

- All agent methods must have full type hints.
- No worker agent may call another worker agent directly.
- All multi-step workflows must be routed through `ManagerAgent`.
- All outputs must pass through `ReviewerAgent` before being returned to the API layer.
- `reviewer_agent.py` and `manager_agent.py` changes require Engineering Lead sign-off.

---

## Key APIs Owned

```
POST   /api/templates/               create_template
GET    /api/templates/               list_templates
GET    /api/templates/{id}           get_template
PUT    /api/templates/{id}           update_template
DELETE /api/templates/{id}           delete_template
POST   /api/templates/{id}/duplicate duplicate_template
GET    /api/templates/{id}/fields    get_fields
GET    /api/templates/{id}/versions  list_versions
POST   /api/templates/{id}/restore/{vid}
POST   /api/templates/import-docx
POST   /api/templates/{id}/export
GET    /api/categories
```
