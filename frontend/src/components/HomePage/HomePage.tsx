import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { templatesApi, documentsApi } from '../../api/client'
import { ago } from '../../utils'
import type { Template, Document } from '../../types'

const s: Record<string, React.CSSProperties> = {
  banner: {
    background: '#1e293b', color: '#fff', textAlign: 'center',
    padding: '36px 24px', borderRadius: 8, marginBottom: 40,
  },
  bannerTitle: { fontSize: 26, fontWeight: 700, letterSpacing: 1, margin: 0 },
  bannerSub:   { color: '#94a3b8', marginTop: 8, fontSize: 15 },
  menuLabel:   { textAlign: 'center', fontSize: 16, fontWeight: 600, color: '#475569', marginBottom: 20 },
  cards:       { display: 'flex', gap: 20, marginBottom: 48 },
  card: {
    flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '28px 20px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  cardIcon:    { fontSize: 32 },
  cardTitle:   { fontWeight: 700, fontSize: 15, color: '#1e293b', textAlign: 'center' },
  cardDesc:    { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 1.5 },
  sectionLabel: { fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' },
  activity:    { display: 'flex', gap: 40 },
  activityCol: { flex: 1 },
  activityItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: '1px solid #f1f5f9',
    fontSize: 14, color: '#334155', cursor: 'pointer',
  },
  empty: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', paddingTop: 8 },
}

export default function HomePage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Template[]>([])
  const [docs, setDocs] = useState<Document[]>([])

  useEffect(() => {
    templatesApi.list().then(ts => setTemplates(ts.slice(0, 6))).catch(() => {})
    documentsApi.list().then(ds => setDocs(ds.slice(0, 6))).catch(() => {})
  }, [])

  return (
    <div>
      <div style={s.banner}>
        <p style={s.bannerTitle}>DOCUMENT TEMPLATE EDITOR</p>
        <p style={s.bannerSub}>Create, Manage, and Generate Documents</p>
      </div>

      <div style={s.menuLabel}>Main Menu</div>

      <div style={s.cards}>
        <div className="card card-clickable" style={s.card} onClick={() => navigate('/templates/new')}>
          <div style={s.cardIcon}>✨</div>
          <div style={s.cardTitle}>Create Template</div>
          <div style={s.cardDesc}>Build a new reusable template</div>
        </div>
        <div className="card card-clickable" style={s.card} onClick={() => navigate('/templates')}>
          <div style={s.cardIcon}>📄</div>
          <div style={s.cardTitle}>Template Library</div>
          <div style={s.cardDesc}>View and manage templates</div>
        </div>
        <div className="card card-clickable" style={s.card} onClick={() => navigate('/documents')}>
          <div style={s.cardIcon}>📝</div>
          <div style={s.cardTitle}>Document List</div>
          <div style={s.cardDesc}>View generated documents</div>
        </div>
      </div>

      <div style={s.sectionLabel}>Recent Activity</div>
      <div style={s.activity}>
        <div style={s.activityCol}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Templates</div>
          {templates.length === 0
            ? <p style={s.empty}>No templates yet</p>
            : templates.map(t => (
              <div key={t.id} style={s.activityItem} onClick={() => navigate(`/templates/${t.id}/edit`)}>
                <span>{t.name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{ago(t.updated_at)}</span>
              </div>
            ))}
        </div>
        <div style={s.activityCol}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Documents</div>
          {docs.length === 0
            ? <p style={s.empty}>No documents yet</p>
            : docs.map(d => (
              <div key={d.id} style={s.activityItem} onClick={() => navigate(`/documents/${d.id}/edit`)}>
                <span>{d.name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{ago(d.updated_at)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
