# Pre-Commit Review Checklist

Run through this before committing any backend change.

## Architecture Compliance

- [ ] Does any worker method now call another worker directly? **(disallowed)**
- [ ] Does any new multi-step workflow bypass the ManagerAgent? **(disallowed)**
- [ ] Does any new export or save skip the ReviewerAgent gate? **(disallowed)**
- [ ] Does the ReviewerAgent modify any data it validates? **(disallowed)**

## Code Quality

- [ ] All new agent methods have full type hints (no bare `Any`)
- [ ] No `print()` statements — use `logging` if needed
- [ ] Line length ≤ 100 characters
- [ ] No new external HTTP calls (`requests`, `httpx`, `urllib`)

## Schema Consistency

- [ ] If `models.py` changed → `schemas.py` updated to match
- [ ] If `schemas.py` changed → `frontend/src/types/index.ts` updated
- [ ] If a new API route was added → `CLAUDE.md` API Routes table updated

## Reviewer Gate

- [ ] New template save paths call `review_template()`
- [ ] New export paths call `review_filled_html()` then `review_export_bytes()`
- [ ] New import paths call `review_template()` on converted output
- [ ] `ReviewResult.passed == False` → Manager raises `ValueError` → HTTP 422

## Tests

- [ ] New agent methods have at least one test per error/warning condition
- [ ] `reviewer_agent.py` changes have 100% branch coverage
- [ ] `pytest tests/ -v` passes with zero failures

## Documentation

- [ ] Affected `docs/roles/<agent>.md` updated in this same change
- [ ] If breaking change: version bumped in `main.py` + CHANGELOG entry added
