# Doc Template Studio — Architecture Rules

Apply these rules whenever you make any change to the backend.

## 3-Tier Architecture

```
API Layer (main.py)
    ↓ only calls ManagerAgent
ManagerAgent
    ↓ delegates + enforces ReviewerAgent gate
WorkerAgents (Template / Conversion / Render / Storage)
    ↑ never call each other
ReviewerAgent (stateless quality gate — never modifies data)
```

## Hard Rules

1. **Workers never call other workers.** All cross-worker coordination routes through ManagerAgent.
2. **ReviewerAgent gate is mandatory.** Every template save, every export, every import must pass through ReviewerAgent. Never skip or bypass it.
3. **ReviewerAgent is read-only.** It detects and reports; it never modifies data.
4. **Manager does not implement domain logic.** It sequences and delegates; workers do the work.
5. **Workers do not write HTTP responses.** They raise Python exceptions only. HTTP errors are the API layer's job.
6. **No external HTTP calls anywhere.** The app is 100% offline.

## File Ownership — Who to Change

| File | Owner | Extra approval needed? |
|---|---|---|
| `backend/main.py` | Team Alpha | If adding new routes |
| `backend/schemas.py` | Team Alpha | If API contract changes |
| `backend/agents/manager_agent.py` | Team Alpha | Engineering Lead |
| `backend/agents/reviewer_agent.py` | Team Alpha | Engineering Lead |
| `backend/agents/template_agent.py` | Team Alpha | No |
| `backend/agents/conversion_agent.py` | Team Alpha | No |
| `backend/agents/render_agent.py` | Team Alpha | No |
| `backend/agents/storage_agent.py` | Team Gamma | No |
| `backend/models.py` | Team Gamma | Gamma Lead |
| `frontend/src/` | Team Beta | If API contract changes |

## ReviewResult Contract

```python
@dataclass
class ReviewResult:
    passed: bool        # False only when errors is non-empty
    warnings: list[str] # non-blocking — operation continues
    errors: list[str]   # blocking — Manager raises ValueError → HTTP 422
```
