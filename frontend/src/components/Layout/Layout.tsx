import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const cls = ({ isActive }: { isActive: boolean }) => 'nav-link' + (isActive ? ' active' : '')

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, background: '#1e293b', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 24px', fontSize: 18, fontWeight: 700, borderBottom: '1px solid #334155', marginBottom: 16, color: '#38bdf8', letterSpacing: '-0.5px' }}>
          Doc Template Studio
        </div>
        <NavLink to="/" end className={cls}>Home</NavLink>
        <NavLink to="/templates" className={cls}>Template Library</NavLink>
        <NavLink to="/templates/new" end className={cls}>New Template</NavLink>
        <NavLink to="/documents" className={cls}>Documents</NavLink>
      </aside>
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>{children}</main>
    </div>
  )
}
