import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 220, background: '#1e293b', color: '#e2e8f0',
    display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0,
  },
  logo: {
    padding: '0 20px 24px', fontSize: 18, fontWeight: 700,
    borderBottom: '1px solid #334155', marginBottom: 16,
    color: '#38bdf8', letterSpacing: '-0.5px',
  },
  navLink: {
    display: 'block', padding: '10px 20px', color: '#94a3b8',
    textDecoration: 'none', fontSize: 14, transition: 'all .15s',
  },
  navLinkActive: { color: '#f8fafc', background: '#334155', borderLeft: '3px solid #38bdf8' },
  main: { flex: 1, overflow: 'auto', padding: 32 },
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isActive = (to: string) => pathname.startsWith(to)

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.logo}>Doc Template Studio</div>
        <Link to="/" style={{ ...s.navLink, ...(pathname === '/' ? s.navLinkActive : {}) }}>
          🏠 Home
        </Link>
        <Link
          to="/templates"
          style={{ ...s.navLink, ...(isActive('/templates') ? s.navLinkActive : {}) }}
        >
          📄 Template Library
        </Link>
        <Link
          to="/templates/new"
          style={{ ...s.navLink, ...(pathname === '/templates/new' ? s.navLinkActive : {}) }}
        >
          ✨ New Template
        </Link>
        <Link
          to="/documents"
          style={{ ...s.navLink, ...(isActive('/documents') ? s.navLinkActive : {}) }}
        >
          📝 Documents
        </Link>
      </aside>
      <main style={s.main}>{children}</main>
    </div>
  )
}
