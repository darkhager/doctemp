import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { templatesApi, documentsApi } from '../../api/client'
import type { Template, Document } from '../../types'

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: 'inherit' },
  banner: {
    background: '#1e293b', color: '#fff', textAlign: 'center',
    padding: '36px 24px', borderRadius: 8, marginBottom: 40,
  },
  bannerTitle: { fontSize: 26, fontWeight: 700, letterSpacing: 1, margin: 0 },
  bannerSub: { color: '#94a3b8', marginTop: 8, fontSize: 15 },
  menuLabel: {
    textAlign: 'center', fontSize: 16, fontWeight: 600,
    color: '#475569', marginBottom: 20,
  },
  cards: { display: 'flex', gap: 20, marginBottom: 48 },
  card: {
    flex: 1, background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 8, padding: '28px 20px', cursor: 'pointer',
    transition: 'box-shadow .15s, border-color .15s',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  },
  cardIcon: { fontSize: 32 },
  cardTitle: { fontWeight: 700, fontSize: 15, color: '#1e293b', textAlign: 'center' },
  cardDesc: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 1.5 },
  sectionLabel: {
    fontWeight: 700, fontSize: 15, color: '#1e293b',
    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e8f0',
  },
  activity: { display: 'flex', gap: 40 },
  activityCol: { flex: 1 },
  activityItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 0', borderBottom: '1px solid #f1f5f9',
    fontSize: 14, color: '#334155', cursor: 'pointer',
  },
  empty: { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', paddingTop: 8 },
}

interface CardProps { icon: string; title: string; desc: string; onClick: () => void }
function Card({ icon, title, desc, onClick }: CardProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ ...s.card, ...(hovered ? { boxShadow: '0 4px 16px rgba(0,0,0,.1)', borderColor: '#38bdf8' } : {}) }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={s.cardIcon}>{icon}</div>
      <div style={s.cardTitle}>{title}</div>
      <div style={s.cardDesc}>{desc}</div>
    </div>
  )
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
    <div style={s.page}>
      <div style={s.banner}>
        <p style={s.bannerTitle}>DOCUMENT TEMPLATE EDITOR</p>
        <p style={s.bannerSub}>Create, Manage, and Generate Documents</p>
      </div>

      <div style={s.menuLabel}>Main Menu</div>

      <div style={s.cards}>
        <Card
          icon="✨"
          title="Create Template"
          desc={'Build New\nTemplate'}
          onClick={() => navigate('/templates/new')}
        />
        <Card
          icon="📄"
          title="Template List"
          desc={'View & Edit\nTemplates'}
          onClick={() => navigate('/templates')}
        />
        <Card
          icon="📝"
          title="Document List"
          desc={'View Generated\nDocuments'}
          onClick={() => navigate('/documents')}
        />
      </div>

      <div style={s.sectionLabel}>Recent Activity</div>
      <div style={s.activity}>
        <div style={s.activityCol}>
          {templates.length === 0
            ? <p style={s.empty}>No templates yet</p>
            : templates.map(t => (
              <div key={t.id} style={s.activityItem} onClick={() => navigate(`/templates/${t.id}/edit`)}>
                <span>📄</span> {t.name}
              </div>
            ))}
        </div>
        <div style={s.activityCol}>
          {docs.length === 0
            ? <p style={s.empty}>No documents yet</p>
            : docs.map(d => (
              <div key={d.id} style={s.activityItem} onClick={() => navigate(`/documents/${d.id}/edit`)}>
                <span>📝</span> {d.name}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
