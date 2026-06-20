import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { templatesApi } from '../../api/client'
import type { Template, ExportFormat } from '../../types'
import Preview from '../Preview/Preview'

export default function FillFormPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [template, setTemplate] = useState<Template | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')

  useEffect(() => {
    if (id) {
      templatesApi.get(Number(id)).then(t => {
        setTemplate(t)
        const init: Record<string, string> = {}
        for (const f of t.fields_json) init[f.name] = f.default_value || ''
        setValues(init)
      })
    }
  }, [id])

  const handleExport = async (fmt: ExportFormat) => {
    if (!id) return
    setExporting(true)
    try {
      await templatesApi.export(Number(id), fmt, values)
    } catch {
      alert('Export failed.')
    } finally {
      setExporting(false)
    }
  }

  if (!template) return <p style={{ color: '#64748b' }}>Loading…</p>

  const filledHtml = fillHtml(template.content_html, values)

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <button onClick={() => nav('/templates')} style={backBtn}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{template.name}</h2>
          {template.description && (
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>{template.description}</p>
          )}
        </div>
        <button onClick={() => handleExport('docx')} disabled={exporting}
          style={{ ...exportBtn, background: '#3b82f6' }}>
          {exporting ? '…' : 'Export .docx'}
        </button>
        <button onClick={() => handleExport('pdf')} disabled={exporting}
          style={{ ...exportBtn, background: '#8b5cf6' }}>
          {exporting ? '…' : 'Export .pdf'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        {(['form', 'preview'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '9px 20px', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
            background: 'transparent', fontWeight: activeTab === tab ? 700 : 400,
            color: activeTab === tab ? '#3b82f6' : '#64748b', fontSize: 14,
          }}>
            {tab === 'form' ? 'Fill Fields' : 'Preview'}
          </button>
        ))}
      </div>
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 24 }} />

      {activeTab === 'form' ? (
        <div style={{ maxWidth: 640 }}>
          {template.fields_json.length === 0 ? (
            <p style={{ color: '#64748b' }}>This template has no fields. Export directly.</p>
          ) : (
            template.fields_json.map(f => (
              <div key={f.name} style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5, color: '#374151' }}>
                  {f.label}
                  {f.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
                </label>
                {f.field_type === 'textarea' ? (
                  <textarea
                    value={values[f.name] || ''}
                    onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                    rows={4}
                    style={{ ...fieldInput, resize: 'vertical' }}
                  />
                ) : (
                  <input
                    type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'}
                    value={values[f.name] || ''}
                    onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                    placeholder={f.default_value || `Enter ${f.label.toLowerCase()}…`}
                    style={fieldInput}
                  />
                )}
                <code style={{ fontSize: 11, color: '#94a3b8' }}>{`{{${f.name}}}`}</code>
              </div>
            ))
          )}
        </div>
      ) : (
        <Preview html={filledHtml} />
      )}
    </div>
  )
}

function fillHtml(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, name) =>
    values[name] !== undefined
      ? `<span style="background:#fef9c3;border-radius:2px;padding:0 2px">${values[name] || `{{${name}}}`}</span>`
      : `<span style="background:#fee2e2;color:#991b1b;border-radius:2px;padding:0 2px">{{${name}}}</span>`
  )
}

const backBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #cbd5e1', borderRadius: 6,
  padding: '7px 14px', cursor: 'pointer', fontSize: 14, color: '#475569',
}
const exportBtn: React.CSSProperties = {
  color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px',
  cursor: 'pointer', fontSize: 14, fontWeight: 600,
}
const fieldInput: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
  borderRadius: 6, fontSize: 14, boxSizing: 'border-box',
}
