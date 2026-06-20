// Shared types and helpers for the page/section document editor.
// Used by both the Template editor and the Document editor via <DocEditor>.

export type SecType = 'header' | 'body' | 'footer'
export type Orientation = 'portrait' | 'landscape'
export interface Sec  { id: string; type: SecType; label: string; content: string }
export interface Page { id: string; orientation: Orientation; sections: Sec[] }

export const MAX_BODY = 5
export const MIN_BODY = 1

export const uid = () => Math.random().toString(36).slice(2, 10)
export const mkSec = (type: SecType, label: string): Sec => ({ id: uid(), type, label, content: '' })

export const bodyCount = (p: Page) => p.sections.filter(s => s.type === 'body').length

/** Build a fresh page's sections: mandatory Header, `bodyN` body sections (1–5), mandatory Footer. */
export function mkPageSections(bodyN: number): Sec[] {
  const n = Math.max(MIN_BODY, Math.min(MAX_BODY, bodyN))
  const secs: Sec[] = [mkSec('header', 'Header')]
  for (let i = 1; i <= n; i++) secs.push(mkSec('body', `Section ${i}`))
  secs.push(mkSec('footer', 'Footer'))
  return secs
}

/** Build a fresh portrait A4 page with `bodyN` body sections. */
export function mkPage(bodyN: number): Page {
  return { id: uid(), orientation: 'portrait', sections: mkPageSections(bodyN) }
}

/** Renumber body-section labels sequentially per page; header/footer keep their labels. */
export function normalize(pages: Page[]): Page[] {
  return pages.map(p => {
    let n = 0
    return { ...p, sections: p.sections.map(s => s.type === 'body' ? { ...s, label: `Section ${++n}` } : s) }
  })
}

export function serialize(pages: Page[]): string {
  return pages.map(p =>
    `<div class="doc-page" data-orientation="${p.orientation}">${
      p.sections.map(s =>
        `<div class="doc-sec" data-type="${s.type}" data-label="${encodeURIComponent(s.label)}">${s.content}</div>`
      ).join('')
    }</div>`
  ).join('')
}

export function deserialize(html: string): Page[] {
  if (!html?.trim()) return []
  const root = document.createElement('div')
  root.innerHTML = html
  const pageDivs = root.querySelectorAll('.doc-page')
  if (!pageDivs.length) {
    // Legacy/plain HTML — wrap into a single page with one body section.
    return [{ id: uid(), orientation: 'portrait', sections: [{ id: uid(), type: 'body', label: 'Section 1', content: html }] }]
  }
  return Array.from(pageDivs).map(pd => ({
    id: uid(),
    orientation: (pd.getAttribute('data-orientation') === 'landscape' ? 'landscape' : 'portrait') as Orientation,
    sections: Array.from(pd.querySelectorAll('.doc-sec')).map(sd => ({
      id: uid(),
      type: (sd.getAttribute('data-type') || 'body') as SecType,
      label: decodeURIComponent(sd.getAttribute('data-label') || 'Section'),
      content: sd.innerHTML,
    }))
  }))
}

export const SEC_BG: Record<SecType, string>      = { header: '#dbeafe', body: '#f0fdf4', footer: '#fce7f3' }
export const SEC_EDIT_BG: Record<SecType, string> = { header: '#eff6ff', body: '#fff',    footer: '#fdf4ff' }

// ── Component library (Panels view) ────────────────────────────────────────────
// Dragged from the palette and dropped into a section box; `html` is appended into
// the section's editable content. Plain HTML keeps it offline + export-friendly.

export const COMPONENT_MIME = 'application/x-dts-component'

export interface ComponentDef { id: string; label: string; icon: string; html: string }

const cell  = 'border:1px solid #e2e8f0;padding:8px;vertical-align:top;'
const panel = 'border:1px solid #e2e8f0;padding:12px;'

export const COMPONENTS: ComponentDef[] = [
  { id: 'text',   label: 'Text',      icon: 'T',  html: '<p>New text block</p>' },
  { id: 'image',  label: 'Image',     icon: '🖼', html: '<div style="border:1px dashed #94a3b8;padding:24px;text-align:center;color:#94a3b8;">🖼 Image</div>' },
  { id: 'table',  label: 'Table',     icon: '▦',  html: `<table style="border-collapse:collapse;width:100%;"><tbody><tr><td style="${cell}">&nbsp;</td><td style="${cell}">&nbsp;</td></tr><tr><td style="${cell}">&nbsp;</td><td style="${cell}">&nbsp;</td></tr></tbody></table>` },
  { id: 'header', label: 'Header',    icon: 'H',  html: '<h2>Heading</h2>' },
  { id: 'cols2',  label: '2 Columns', icon: '▥',  html: `<table style="border-collapse:collapse;width:100%;"><tbody><tr><td style="${cell}width:50%;">Column 1</td><td style="${cell}width:50%;">Column 2</td></tr></tbody></table>` },
  { id: 'rows2',  label: '2 Rows',    icon: '▤',  html: `<div style="${panel}margin-bottom:6px;">Row 1</div><div style="${panel}">Row 2</div>` },
  { id: 'panel4', label: '4 Panels',  icon: '⊞',  html: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">${[1,2,3,4].map(n => `<div style="${panel}">Panel ${n}</div>`).join('')}</div>` },
  { id: 'panel5', label: '5 Panels',  icon: '▦',  html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">${[1,2,3,4,5].map(n => `<div style="${panel}">Panel ${n}</div>`).join('')}</div>` },
]
