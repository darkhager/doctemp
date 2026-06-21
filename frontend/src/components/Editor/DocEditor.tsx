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
  leftPanel:  { width: 260, borderRight: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  secHead:    { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none' as const, flexShrink: 0 },
  secTitle:   { flex: 1, fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  gear:       { padding: '3px 7px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12 },
  popover:    { position: 'absolute', top: 36, right: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 150, minWidth: 150 },
  popItem:    { display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#334155' },
  leftScroll: { overflowY: 'auto', padding: '8px 8px' },
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
  const startPages = initialPages.length > 0 ? initialPages : [mkPage(1)]
  const [pages, setPages]           = useState<Page[]>(startPages)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(startPages[0]?.id ?? null)
  const [selectedSecId, setSelectedSecId]   = useState<string | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(true)
  const [formatOpen, setFormatOpen]     = useState(true)
  const [layoutOpen, setLayoutOpen]     = useState(true)
  const [panelsOpen, setPanelsOpen] = useState(true)
  const [viewMode, setViewMode]     = useState<'scroll' | 'paged'>('scroll')
  const [pagesPerView, setPagesPerView] = useState<1 | 2 | 3>(1)
  const [zoomScale, setZoomScale]   = useState(0.75)
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

  // Set the selected page to exactly n body sections, then jump to section n.
  // Growing appends blank sections; shrinking drops trailing ones (recoverable via Undo).
  function setSectionCount(n: number) {
    const page = pages.find(p => p.id === selectedPageId)
    if (!page) return
    const bodies = page.sections.filter(sec => sec.type === 'body')
    const nextBodies = n > bodies.length
      ? [...bodies, ...Array.from({ length: n - bodies.length }, () => mkSec('body', 'Section'))]
      : bodies.slice(0, n)
    if (n !== bodies.length) {
      const header = page.sections.filter(sec => sec.type === 'header')
      const footer = page.sections.filter(sec => sec.type === 'footer')
      commitStruct(pages.map(p => p.id !== page.id ? p : { ...p, sections: [...header, ...nextBodies, ...footer] }))
    }
    const target = nextBodies[n - 1]
    if (target) { setSelectedSecId(target.id); setScrollTo({ type: 'sec', id: target.id }) }
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
        <span style={s.count}>Pages: {pages.length}</span>
        <span style={{ ...s.autosave, ...AUTOSAVE[status] }} title={saveLabel}>{AUTOSAVE_TEXT[status]}</span>
        <button style={{ ...s.btn, background: saveColor, color: '#fff', border: 'none', fontWeight: 600 }}
          onClick={flush} disabled={status === 'saving'}>{saveLabel}</button>
      </div>

      <div style={s.body}>
        {/* Left panel: collapsible Overview + Page Format + Page Layout + Components bars */}
        <div style={s.leftPanel}>

          {/* ── Overview bar (page thumbnails) ────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: overviewOpen ? '1 1 0' : '0 0 auto', minHeight: 0, borderBottom: '2px solid #e2e8f0' }}>
            <div style={s.secHead} onClick={() => setOverviewOpen(o => !o)}>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{overviewOpen ? '▼' : '▶'}</span>
              <span style={s.secTitle}>Overview</span>
            </div>
            {overviewOpen && (
              <div style={{ ...s.leftScroll, flex: 1, overflowY: 'auto' }}>
                {pages.map((page, idx) => (
                  <PageThumb key={page.id} page={page} index={idx} selected={selectedPageId === page.id}
                    onClick={() => { setSelectedPageId(page.id); setSelectedSecId(null); setScrollTo({ type: 'page', id: page.id }) }}
                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, pageId: page.id }) }}
                    onDragStart={() => { dragPage.current = page.id }}
                    onDrop={() => dropPage(page.id)} />
                ))}
              </div>
            )}
          </div>

          {/* ── Page Format bar (document outline / TOC) ──────────── */}
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: formatOpen ? '1 1 0' : '0 0 auto', minHeight: 0, borderBottom: '2px solid #e2e8f0' }}>
            <div style={s.secHead} onClick={() => setFormatOpen(o => !o)}>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{formatOpen ? '▼' : '▶'}</span>
              <span style={s.secTitle}>Page Format</span>
              {formatOpen && (
                <button style={s.gear} onClick={e => { e.stopPropagation(); setGearOpen(o => !o) }}>⚙</button>
              )}
            </div>
            {gearOpen && (
              <div style={s.popover} onClick={e => e.stopPropagation()}>
                <button style={s.popItem} onClick={() => { setCollapsed(new Set()); setGearOpen(false) }}>Expand all pages</button>
                <button style={s.popItem} onClick={() => { setCollapsed(new Set(pages.map(p => p.id))); setGearOpen(false) }}>Collapse all pages</button>
              </div>
            )}
            {formatOpen && (
              <div style={{ ...s.leftScroll, flex: 1, overflowY: 'auto' }}>
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
              </div>
            )}
          </div>

          {/* ── Page Layout section (click a number to set the page's section count) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', minHeight: 0, borderBottom: '2px solid #e2e8f0' }}>
            <div style={s.secHead} onClick={() => setLayoutOpen(o => !o)}>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{layoutOpen ? '▼' : '▶'}</span>
              <span style={s.secTitle}>Page Layout</span>
            </div>
            {layoutOpen && (
              <div style={{ padding: '10px 8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Array.from({ length: MAX_BODY }, (_, i) => {
                    const n = i + 1
                    const bodySecs = selectedPage ? selectedPage.sections.filter(sec => sec.type === 'body') : []
                    const isSel = n <= bodySecs.length && selectedSecId === bodySecs[i].id
                    return (
                      <div key={i}
                        onClick={() => selectedPage && setSectionCount(n)}
                        style={{ border: `1px solid ${isSel ? '#38bdf8' : '#e2e8f0'}`, borderRadius: 6,
                          background: isSel ? '#e0f2fe' : '#fff', cursor: selectedPage ? 'pointer' : 'default',
                          padding: '10px 6px', textAlign: 'center', userSelect: 'none' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, marginBottom: 6, color: isSel ? '#0369a1' : '#475569' }}>{n}</div>
                        <div style={{ fontSize: 11, color: isSel ? '#0369a1' : '#64748b' }}>{n > 1 ? 'Sections' : 'Section'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Components section ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: panelsOpen ? '1 1 0' : '0 0 auto', minHeight: 0 }}>
            <div style={s.secHead} onClick={() => setPanelsOpen(o => !o)}>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{panelsOpen ? '▼' : '▶'}</span>
              <span style={s.secTitle}>Components</span>
            </div>
            {panelsOpen && (
              <div style={{ ...s.leftScroll, flex: 1, overflowY: 'auto' }}>
                <ComponentLibrary />
              </div>
            )}
          </div>

        </div>

        {/* Main canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* View mode bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginRight: 2 }}>View:</span>
            {([['scroll', '≡ Scroll'], [1, '1 Page'], [2, '2 Pages'], [3, '3 Pages']] as const).map(([val, label]) => {
              const active = val === 'scroll' ? viewMode === 'scroll' : viewMode === 'paged' && pagesPerView === val
              return (
                <button key={String(val)}
                  onClick={() => { if (val === 'scroll') { setViewMode('scroll') } else { setViewMode('paged'); setPagesPerView(val) } }}
                  style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    borderColor: active ? '#38bdf8' : '#e2e8f0',
                    background: active ? '#e0f2fe' : '#f8fafc',
                    color: active ? '#0369a1' : '#475569' }}>
                  {label}
                </button>
              )
            })}
            {viewMode === 'paged' && (
              <>
                <div style={{ flex: 1 }} />
                {(() => {
                  const idx = Math.max(0, pages.findIndex(p => p.id === selectedPageId))
                  return (
                    <>
                      <button disabled={idx === 0}
                        onClick={() => { const p = pages[idx - 1]; if (p) setSelectedPageId(p.id) }}
                        style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: idx > 0 ? 'pointer' : 'default', opacity: idx > 0 ? 1 : 0.4 }}>
                        ← Prev
                      </button>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Page {idx + 1} / {pages.length}</span>
                      <button disabled={idx >= pages.length - 1}
                        onClick={() => { const p = pages[idx + 1]; if (p) setSelectedPageId(p.id) }}
                        style={{ padding: '3px 9px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: idx < pages.length - 1 ? 'pointer' : 'default', opacity: idx < pages.length - 1 ? 1 : 0.4 }}>
                        Next →
                      </button>
                    </>
                  )
                })()}
              </>
            )}
          </div>

          {/* Scrollable canvas + zoom overlay */}
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
            <div ref={panelRef} style={{ height: '100%', overflow: 'auto', padding: viewMode === 'paged' && pagesPerView > 1 ? '20px 12px' : '28px 24px', background: '#e5e7eb' }}>
              {(() => {
                const pagedIdx = viewMode === 'paged' ? Math.max(0, pages.findIndex(p => p.id === selectedPageId)) : 0
                const visiblePages = viewMode === 'paged' ? pages.slice(pagedIdx, pagedIdx + pagesPerView) : pages
                const slotW = viewMode === 'paged' && pagesPerView > 1
                  ? Math.floor((panelW - 16 * (pagesPerView - 1)) / pagesPerView)
                  : panelW

                const renderSheet = (page: Page, idx: number) => {
                  const dims = page.orientation === 'landscape'
                    ? { width: '297mm', height: '210mm' }
                    : { width: '210mm', height: '297mm' }
                  const sheetPx = (page.orientation === 'landscape' ? 297 : 210) * PX_PER_MM
                  const effectiveW = viewMode === 'paged' && pagesPerView > 1 ? slotW : panelW
                  const baseZoom = effectiveW > 0 ? Math.min(1, (effectiveW - 8) / sheetPx) : 1
                  const zoom = baseZoom * zoomScale
                  return (
                    <div key={page.id} style={{ width: dims.width, ...(viewMode === 'scroll' ? { margin: '0 auto 28px' } : {}), zoom }}>
                      <div style={s.pageLabel}>
                        <span>Page {idx + 1} · A4 {page.orientation === 'landscape' ? 'Landscape' : 'Portrait'}</span>
                        <button style={s.orientBtn}
                          onClick={() => setPageOrientation(page.id, page.orientation === 'landscape' ? 'portrait' : 'landscape')}>
                          ⟳ {page.orientation === 'landscape' ? 'Portrait' : 'Landscape'}
                        </button>
                      </div>
                      <div id={`page-${page.id}`}
                        onMouseDown={() => { if (selectedPageId !== page.id) { setSelectedPageId(page.id); setSelectedSecId(null) } }}
                        style={{ ...s.sheet, ...dims, ...(selectedPageId === page.id ? s.sheetSel : {}) }}>
                        {page.sections.map(sec => (
                          <SectionBox key={sec.id} sec={sec} selected={selectedSecId === sec.id}
                            grow={sec.type === 'body'}
                            onChange={html => updateSection(page.id, sec.id, html)} />
                        ))}
                      </div>
                    </div>
                  )
                }

                return viewMode === 'scroll' ? (
                  <>
                    {visiblePages.map((page, i) => renderSheet(page, i))}
                    <CreatePageBar onCreate={addPage} />
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'flex-start' }}>
                    {visiblePages.map((page, i) => renderSheet(page, pagedIdx + i))}
                  </div>
                )
              })()}
            </div>

            {/* Zoom control — bottom-right overlay */}
            <div style={{ position: 'absolute', bottom: 14, right: 16, zIndex: 50, display: 'flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
              <button onClick={() => setZoomScale(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <button onClick={() => setZoomScale(1.0)}
                style={{ minWidth: 40, padding: '0 4px', height: 22, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#475569' }}
                title="Reset zoom">
                {Math.round(zoomScale * 100)}%
              </button>
              <button onClick={() => setZoomScale(z => Math.min(3, +(z + 0.25).toFixed(2)))}
                style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 14, lineHeight: 1, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>

          </div>

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
