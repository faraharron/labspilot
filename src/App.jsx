import React from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FlaskConical, Users, Upload,
  Wallet, BarChart3, Settings, ChevronRight
} from 'lucide-react'

import Dashboard from './pages/Dashboard.jsx'
import Labs from './pages/Labs.jsx'
import Formateurs from './pages/Formateurs.jsx'
import Import from './pages/Import.jsx'
import Budget from './pages/Budget.jsx'
import Remunerations from './pages/Remunerations.jsx'
import Parametres from './pages/Parametres.jsx'

const NAV = [
  {
    section: 'Analyse',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    section: 'Gestion',
    items: [
      { to: '/labs', label: 'Labs', icon: FlaskConical },
      { to: '/formateurs', label: 'Formateurs', icon: Users },
      { to: '/import', label: 'Import mensuel', icon: Upload },
    ]
  },
  {
    section: 'Finance',
    items: [
      { to: '/remunerations', label: 'Rémunérations', icon: Wallet },
      { to: '/budget', label: 'Budget', icon: BarChart3 },
    ]
  },
  {
    section: 'Système',
    items: [
      { to: '/parametres', label: 'Paramètres', icon: Settings },
    ]
  }
]

export default function App() {
  const location = useLocation()

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">Labs<span>Pilot</span></div>
          <div className="logo-sub">Maroc · 2026</div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(group => (
            <div className="nav-section" key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map(item => {
                const Icon = item.icon
                const isActive = item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text3)' }}>
          LabsPilot v1.0 · Maroc
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/labs/*" element={<Labs />} />
          <Route path="/formateurs/*" element={<Formateurs />} />
          <Route path="/import" element={<Import />} />
          <Route path="/remunerations" element={<Remunerations />} />
          <Route path="/budget" element={<Budget />} />
          <Route path="/parametres" element={<Parametres />} />
        </Routes>
      </main>
    </div>
  )
}
