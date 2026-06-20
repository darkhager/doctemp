# Team Beta — Editor Experience

**Code name:** Beta  
**Focus area:** Frontend React application, user interface, UX flows  
**Tier coverage:** Presentation layer only (no backend agent ownership)

---

## Charter

Team Beta owns everything the user sees and interacts with. This includes the WYSIWYG template editor, the template library browser, the fill form, and the document preview. Team Beta translates the backend API contract into a seamless in-browser experience without any business logic that duplicates what the backend already enforces.

---

## Files Owned

| File / Directory | Description |
|---|---|
| `frontend/src/` | All React/TypeScript source |
| `frontend/src/App.tsx` | Root router and layout wiring |
| `frontend/src/main.tsx` | React entry point |
| `frontend/src/api/client.ts` | Axios API wrappers — the only place that calls `/api/…` |
| `frontend/src/types/index.ts` | Shared TypeScript interfaces |
| `frontend/src/components/Layout/` | Sidebar navigation, shell layout |
| `frontend/src/components/TemplateLibrary/` | Browse, search, import, delete |
| `frontend/src/components/Editor/` | TipTap editor, toolbar, fields sidebar |
| `frontend/src/components/FillForm/` | Dynamic fill form, export buttons, preview tab |
| `frontend/src/components/Preview/` | Read-only rendered document preview |
| `frontend/index.html` | HTML shell |
| `frontend/vite.config.ts` | Vite build config (proxy, output dir) |
| `frontend/package.json` | NPM dependencies |
| `frontend/tsconfig.json` | TypeScript config |

---

## Team Members & Sub-roles

| Sub-role | Responsibility |
|---|---|
| Frontend Lead | Owns component architecture, routing, API client design |
| UI Developer | Implements components, styles, interactions |
| UX / QA | Reviews flows end-to-end in the browser, files UI bugs |

---

## Workflow

1. Feature ticket arrives with a UI/UX description and the API endpoint(s) it uses.
2. Frontend Lead confirms the endpoint contract with Team Alpha (`schemas.py`).
3. UI Developer implements the component and wires up `api/client.ts`.
4. UX/QA opens the app in the browser and walks through the golden path and edge cases.
5. Frontend Lead reviews the code — checks TypeScript strict compliance, no `any` casts.
6. Merge only after manual browser verification passes.

---

## Interfaces with Other Teams

| Team | Interface |
|---|---|
| Team Alpha | Consumes API endpoints; must not add logic that duplicates backend validation |
| Team Gamma | No direct interface |
| Team Delta | Vite build output goes to `backend/static/` (configured in `vite.config.ts`); Delta serves it |

---

## Standards & Constraints

- TypeScript strict mode is always on. No `// @ts-ignore` or `as any`.
- All API calls must go through `api/client.ts`. No `fetch()` or `axios` calls in components.
- No business logic in components — validation, field detection, and review logic live in the backend.
- Placeholder highlight in the fill-form preview is purely cosmetic CSS — not a validation gate.
- The frontend must work correctly at `http://localhost:8000` (production static build) and `http://localhost:5173` (Vite dev server). Both environments use the same component code.

---

## Key Components

### `TemplateLibrary`
- Fetches and displays all templates in a card grid.
- Supports search and category filter.
- Triggers `.docx` import via file input → `templatesApi.importDocx()`.

### `EditorPage`
- Hosts the TipTap WYSIWYG editor.
- Toolbar (`EditorToolbar`) provides formatting and table insertion.
- `FieldsSidebar` detects `{{placeholders}}` live from editor HTML and lets the user insert new ones.
- Saves via `templatesApi.create()` or `templatesApi.update()`.

### `FillFormPage`
- Renders one input per field in `template.fields_json`.
- "Preview" tab shows filled HTML with highlights via `dangerouslySetInnerHTML`.
- "Export .docx" and "Export .pdf" buttons call `templatesApi.export()` which triggers a file download.

### `Preview`
- Stateless component. Renders `html` prop with `dangerouslySetInnerHTML`.
- Used inside `FillFormPage`'s preview tab.

---

## Build Artefact

`npm run build` produces a production bundle in `../backend/static/` (one level above `frontend/`).  
FastAPI serves this directory as static files when running in production mode.  
Team Beta is responsible for ensuring the build succeeds without TypeScript errors (`tsc && vite build`).
