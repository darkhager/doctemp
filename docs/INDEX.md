# Doc Template Studio — Documentation Index

## Company Policy
- [COMPANY_POLICY.md](COMPANY_POLICY.md) — Mission, org structure, code standards, review policy, deployment, testing, glossary

---

## Agent Role Docs

| Agent | Tier | File |
|---|---|---|
| [ManagerAgent](roles/manager_agent.md) | Manager | `backend/agents/manager_agent.py` |
| [ReviewerAgent](roles/reviewer_agent.md) | Reviewer | `backend/agents/reviewer_agent.py` |
| [TemplateAgent](roles/template_agent.md) | Worker | `backend/agents/template_agent.py` |
| [ConversionAgent](roles/conversion_agent.md) | Worker | `backend/agents/conversion_agent.py` |
| [RenderAgent](roles/render_agent.md) | Worker | `backend/agents/render_agent.py` |
| [StorageAgent](roles/storage_agent.md) | Worker | `backend/agents/storage_agent.py` |

---

## Team Charters

| Team | Charter | Scope |
|---|---|---|
| Team Alpha — Core Engine | [team_alpha.md](teams/team_alpha.md) | API routes, Manager, Reviewer, Template/Conversion/Render agents |
| Team Beta — Editor Experience | [team_beta.md](teams/team_beta.md) | React frontend, TipTap editor, FillForm, TemplateLibrary |
| Team Gamma — Data & Storage | [team_gamma.md](teams/team_gamma.md) | SQLite schema, models, StorageAgent, file retention |
| Team Delta — DevOps & Packaging | [team_delta.md](teams/team_delta.md) | Docker, docker-compose, install.sh, env config |

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│  API Layer  (main.py)                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
            ┌───────────▼────────────┐
            │     MANAGER TIER       │  ← manager_agent.md
            │     ManagerAgent       │
            └──────┬──────────┬──────┘
                   │          │
          ┌────────▼───────┐  ┌──▼────────────────┐
          │  WORKER TIER   │  │  REVIEWER TIER    │  ← reviewer_agent.md
          │                │  │  ReviewerAgent    │
          │ TemplateAgent  │  └───────────────────┘
          │ ConversionAgent│
          │ RenderAgent    │
          │ StorageAgent   │
          └────────────────┘
```
