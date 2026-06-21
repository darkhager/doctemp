// Presentational building blocks for <DocEditor>.
import { useEffect, useRef } from 'react'
import { type Sec, type Page, SEC_BG, SEC_EDIT_BG, COMPONENTS, COMPONENT_MIME } from './editorUtils'

// ── Page thumbnail (Pages view, left panel) ────────────────────────────────────

interface ThumbProps {
  page: Page; index: number; selected: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: () => void
  onDrop: () => void
}
export function PageThumb({ page, index, selected, onClick, onContextMenu, onDragStart, onDrop }: ThumbProps) {
  return (
    <div
      draggable
      style={{ borderRadius: 4, marginBottom: 10, cursor: 'pointer', overflow: 'hidden', userSelect: 'none',
        border: selected ? '2px solid #38bdf8' : '1px solid #cbd5e1',
        background: selected ? '#f0f9ff' : '#fff' }}
      onClick={onClick} onContextMenu={onContextMenu}
      onDragStart={onDragStart} onDragOver={e => e.preventDefault()} onDrop={onDrop}
    >
      {page.sections.map(sec => (
        <div key={sec.id} style={{ padding: '3px 8px', fontSize: 10, overflow: 'hidden', whiteSpace: 'nowrap',
          background: SEC_BG[sec.type], borderBottom: '1px solid rgba(0,0,0,.05)' }}>
          {sec.label}
        </div>
      ))}
      <div style={{ padding: '3px 8px', fontSize: 10, color: '#94a3b8', background: '#f8fafc' }}>Page {index + 1}</div>
    </div>
  )
}

// ── Table-of-contents tree (TOC view, left panel) ──────────────────────────────

interface TocProps {
  pages: Page[]
  selectedPageId: string | null
  selectedSecId: string | null
  collapsed: Set<string>
  onToggle: (pageId: string) => void
  onSelectPage: (pageId: string) => void
  onSelectSection: (pageId: string, secId: string) => void
  onPageContextMenu: (e: React.MouseEvent, pageId: string) => void
  onSectionDragStart: (pageId: string, secId: string) => void
  onSectionDrop: (pageId: string, secId: string) => void
}
export function TocTree(p: TocProps) {
  return (
    <div>
      {p.pages.map((page, idx) => {
        const open = !p.collapsed.has(page.id)
        return (
          <div key={page.id} style={{ marginBottom: 4 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 4,
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: p.selectedPageId === page.id && !p.selectedSecId ? '#e0f2fe' : 'transparent',
                color: '#334155' }}
              onClick={() => { p.onToggle(page.id); p.onSelectPage(page.id) }}
              onContextMenu={e => p.onPageContextMenu(e, page.id)}
            >
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{open ? '▼' : '▶'}</span>
              Page {idx + 1}
            </div>
            {open && page.sections.map(sec => {
              const isBody = sec.type === 'body'
              const sel = p.selectedSecId === sec.id
              return (
                <div
                  key={sec.id}
                  draggable={isBody}
                  onClick={() => p.onSelectSection(page.id, sec.id)}
                  onDragStart={() => isBody && p.onSectionDragStart(page.id, sec.id)}
                  onDragOver={e => { if (isBody) e.preventDefault() }}
                  onDrop={() => isBody && p.onSectionDrop(page.id, sec.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 20px',
                    borderRadius: 4, cursor: isBody ? 'grab' : 'pointer', fontSize: 12,
                    color: sel ? '#0369a1' : '#64748b',
                    background: sel ? '#f0f9ff' : 'transparent' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: SEC_BG[sec.type], flexShrink: 0, border: '1px solid rgba(0,0,0,.1)' }} />
                  {sec.label}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Editable section box (main canvas) ─────────────────────────────────────────

interface BoxProps { sec: Sec; selected: boolean; grow: boolean; onChange: (html: string) => void }
export function SectionBox({ sec, selected, grow, onChange }: BoxProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Sync DOM from state only when it actually differs. While typing, onInput already set
  // state to the DOM's innerHTML, so this is a no-op (no caret jump). On undo/redo the
  // restored content differs, so the box refreshes to show it.
  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== sec.content) el.innerHTML = sec.content
  }, [sec.id, sec.content])

  // Accept a component dropped from the Panels palette: append its HTML, sync to state.
  function handleDrop(e: React.DragEvent) {
    const id = e.dataTransfer.getData(COMPONENT_MIME)
    if (!id) return
    e.preventDefault()
    const comp = COMPONENTS.find(c => c.id === id)
    const el = ref.current
    if (!comp || !el) return
    el.appendChild(document.createRange().createContextualFragment(comp.html))
    onChange(el.innerHTML)
  }

  const isHF = sec.type !== 'body'
  // Body sections grow to fill (and equally divide) the space between the fixed
  // header and footer; header/footer keep their natural height.
  return (
    <div
      id={`sec-${sec.id}`}
      style={{ border: selected ? '2px solid #38bdf8' : '1px solid #e2e8f0', borderRadius: 6,
        overflow: 'hidden', background: SEC_EDIT_BG[sec.type],
        boxShadow: selected ? '0 0 0 3px rgba(56,189,248,.2)' : 'none',
        ...(grow ? { flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' } : { flex: '0 0 auto' }) }}
    >
      {!isHF && (
        <div style={{ flex: '0 0 auto', padding: '5px 12px', fontSize: 11, fontWeight: 600, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid rgba(0,0,0,.05)' }}>
          {sec.label}
        </div>
      )}
      <div
        ref={ref}
        className="dts-editable"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={isHF ? sec.label : 'Drag components here'}
        onInput={e => onChange(e.currentTarget.innerHTML)}
        onDragOver={e => { if (e.dataTransfer.types.includes(COMPONENT_MIME)) e.preventDefault() }}
        onDrop={handleDrop}
        style={{ padding: '12px 14px', fontSize: 14, lineHeight: 1.7, color: '#1e293b', fontFamily: 'inherit',
          textAlign: isHF ? 'center' : 'left',
          ...(grow ? { flex: '1 1 auto', minHeight: 0, overflowY: 'auto' } : { minHeight: isHF ? 44 : 120 }) }}
      />
    </div>
  )
}

// ── Component library (Panels view, left panel) ────────────────────────────────

export function ComponentLibrary() {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>Component Library</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {COMPONENTS.map(c => (
          <div key={c.id}
            draggable
            onDragStart={e => { e.dataTransfer.setData(COMPONENT_MIME, c.id); e.dataTransfer.effectAllowed = 'copy' }}
            style={{ border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'grab',
              padding: '10px 6px', textAlign: 'center', userSelect: 'none' }}>
            <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 6, color: '#475569' }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Create-new-page bar (bottom of main canvas) ────────────────────────────────

export function CreatePageBar({ onCreate }: { onCreate: (bodyN: number) => void }) {
  return (
    <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: 8, paddingTop: 20, textAlign: 'center' }}>
      <button onClick={() => onCreate(1)}
        style={{ padding: '10px 24px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff',
          cursor: 'pointer', fontSize: 14, color: '#334155', fontWeight: 600 }}>
        + Create New Page
      </button>
    </div>
  )
}
