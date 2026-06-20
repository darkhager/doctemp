import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { documentsApi, templatesApi } from '../../api/client'
import { type Page, deserialize } from '../Editor/editorUtils'
import DocEditor from '../Editor/DocEditor'

// Document editor — thin wrapper around the shared <DocEditor>.
// Modes: edit existing (/documents/:id/edit) or create from template (/documents/new?template=ID).
export default function DocumentEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('template')
  const navigate = useNavigate()

  const [ready, setReady] = useState(false)
  const [name, setName]   = useState('New Document')
  const [pages, setPages] = useState<Page[]>([])
  const [badge, setBadge] = useState<string | null>(null)
  // Guards the create→navigate window so auto-save can't create the document twice.
  const creating = useRef(false)

  useEffect(() => {
    if (id) {
      documentsApi.get(Number(id)).then(doc => {
        setName(doc.name)
        setPages(deserialize(doc.content_html))
        if (doc.template_id) {
          templatesApi.get(doc.template_id).then(t => setBadge(`from: ${t.name}`)).catch(() => {})
        }
      }).catch(() => {}).finally(() => setReady(true))
    } else if (templateId) {
      templatesApi.get(Number(templateId)).then(t => {
        setName(`${t.name} — Document`)
        setBadge(`from: ${t.name}`)
        setPages(deserialize(t.content_html))
      }).catch(() => {}).finally(() => setReady(true))
    } else {
      setReady(true)
    }
  }, [id, templateId])

  if (!ready) return <p style={{ padding: 32, color: '#94a3b8' }}>Loading…</p>

  return (
    <DocEditor
      key={id ?? `new-${templateId ?? ''}`}
      initialName={name}
      initialPages={pages}
      badge={badge}
      saveLabel="💾 Save Document"
      saveColor="#10b981"
      onSave={async (n, html) => {
        if (id) {
          await documentsApi.update(Number(id), { name: n, content_html: html })
        } else {
          if (creating.current) return            // a create is already in flight
          creating.current = true
          try {
            const doc = await documentsApi.create({
              name: n,
              template_id: templateId ? Number(templateId) : undefined,
              content_html: html,
            })
            navigate(`/documents/${doc.id}/edit`, { replace: true })
          } catch (e) { creating.current = false; throw e }
        }
      }}
    />
  )
}
