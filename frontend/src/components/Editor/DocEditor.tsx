import { useState, useEffect, useRef } from 'react'
import './editor.css'
import {
  type Page, type Orientation, uid, mkSec, mkPage, serialize, normalize, bodyCount, MAX_BODY,
} from './editorUtils'
import { PageThumb, TocTree, SectionBox, CreatePageBar, ComponentLibrary } from './EditorShared'

export interface DocEditorProps {
  initialName: string
  initialPages: Page[]
  saveLabel: string
  saveColor: string
  badge?: string | null
  onSave: (name: string, html: string) => Promise<void>
}

type View = 'pages' | 'toc' | 'panels'
type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error'

const PX_PER_MM = 96 / 25.4   // CSS px per millimetre at 96dpi

const AUTOSAVE_TEXT: Record<SaveStatus, string> = {
  saved: '✓ Saved', dirty: '● Unsaved changes', saving: '⟳ Saving…', error: '⚠ Save failed',
}

const s: Record<string, React.CSSProperties> = {
  shell:      { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' },
  toolbar:    { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  nameInput:  { fontSize: 15, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 10px', outline: 'none', minWidth: 200, color: '#1e293b', background: '#f8fafc' },
  btn:        { padding: '5px 12px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 13, color: '#475569' },
  count:      { fontSize: 12, color: '#64748b', background: '#f1f5f9', padding: '4px 10px', borderRadius: 4 },
  autosave:   { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, padding: '5px 14px', borderRadius: 4 },
  badge:      { fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 },
  body:       { display: 'flex', flex: 1, overflow: 'hidden' },
  leftPanel:  { width: 200, borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  leftTabs:   { display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 8px', borderBottom: '1px solid #e2e8f0' },
  tabRow:     { display: 'flex', alignItems: 'center', gap: 4 },
  tab:        { flex: 1, padding: '5px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  gear:       { padding: '5px 8px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 },
  popover:    { position: 'absolute', top: 44, right: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 150, minWidth: 150 },
  popItem:    { display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#334155' },
  leftScroll: { flex: 1, overflowY: 'auto', padding: '10px 8px' },
  hint:       { padding: '6px 10px 12px', fontSize: 10, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-line' },
  rightPanel: { flex: 1, overflow: 'auto', padding: '28px 24px', background: '#e5e7eb' },
  pageLabel:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 },
  sheet:      { background: '#fff', padding: '20mm', borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,.12)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '5mm' },
  sheetSel:   { boxShadow: '0 0 0 2px #38bdf8, 0 1px 8px rgba(0,0,0,.12)' },
  orientBtn:  { fontSize: 11, padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#475569', fontWeight: 500 },
  empty:      { textAlign: 'center', color: '#94a3b8', fontSize: 14, padding: '20px 0' },
  ctxItem:    { display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#334155' },
}

export default function DocEditor({ initialName, initialPages, saveLabel, saveColor, badge, onSave }: DocEditorProps) {
  const [docName, setDocName]       = useState(initialName)
  const [pages, setPages]           = useState<Page[]>(initialPages)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(initialPages[0]?.id ?? null)
  const [selectedSecId, setSelectedSecId]   = useState<string | null>(null)
  const [view, setView]             = useState<View>('pages')
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())
  const [status, setStatus]         = useState<SaveStatus>('saved')
  const [gearOpen, setGearOpen]     = useState(false)
  const [ctxMenu, setCtxMenu]       = useState<{ x: number; y: number; pageId: string } | null>(null)
  const [scrollTo, setScrollTo]     = useState<{ type: 'page' | 'sec'; id: string } | null>(null)
  const [panelW, setPanelW]         = useState(0)   // canvas content width, for fit-to-width zoom
  const panelRef = useRef<HTMLDivElement>(null)

  // History (pages only) via refs to avoid stale closures.
  const hist        = useRef<Page[][]>([initialPages])
  const histIdx     = useRef(0)
  const lastContent = useRef(false)   // was the previous commit a coalescible content edit?

  // coalesce=true collapses consecutive content edits into one undo step (Word-like),
  // so undo jumps back to a checkpoint rather than one keystroke at a time.
  function commit(next: Page[], coalesce = false) {
    if (coalesce && lastContent.current) {
      hist.current = [...hist.current.slice(0, histIdx.current), next]      // replace current entry
    } else {
      hist.current = [...hist.current.slice(0, histIdx.current + 1), next]  // push new entry
      histIdx.current = hist.current.length - 1
    }
    lastContent.current = coalesce
    setPages(next)
  }
  const commitStruct = (next: Page[]) => commit(normalize(next))
  const undo = () => { if (histIdx.current > 0) { histIdx.current--; lastContent.current = false; setPages(hist.current[histIdx.current]) } }
  const redo = () => { if (histIdx.current < hist.current.length - 1) { histIdx.current++; lastContent.current = false; setPages(hist.current[histIdx.current]) } }

  // Close menus on outside click.
  useEffect(() => {
    const h = () => { setCtxMenu(null); setGearOpen(false) }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  // Track the canvas width so A4 sheets can scale to fit it.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => { for (const e of entries) setPanelW(e.contentRect.width) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Scroll a page/section sheet into view — only when requested from the left panel
  // (navigation), not when clicking into the canvas to edit.
  useEffect(() => {
    if (!scrollTo) return
    const id = scrollTo.type === 'sec' ? `sec-${scrollTo.id}` : `page-${scrollTo.id}`
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: scrollTo.type === 'sec' ? 'center' : 'start' })
    setScrollTo(null)
  }, [scrollTo])

  // ── Page operations ──────────────────────────────────────────────────────────

  function addPage(bodyN: number) {
    const page = mkPage(bodyN)
    commitStruct([...pages, page])
    setSelectedPageId(page.id); setSelectedSecId(null)
    setScrollTo({ type: 'page', id: page.id })
  }

  function setPageOrientation(pageId: string, orientation: Orientation) {
    commitStruct(pages.map(p => p.id !== pageId ? p : { ...p, orientation }))
  }

  function deletePage(pageId: string) {
    const next = pages.filter(p => p.id !== pageId)
    commitStruct(next)
    if (selectedPageId === pageId) { setSelectedPageId(next[0]?.id ?? null); setSelectedSecId(null) }
  }

  function duplicatePage(pageId: string) {
    const src = pages.find(p => p.id === pageId); if (!src) return
    const copy: Page = { id: uid(), orientation: src.orientation, sections: src.sections.map(sec => ({ ...sec, id: uid() })) }
    const idx = pages.findIndex(p => p.id === pageId)
    const next = [...pages]; next.splice(idx + 1, 0, copy)
    commitStruct(next)
  }

  const dragPage = useRef<string | null>(null)
  function dropPage(targetId: string) {
    if (!dragPage.current || dragPage.current === targetId) return
    const from = pages.findIndex(p => p.id === dragPage.current)
    const to   = pages.findIndex(p => p.id === targetId)
    const next = [...pages]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved)
    commitStruct(next); dragPage.current = null
  }

  // ── Section operations ─────────────────────────────────────────────────────────

  function updateSection(pageId: string, secId: string, content: string) {
    commit(pages.map(p => p.id !== pageId ? p
      : { ...p, sections: p.sections.map(sec => sec.id !== secId ? sec : { ...sec, content }) }), true)
  }

  function addSection() {
    const page = pages.find(p => p.id === selectedPageId)
    if (!page || bodyCount(page) >= MAX_BODY) return
    const footerIdx = page.sections.findIndex(sec => sec.type === 'footer')
    const secs = [...page.sections]
    secs.splice(footerIdx >= 0 ? footerIdx : secs.length, 0, mkSec('body', 'Section'))
    commitStruct(pages.map(p => p.id !== selectedPageId ? p : { ...p, sections: secs }))
  }

  // TOC drag: move a body section to another body slot (within or across pages).
  const dragSec = useRef<{ pageId: string; secId: string } | null>(null)
  function moveSection(targetPageId: string, targetSecId: string) {
    const drag = dragSec.current; dragSec.current = null
    if (!drag || (drag.pageId === targetPageId && drag.secId === targetSecId)) return

    const next: Page[] = pages.map(p => ({ ...p, sections: [...p.sections] }))
    const srcPage = next.find(p => p.id === drag.pageId)!
    const tgtPage = next.find(p => p.id === targetPageId)!
    const sec = srcPage.sections.find(x => x.id === drag.secId)
    if (!sec || sec.type !== 'body') return

    const crossPage = drag.pageId !== targetPageId
    if (crossPage && bodyCount(srcPage) <= 1) return            // never empty a page's body
    if (crossPage && bodyCount(tgtPage) >= MAX_BODY) return     // target already full

    srcPage.sections = srcPage.sections.filter(x => x.id !== drag.secId)
    const tIdx = tgtPage.sections.findIndex(x => x.id === targetSecId)
    tgtPage.sections.splice(tIdx, 0, sec)
    commitStruct(next)
  }

  // ── Auto-save ──────────────────────────────────────────────────────────────────
  // Persist 1.2s after the last edit. Latest values via refs so the deferred save
  // always writes current content. inFlight/pending serialise saves: an edit made
  // while a save is running is coalesced and flushed right after, so nothing is lost.
  const onSaveRef  = useRef(onSave);  onSaveRef.current = onSave
  const docNameRef = useRef(docName); docNameRef.current = docName
  const pagesRef   = useRef(pages);   pagesRef.current = pages
  const inFlight   = useRef(false)
  const pending    = useRef(false)
  const didInit    = useRef(false)

  async function flush() {
    if (inFlight.current) { pending.current = true; return }   // a save is running — re-run after it
    inFlight.current = true
    setStatus('saving')
    try {
      await onSaveRef.current(docNameRef.current, serialize(pagesRef.current))
      setStatus(pending.current ? 'dirty' : 'saved')
    } catch {
      setStatus('error')
    } finally {
      inFlight.current = false
      if (pending.current) { pending.current = false; flush() }
    }
  }

  // Debounce on content/name changes; skip the initial load so a freshly opened
  // (unchanged) doc isn't re-saved. flush() reads refs, so it needn't be a dep.
  useEffect(() => {
    if (!didInit.current) { didInit.current = true; return }
    setStatus('dirty')
    const t = setTimeout(flush, 1200)
    return () => clearTimeout(t)
  }, [docName, pages])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedPage = pages.find(p => p.id === selectedPageId)
  const canAddSection = !!selectedPage && bodyCount(selectedPage) < MAX_BODY

  // 'saved' uses the editor's theme colour; the rest are semantic (amber/blue/red).
  const AUTOSAVE: Record<SaveStatus, React.CSSProperties> = {
    saved:  { color: saveColor, background: '#f8fafc' },
    dirty:  { color: '#d97706', background: '#fffbeb' },
    saving: { color: '#0369a1', background: '#f0f9ff' },
    error:  { color: '#dc2626', background: '#fef2f2' },
  }

  return (
    <div style={s.shell}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <span style={{ fontSize: 13, color: '#64748b' }}>Document:</span>
        <input style={s.nameInput} value={docName} onChange={e => setDocName(e.target.value)} />
        {badge && <span style={s.badge}>{badge}</span>}
        <button style={s.btn} onClick={undo}>↶ Undo</button>
        <button style={s.btn} onClick={redo}>↷ Redo</button>
        <button style={{ ...s.btn, opacity: canAddSection ? 1 : 0.45, cursor: canAddSection ? 'pointer' : 'not-allowed' }}
          onClick={addSection} disabled={!canAddSection}>+ Add Section</button>
        <span style={s.count}>Pages: {pages.length}</span>
        <span style={{ ...s.autosave, ...AUTOSAVE[status] }} title={saveLabel}>{AUTOSAVE_TEXT[status]}</span>
      </div>

      <div style={s.body}>
        {/* Left panel: Pages / TOC tabs */}
        <div style={s.leftPanel}>
          <div style={s.leftTabs}>
            <div style={s.tabRow}>
              <button style={{ ...s.tab, background: view === 'pages' ? '#e0f2fe' : 'transparent', color: view === 'pages' ? '#0369a1' : '#64748b' }}
                onClick={() => setView('pages')}>🖼 Pages</button>
              <button style={{ ...s.tab, background: view === 'toc' ? '#e0f2fe' : 'transparent', color: view === 'toc' ? '#0369a1' : '#64748b' }}
                onClick={() => setView('toc')}>📋 TOC</button>
            </div>
            <div style={s.tabRow}>
              <button style={{ ...s.tab, background: view === 'panels' ? '#e0f2fe' : 'transparent', color: view === 'panels' ? '#0369a1' : '#64748b' }}
                onClick={() => setView('panels')}>🧩 Panels</button>
              <button style={s.gear} onClick={e => { e.stopPropagation(); setGearOpen(o => !o) }}>⚙</button>
            </div>
          </div>

          {gearOpen && (
            <div style={s.popover} onClick={e => e.stopPropagation()}>
              <button style={s.popItem} onClick={() => { setCollapsed(new Set()); setGearOpen(false) }}>Expand all pages</button>
              <button style={s.popItem} onClick={() => { setCollapsed(new Set(pages.map(p => p.id))); setGearOpen(false) }}>Collapse all pages</button>
            </div>
          )}

          <div style={s.leftScroll}>
            {view === 'pages' && pages.map((page, idx) => (
              <PageThumb key={page.id} page={page} index={idx} selected={selectedPageId === page.id}
                onClick={() => { setSelectedPageId(page.id); setSelectedSecId(null); setScrollTo({ type: 'page', id: page.id }) }}
                onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, pageId: page.id }) }}
                onDragStart={() => { dragPage.current = page.id }}
                onDrop={() => dropPage(page.id)} />
            ))}
            {view === 'toc' && (
              <TocTree
                pages={pages}
                selectedPageId={selectedPageId}
                selectedSecId={selectedSecId}
                collapsed={collapsed}
                onToggle={pid => setCollapsed(c => { const n = new Set(c); n.has(pid) ? n.delete(pid) : n.add(pid); return n })}
                onSelectPage={pid => { setSelectedPageId(pid); setSelectedSecId(null); setScrollTo({ type: 'page', id: pid }) }}
                onSelectSection={(pid, sid) => { setSelectedPageId(pid); setSelectedSecId(sid); setScrollTo({ type: 'sec', id: sid }) }}
                onPageContextMenu={(e, pid) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, pageId: pid }) }}
                onSectionDragStart={(pid, sid) => { dragSec.current = { pageId: pid, secId: sid } }}
                onSectionDrop={moveSection}
              />
            )}
            {view === 'panels' && <ComponentLibrary />}
          </div>
          <div style={s.hint}>
            {view === 'pages'  && 'Drag to reorder\nRight click:\n• Duplicate\n• Delete'}
            {view === 'toc'    && 'Click a section to jump\nDrag sections to reorder\nor move between pages'}
            {view === 'panels' && 'Drag a component into\na section box'}
          </div>
        </div>

        {/* Main canvas — continuous Word-like document: all pages as stacked sheets */}
        <div ref={panelRef} style={s.rightPanel}>
          {pages.length === 0 && <p style={s.empty}>No pages yet — create one below to get started.</p>}
          {pages.map((page, idx) => {
            const dims = page.orientation === 'landscape'
              ? { width: '297mm', height: '210mm' }
              : { width: '210mm', height: '297mm' }
            // Fit the sheet to the panel width (downscale only); landscape needs more room.
            const sheetPx = (page.orientation === 'landscape' ? 297 : 210) * PX_PER_MM
            const zoom = panelW > 0 ? Math.min(1, (panelW - 8) / sheetPx) : 1
            return (
              <div key={page.id} style={{ width: dims.width, margin: '0 auto 28px', zoom }}>
                <div style={s.pageLabel}>
                  <span>Page {idx + 1} · A4 {page.orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
                  <button style={s.orientBtn}
                    onClick={() => setPageOrientation(page.id, page.orientation === 'landscape' ? 'portrait' : 'landscape')}>
                    ⟳ {page.orientation === 'landscape' ? 'Portrait' : 'Landscape'}
                  </button>
                </div>
                <div
                  id={`page-${page.id}`}
                  onMouseDown={() => { if (selectedPageId !== page.id) { setSelectedPageId(page.id); setSelectedSecId(null) } }}
                  style={{ ...s.sheet, ...dims, ...(selectedPageId === page.id ? s.sheetSel : {}) }}
                >
                  {page.sections.map(sec => (
                    <SectionBox key={sec.id} sec={sec} selected={selectedSecId === sec.id}
                      grow={sec.type === 'body'}
                      onChange={html => updateSection(page.id, sec.id, html)} />
                  ))}
                </div>
              </div>
            )
          })}
          <CreatePageBar onCreate={addPage} />
        </div>
      </div>

      {/* Context menu (Pages thumbnails & TOC page rows) */}
      {ctxMenu && (
        <div style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 200, minWidth: 160 }}
          onClick={e => e.stopPropagation()}>
          <button style={s.ctxItem} onClick={() => { duplicatePage(ctxMenu.pageId); setCtxMenu(null) }}>Duplicate Page</button>
          <button style={{ ...s.ctxItem, color: '#ef4444' }} onClick={() => { deletePage(ctxMenu.pageId); setCtxMenu(null) }}>Delete Page</button>
        </div>
      )}
    </div>
  )
}
