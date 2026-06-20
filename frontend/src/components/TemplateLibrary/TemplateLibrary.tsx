import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { templatesApi, categoriesApi } from '../../api/client'
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
    if (!confirm(`Delete "${name}"?`)) return
    await templatesApi.delete(id)
    load()
  }

  const handleDuplicate = async (id: number) => {
    await templatesApi.duplicate(id)
    load()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const result = await templatesApi.importDocx(file)
      alert(`Imported "${result.name}". ${result.message}`)
      load()
    } catch {
      alert('Import failed. Make sure the file is a valid .docx')
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
            style={btnStyle('#0ea5e9')}>
            {importing ? 'Importing…' : 'Import .docx'}
          </button>
          <button onClick={() => nav('/templates/new')} style={btnStyle('#10b981')}>
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
          style={inputStyle}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Loading…</p>
      ) : templates.length === 0 ? (
        <div style={emptyState}>
          <p style={{ fontSize: 16, color: '#64748b' }}>No templates yet.</p>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Create one from scratch or import a .docx file.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => nav(`/templates/${t.id}/edit`)}
              onCreateDoc={() => nav(`/documents/new?template=${t.id}`)}
              onDuplicate={() => handleDuplicate(t.id)}
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
  return (
    <div style={card}>
      <div style={{ marginBottom: 8 }}>
        <span style={badge}>{t.category}</span>
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600 }}>{t.name}</h3>
      {t.description && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>{t.description}</p>}
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
        {new Date(t.updated_at).toLocaleDateString()}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={onCreateDoc} style={btnStyle('#10b981', true)}>Create Document</button>
        <button onClick={onEdit} style={btnStyle('#3b82f6', true)}>Edit Template</button>
        <button onClick={onDuplicate} style={btnStyle('#8b5cf6', true)}>Copy</button>
        <button onClick={onDelete} style={btnStyle('#ef4444', true)}>Delete</button>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 10, padding: 18,
  boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid #e2e8f0',
}
const badge: React.CSSProperties = {
  background: '#f1f5f9', color: '#475569', padding: '2px 8px',
  borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
}
const emptyState: React.CSSProperties = {
  textAlign: 'center', padding: '60px 0',
  background: '#fff', borderRadius: 12, border: '2px dashed #e2e8f0',
}
const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 14, flex: 1, outline: 'none',
}

function btnStyle(color: string, small = false): React.CSSProperties {
  return {
    background: color, color: '#fff', border: 'none',
    padding: small ? '6px 12px' : '9px 18px',
    borderRadius: 6, cursor: 'pointer', fontSize: small ? 12 : 14, fontWeight: 500,
  }
}
