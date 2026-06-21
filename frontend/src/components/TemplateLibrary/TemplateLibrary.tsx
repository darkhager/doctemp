import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { templatesApi, categoriesApi } from '../../api/client'
import { useToast } from '../ui/Toast'
import { ago } from '../../utils'
import type { Template } from '../../types'

export default function TemplateLibrary() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    const [tpls, cats] = await Promise.all([
      templatesApi.list({ search: search || undefined, category: category || undefined }),
      categoriesApi.list(),
    ])
    setTemplates(tpls)
    setCategories(cats)
    setLoading(false)
  }

  useEffect(() => { load() }, [search, category])

  const handleDelete = async (id: number, name: string) => {
    await templatesApi.delete(id)
    toast(`"${name}" deleted`)
    load()
  }

  const handleDuplicate = async (id: number, name: string) => {
    await templatesApi.duplicate(id)
    toast(`"${name}" duplicated`)
    load()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const result = await templatesApi.importDocx(file)
      toast(`Imported "${result.name}"`)
      load()
    } catch {
      toast('Import failed — make sure the file is a valid .docx', 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Template Library</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="btn btn-md btn-sky">
            {importing ? 'Importing…' : 'Import .docx'}
          </button>
          <button onClick={() => nav('/templates/new')} className="btn btn-md btn-success">
            + New Template
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".docx" hidden onChange={handleImport} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ flex: 1 }}
        />
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="input" style={{ flex: '0 0 180px' }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ height: 160 }}>
              <div className="skeleton" style={{ height: '100%', borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 16, color: '#64748b' }}>No templates yet.</p>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Create one from scratch or import a .docx file.</p>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => nav('/templates/new')} className="btn btn-md btn-success">+ New Template</button>
            <button onClick={() => fileRef.current?.click()} className="btn btn-md btn-sky">Import .docx</button>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => nav(`/templates/${t.id}/edit`)}
              onCreateDoc={() => nav(`/documents/new?template=${t.id}`)}
              onDuplicate={() => handleDuplicate(t.id, t.name)}
              onDelete={() => handleDelete(t.id, t.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateCard({ template: t, onEdit, onCreateDoc, onDuplicate, onDelete }: {
  template: Template
  onEdit: () => void
  onCreateDoc: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="card">
      <div style={{ marginBottom: 8 }}>
        <span className="badge">{t.category}</span>
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>{t.name}</h3>
      {t.description && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>{t.description}</p>}
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>Updated {ago(t.updated_at)}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={onCreateDoc} className="btn btn-sm btn-success">Create Doc</button>
        <button onClick={onEdit} className="btn btn-sm btn-primary">Edit</button>
        <button onClick={onDuplicate} className="btn btn-sm btn-purple">Copy</button>
        {confirming ? (
          <>
            <span style={{ fontSize: 12, color: '#64748b' }}>Delete?</span>
            <button onClick={() => { setConfirming(false); onDelete() }} className="btn btn-sm btn-danger">Yes</button>
            <button onClick={() => setConfirming(false)} className="btn btn-sm btn-ghost">No</button>
          </>
        ) : (
          <button onClick={() => setConfirming(true)} className="btn btn-sm btn-danger">Delete</button>
        )}
      </div>
    </div>
  )
}
