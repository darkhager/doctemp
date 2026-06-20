import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { documentsApi } from '../../api/client'
import type { Document } from '../../types'

const s: Record<string, React.CSSProperties> = {
  header:  { marginBottom: 24 },
  title:   { fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 },
  sub:     { color: '#64748b', fontSize: 14, marginTop: 4 },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card:    { background: '#fff', borderRadius: 10, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,.08)', border: '1px solid #e2e8f0' },
  name:    { fontSize: 16, fontWeight: 600, color: '#1e293b', margin: '0 0 6px' },
  meta:    { fontSize: 12, color: '#94a3b8', margin: '0 0 14px' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  empty:   { textAlign: 'center' as const, padding: '60px 0', background: '#fff', borderRadius: 12, border: '2px dashed #e2e8f0' },
}

function btn(color: string): React.CSSProperties {
  return { background: color, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }
}

export default function DocumentList() {
  const [docs, setDocs]     = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  const load = () => {
    setLoading(true)
    documentsApi.list().then(d => { setDocs(d); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(load, [])

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    await documentsApi.delete(id); load()
  }

  const handleCopy = async (id: number) => {
    await documentsApi.copy(id); load()
  }

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.title}>📝 Document List</h1>
        <p style={s.sub}>Saved document instances — open, edit, copy, or export</p>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      ) : docs.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: 16, color: '#64748b' }}>No documents yet.</p>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Go to Template Library and click "Create Document" on a template.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {docs.map(doc => (
            <div key={doc.id} style={s.card}>
              <h3 style={s.name}>📝 {doc.name}</h3>
              <p style={s.meta}>
                {doc.template_id ? `Template #${doc.template_id}  ·  ` : ''}
                Updated {new Date(doc.updated_at).toLocaleDateString()}
              </p>
              <div style={s.actions}>
                <button style={btn('#3b82f6')} onClick={() => nav(`/documents/${doc.id}/edit`)}>Open</button>
                <button style={btn('#8b5cf6')} onClick={() => handleCopy(doc.id)}>Copy</button>
                <button style={btn('#0ea5e9')} onClick={() => documentsApi.export(doc.id, 'docx')}>Export .docx</button>
                <button style={btn('#64748b')} onClick={() => documentsApi.export(doc.id, 'pdf')}>Export .pdf</button>
                <button style={btn('#ef4444')} onClick={() => handleDelete(doc.id, doc.name)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
