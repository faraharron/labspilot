import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Users, FlaskConical, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react'

const MOIS = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
const COLORS_PIE = ['#4f8ef7', '#22c97a', '#f59e1a', '#a78bfa', '#f05252', '#f97316']

function diagScore(sat, contexte, engagement) {
  const ctx = contexte === 'Social spécifique' ? 1.0 : contexte === 'Difficile' ? 0.75 : 0.5
  const eng = engagement === 'Excellent' ? 1.0 : engagement === 'Bon' ? 0.8 : 0.6
  return Math.min(1, sat * 0.7 + ctx * 0.2 + eng * 0.1)
}

function diagLabel(score) {
  if (score >= 0.70) return { label: '🟢 Optimal', cls: 'diag-optimal' }
  if (score >= 0.50) return { label: '🟡 Acceptable', cls: 'diag-acceptable' }
  if (score >= 0.30) return { label: '🟠 Alerte', cls: 'diag-alerte' }
  return { label: '🔴 Critique', cls: 'diag-critique' }
}

export default function Dashboard() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [labs, setLabs] = useState([])
  const [participants, setParticipants] = useState([])
  const [partenaires, setPartenaires] = useState([])
  const [loading, setLoading] = useState(true)

  const years = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i - 1)

  useEffect(() => {
    loadData()
  }, [year])

  async function loadData() {
    setLoading(true)
    const [{ data: labsData }, { data: partData }, { data: partMens }] = await Promise.all([
      supabase.from('labs').select('*, partenaires(code, nom), formateurs(nom, prenom)').eq('archive', false),
      supabase.from('partenaires').select('*'),
      supabase.from('participants_mensuels').select('*').eq('annee', year),
    ])
    setLabs(labsData || [])
    setPartenaires(partData || [])
    setParticipants(partMens || [])
    setLoading(false)
  }

  const stats = useMemo(() => {
    if (!labs.length) return {}

    const totalBenef = participants.reduce((s, p) => s + (p.nb_etudiants || 0), 0)
    const moisActifs = [...new Set(participants.map(p => p.mois))].length
    const activeLabs = labs.filter(l => {
      const hasPart = participants.some(p => p.lab_id === l.id && p.nb_etudiants > 0)
      return hasPart
    })

    // Monthly evolution
    const monthly = MOIS.map((m, i) => {
      const total = participants.filter(p => p.mois === i + 1).reduce((s, p) => s + p.nb_etudiants, 0)
      return { mois: m, participants: total }
    })

    // By partenaire
    const byPart = partenaires.map(p => {
      const pLabs = labs.filter(l => l.partenaire_id === p.id)
      const total = pLabs.reduce((s, lab) => {
        return s + participants.filter(pm => pm.lab_id === lab.id).reduce((ss, pm) => ss + pm.nb_etudiants, 0)
      }, 0)
      return { name: p.code, value: total, nom: p.nom }
    }).filter(p => p.value > 0)

    // KPI per lab
    const labKpis = labs.map(lab => {
      const labParts = participants.filter(p => p.lab_id === lab.id && p.nb_etudiants > 0)
      const moisActifsLab = labParts.length
      const totalYTD = labParts.reduce((s, p) => s + p.nb_etudiants, 0)
      const moyMens = moisActifsLab > 0 ? totalYTD / moisActifsLab : 0
      const capNorm = (lab.nb_pcs || 0) * 2 * 2
      const saturation = capNorm > 0 ? moyMens / capNorm : 0
      const score = diagScore(saturation, lab.contexte, lab.engagement)
      const diag = diagLabel(score)
      return { ...lab, totalYTD, moisActifsLab, moyMens, saturation, score, diag }
    }).sort((a, b) => b.score - a.score)

    const top10 = [...labKpis].sort((a, b) => b.totalYTD - a.totalYTD).slice(0, 10)

    return { totalBenef, moisActifs, activeLabs: activeLabs.length, totalLabs: labs.length, monthly, byPart, labKpis, top10 }
  }, [labs, participants, partenaires])

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Executive Summary · Maroc</p>
        </div>
        <div className="year-selector">
          {years.map(y => (
            <button key={y} className={`year-btn ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Bénéficiaires YTD</div>
            <div className="kpi-value">{(stats.totalBenef || 0).toLocaleString('fr')}</div>
            <div className="kpi-sub">{stats.moisActifs || 0} mois de données</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Labs actifs</div>
            <div className="kpi-value" style={{ color: 'var(--green)' }}>{stats.activeLabs || 0}</div>
            <div className="kpi-sub">sur {stats.totalLabs || 0} labs total</div>
          </div>
          <div className="kpi-card amber">
            <div className="kpi-label">Moy. mensuelle</div>
            <div className="kpi-value" style={{ color: 'var(--amber)' }}>
              {stats.moisActifs > 0 ? Math.round((stats.totalBenef || 0) / stats.moisActifs).toLocaleString('fr') : '—'}
            </div>
            <div className="kpi-sub">participants / mois</div>
          </div>
          <div className="kpi-card purple">
            <div className="kpi-label">Labs en alerte/critique</div>
            <div className="kpi-value" style={{ color: 'var(--purple)' }}>
              {(stats.labKpis || []).filter(l => l.score < 0.50).length}
            </div>
            <div className="kpi-sub">nécessitent attention</div>
          </div>
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div className="card">
            <div className="flex-between mb-16">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Évolution mensuelle {year}</div>
                <div className="text-sm text-muted">Participants par mois</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.monthly || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text)' }}
                  itemStyle={{ color: 'var(--accent)' }}
                />
                <Bar dataKey="participants" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Participants" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Par partenaire</div>
            <div className="text-sm text-muted mb-16">Répartition des bénéficiaires</div>
            {(stats.byPart || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={stats.byPart} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {(stats.byPart || []).map((_, i) => (
                      <Cell key={i} fill={COLORS_PIE[i % COLORS_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v, n, p) => [v.toLocaleString('fr'), p.payload.name]}
                  />
                  <Legend formatter={(v) => <span style={{ fontSize: 11, color: 'var(--text2)' }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <p>Pas de données pour {year}</p>
              </div>
            )}
          </div>
        </div>

        {/* Top 10 + Diagnostic */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>🏆 Top 10 Labs · {year}</div>
            {(stats.top10 || []).length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}><p>Aucune donnée</p></div>
            ) : (
              <div>
                {(stats.top10 || []).map((lab, i) => (
                  <div key={lab.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < 9 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 4, background: i < 3 ? 'rgba(79,142,247,0.15)' : 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: i < 3 ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lab.nom}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lab.partenaires?.code} · {lab.ville}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{lab.totalYTD.toLocaleString('fr')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>étudiants</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>🔍 Diagnostic par lab</div>
            {(stats.labKpis || []).length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}><p>Aucune donnée</p></div>
            ) : (
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {(stats.labKpis || []).map((lab, i) => (
                  <div key={lab.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < stats.labKpis.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lab.nom}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{lab.moisActifsLab} mois · {lab.totalYTD} bénéf.</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11 }} className={lab.diag.cls}>{lab.diag.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>
                        {(lab.score * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
