import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { documentsApi, templatesApi } from '../../api/client'
import { useToast } from '../ui/Toast'
import { ago } from '../../utils'
import type { Document } from '../../types'

export default function DocumentList() {
  const [docs, setDocs] = useState<Document[]>([])
  const [templateNames, setTemplateNames] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const nav = useNavigate()
  const { toast } = useToast()

  const load = () => {
    setLoading(true)
    Promise.all([
      documentsApi.list(),
      templatesApi.list(),
    ]).then(([ds, ts]) => {
      setDocs(ds)
      const map: Record<number, string> = {}
      for (const t of ts) map[t.id] = t.name
      setTemplateNames(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(load, [])

  const handleDelete = async (id: number, name: string) => {
    setConfirmId(null)
    await documentsApi.delete(id)
    toast(`"${name}" deleted`)
    load()
  }

  const handleCopy = async (id: number, name: string) => {
    await documentsApi.copy(id)
    toast(`"${name}" copied`)
    load()
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Document List</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Saved document instances — open, edit, copy, or export</p>
      </div>

      {loading ? (
        <div className="card-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ height: 140 }}>
              <div className="skeleton" style={{ height: '100%', borderRadius: 8 }} />
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 16, color: '#64748b' }}>No documents yet.</p>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Go to Template Library and click "Create Doc" on a template.</p>
          <div style={{ marginTop: 16 }}>
            <button onClick={() => nav('/templates')} className="btn btn-md btn-primary">Go to Templates</button>
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {docs.map(doc => (
            <div key={doc.id} className="card">
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', margin: '0 0 4px' }}>{doc.name}</h3>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
                {doc.template_id ? `from: ${templateNames[doc.template_id] ?? `Template #${doc.template_id}`}  ·  ` : ''}
                Updated {ago(doc.updated_at)}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-sm btn-primary" onClick={() => nav(`/documents/${doc.id}/edit`)}>Open</button>
                <button className="btn btn-sm btn-purple" onClick={() => handleCopy(doc.id, doc.name)}>Copy</button>
                <button className="btn btn-sm btn-sky" onClick={() => documentsApi.export(doc.id, 'docx')}>Export .docx</button>
                <button className="btn btn-sm btn-slate" onClick={() => documentsApi.export(doc.id, 'pdf')}>Export .pdf</button>
                {confirmId === doc.id ? (
                  <>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Delete?</span>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(doc.id, doc.name)}>Yes</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirmId(null)}>No</button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirmId(doc.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
