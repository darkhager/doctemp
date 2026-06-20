# Add a New Agent Method

Use this checklist whenever adding a new method to any agent class.

## Steps

1. **Identify the owning agent** — which domain does this belong to?
   - Template CRUD / field detection → `template_agent.py`
   - DOCX ↔ HTML conversion → `conversion_agent.py`
   - DOCX/PDF rendering → `render_agent.py`
   - File I/O (uploads/exports) → `storage_agent.py`
   - Multi-step workflow → `manager_agent.py`
   - Quality validation → `reviewer_agent.py`

2. **Implement the method** — type-hint all parameters and return values. No `Any`.

3. **Follow single-responsibility** — the method must not call agents outside its tier:
   - Worker methods: no calls to other workers
   - Reviewer methods: no DB reads/writes, no agent calls
   - Manager methods: no domain logic — delegate to workers

4. **Wire through the Manager** (if multi-step):
   - Add an orchestration method in `manager_agent.py`
   - Add a ReviewerAgent gate before returning results
   - Expose via a new route in `main.py`

5. **Update the role doc** — `docs/roles/<agent_name>.md` must reflect the new method in the same change.

6. **Write tests** in `backend/tests/test_api.py`:
   - One test for the passing/happy-path case
   - One test per error condition
   - One test per distinct warning condition
   - For `reviewer_agent.py` changes: 100% branch coverage required

7. **Run tests before finishing:**
   ```bash
   cd backend
   source venv/bin/activate  # Windows: venv\Scripts\Activate.ps1
   pytest tests/ -v
   ```

## ReviewerAgent check template

When adding a new check to `reviewer_agent.py`:

```python
# Error (blocks operation):
if <condition_that_produces_unusable_output>:
    errors.append("Descriptive error message")

# Warning (non-blocking):
if <condition_that_produces_incomplete_but_usable_output>:
    warnings.append("Descriptive warning message")
```
