import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { templatesApi } from '../../api/client'
import { type Page, deserialize } from './editorUtils'
import DocEditor from './DocEditor'

// Template editor — thin wrapper around the shared <DocEditor>.
export default function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [ready, setReady]   = useState(!id)
  const [name, setName]     = useState('New Template')
  const [pages, setPages]   = useState<Page[]>([])
  // Guards the create→navigate window so auto-save can't create the template twice.
  const creating = useRef(false)

  useEffect(() => {
    if (!id) return
    templatesApi.get(Number(id))
      .then(t => { setName(t.name); setPages(deserialize(t.content_html)) })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [id])

  if (!ready) return <p style={{ padding: 32, color: '#94a3b8' }}>Loading…</p>

  return (
    <DocEditor
      key={id ?? 'new'}
      initialName={name}
      initialPages={pages}
      saveLabel="💾 Save Template"
      saveColor="#0284c7"
      onSave={async (n, html) => {
        if (id) {
          await templatesApi.update(Number(id), { name: n, content_html: html, fields_json: [] })
        } else {
          if (creating.current) return            // a create is already in flight
          creating.current = true
          try {
            const t = await templatesApi.create({ name: n, content_html: html, fields_json: [] })
            navigate(`/templates/${t.id}/edit`, { replace: true })
          } catch (e) { creating.current = false; throw e }
        }
      }}
    />
  )
}
