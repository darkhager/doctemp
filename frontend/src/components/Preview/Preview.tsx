interface Props { html: string }

export default function Preview({ html }: Props) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '32px 40px', maxWidth: 800,
      boxShadow: '0 2px 12px rgba(0,0,0,.06)',
    }}>
      <div
        style={{ fontSize: 15, lineHeight: 1.75, color: '#1a1a1a' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
