import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Save, CheckCircle } from 'lucide-react'

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
const GROUPES = ['Brain Management CDI', 'Arron Groupe A', 'Arron Groupe B']
const TVA = 0.20
const STATUTS = ['Facturé', 'À venir', 'En attente']

export default function Budget() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [budgets, setBudgets] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [paysId, setPaysId] = useState(null)

  const years = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i - 1)

  useEffect(() => { loadAll() }, [year])

  async function loadAll() {
    setLoading(true)
    const { data: pays } = await supabase.from('pays').select('id').eq('code', 'MA').single()
    setPaysId(pays?.id)
    const { data } = await supabase.from('budget_annuel').select('*').eq('annee', year).eq('pays_id', pays?.id)

    // Build state map: groupe -> mois -> data
    const map = {}
    GROUPES.forEach(g => {
      map[g] = {}
      Array.from({ length: 12 }, (_, i) => {
        const rec = (data || []).find(d => d.groupe === g && d.mois === i + 1)
        map[g][i + 1] = {
          net_base: rec?.net_base || '',
          total_ht: rec?.total_ht || '',
          tva: rec?.tva || '',
          total_ttc: rec?.total_ttc || '',
          statut: rec?.statut || 'À venir',
          id: rec?.id || null
        }
      })
    })
    setBudgets(map)
    setLoading(false)
  }

  function updateCell(groupe, mois, field, value) {
    setBudgets(prev => {
      const updated = { ...prev, [groupe]: { ...prev[groupe], [mois]: { ...prev[groupe][mois], [field]: value } } }
      // Auto-calculate TVA and TTC from HT
      if (field === 'total_ht') {
        const ht = parseFloat(value) || 0
        updated[groupe][mois].tva = (ht * TVA).toFixed(2)
        updated[groupe][mois].total_ttc = (ht * (1 + TVA)).toFixed(2)
      }
      return updated
    })
  }

  async function saveAll() {
    setSaving(true)
    const upserts = []
    GROUPES.forEach(g => {
      Array.from({ length: 12 }, (_, i) => {
        const cell = budgets[g]?.[i + 1]
        if (!cell) return
        upserts.push({
          pays_id: paysId,
          annee: year,
          groupe: g,
          mois: i + 1,
          net_base: parseFloat(cell.net_base) || null,
          total_ht: parseFloat(cell.total_ht) || null,
          tva: parseFloat(cell.tva) || null,
          total_ttc: parseFloat(cell.total_ttc) || null,
          statut: cell.statut,
          updated_at: new Date().toISOString()
        })
      })
    })
    await supabase.from('budget_annuel').upsert(upserts, { onConflict: 'pays_id,annee,groupe,mois' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadAll()
  }

  const fmt = v => v !== '' && v != null ? parseFloat(v).toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  const groupTotal = (groupe) => {
    if (!budgets[groupe]) return 0
    return Object.values(budgets[groupe]).reduce((s, c) => s + (parseFloat(c.total_ttc) || 0), 0)
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget</h1>
          <p className="page-sub">Suivi budget formateurs annuel · saisie manuelle</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="year-selector">
            {years.map(y => <button key={y} className={`year-btn ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>)}
          </div>
          <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
            {saved ? <CheckCircle size={15} /> : <Save size={15} />}
            {saved ? 'Enregistré !' : 'Enregistrer tout'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {GROUPES.map(g => (
            <div key={g} className="kpi-card">
              <div className="kpi-label">{g === 'Brain Management CDI' ? 'Brain Mgmt CDI' : g}</div>
              <div className="kpi-value" style={{ fontSize: 18 }}>{groupTotal(g).toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="kpi-sub">MAD TTC · {year}</div>
            </div>
          ))}
        </div>

        {GROUPES.map(groupe => (
          <div key={groupe} className="card mb-24" style={{ padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{groupe}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text2)' }}>
                Total TTC : {groupTotal(groupe).toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Net base (MAD)</th>
                    <th>Total HT</th>
                    <th>TVA 20%</th>
                    <th>Total TTC</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }, (_, i) => {
                    const cell = budgets[groupe]?.[i + 1] || {}
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, color: 'var(--text2)', width: 80 }}>{MOIS_LABELS[i]}</td>
                        <td>
                          <input className="form-input" type="number" step="0.01"
                            style={{ width: 120, padding: '5px 8px', fontSize: 12 }}
                            value={cell.net_base || ''}
                            onChange={e => updateCell(groupe, i + 1, 'net_base', e.target.value)}
                            placeholder="0.00" />
                        </td>
                        <td>
                          <input className="form-input" type="number" step="0.01"
                            style={{ width: 130, padding: '5px 8px', fontSize: 12 }}
                            value={cell.total_ht || ''}
                            onChange={e => updateCell(groupe, i + 1, 'total_ht', e.target.value)}
                            placeholder="0.00" />
                        </td>
                        <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>
                          {cell.tva ? parseFloat(cell.tva).toLocaleString('fr', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                          {cell.total_ttc ? parseFloat(cell.total_ttc).toLocaleString('fr', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td>
                          <select className="form-select"
                            style={{ width: 120, padding: '5px 8px', fontSize: 12 }}
                            value={cell.statut || 'À venir'}
                            onChange={e => updateCell(groupe, i + 1, 'statut', e.target.value)}>
                            {STATUTS.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
