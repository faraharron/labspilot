import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Pencil, X, AlertTriangle, Lock, Unlock } from 'lucide-react'

const MOIS_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const CP_RATE = 0.0577
const TVA_RATE = 0.20

function calcRemun(f, nb_hn = 0, rap_hn = 0) {
  const net = f.net_base || 0
  const txP = f.tx_horaire_p || 17.1
  const txF = f.tx_horaire_f || 22.74
  const mt_p_hn = nb_hn * txP
  const mt_f_hn = (nb_hn + rap_hn) * txF
  const mt_f_cp = mt_f_hn * CP_RATE
  const total_ht = mt_f_hn + mt_f_cp
  const total_ttc = total_ht * (1 + TVA_RATE)
  return { net_a_payer: net, nb_hn, rap_hn, mt_p_hn, mt_f_hn, mt_f_cp, total_ht, total_ttc }
}

export default function Remunerations() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [formateurs, setFormateurs] = useState([])
  const [remunerations, setRemunerations] = useState([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  const years = Array.from({ length: 4 }, (_, i) => currentYear - 1 + i - 1)

  useEffect(() => { loadAll() }, [year, mois])

  async function loadAll() {
    setLoading(true)
    const [{ data: fData }, { data: rData }] = await Promise.all([
      supabase.from('formateurs').select('*').eq('actif', true).order('groupe').order('nom'),
      supabase.from('remunerations').select('*').eq('annee', year).eq('mois', mois)
    ])
    setFormateurs(fData || [])
    setRemunerations(rData || [])
    setLoading(false)
  }

  function getRemun(formateurId) {
    return remunerations.find(r => r.formateur_id === formateurId)
  }

  function getDisplayValues(f) {
    const r = getRemun(f.id)
    if (r) {
      if (r.override_actif) {
        return { ...r, net_a_payer: r.override_net_a_payer, isOverride: true }
      }
      return { ...r, isOverride: false }
    }
    // Calculate from defaults
    return { ...calcRemun(f), isOverride: false, notSaved: true }
  }

  function openEdit(f) {
    const r = getRemun(f.id)
    const calc = calcRemun(f, r?.nb_hn || 0, r?.rap_hn || 0)
    setEditForm({
      formateur: f,
      remun: r,
      nb_hn: r?.nb_hn || 0,
      rap_hn: r?.rap_hn || 0,
      override_actif: r?.override_actif || false,
      override_net_a_payer: r?.override_net_a_payer || r?.net_a_payer || f.net_base || 0,
      override_motif: r?.override_motif || '',
      ...calc
    })
    setEditModal(f.id)
  }

  function updateCalc(nb_hn, rap_hn) {
    const calc = calcRemun(editForm.formateur, parseFloat(nb_hn) || 0, parseFloat(rap_hn) || 0)
    setEditForm(ef => ({ ...ef, nb_hn, rap_hn, ...calc }))
  }

  async function saveRemun() {
    setSaving(true)
    const f = editForm.formateur
    const calc = calcRemun(f, parseFloat(editForm.nb_hn) || 0, parseFloat(editForm.rap_hn) || 0)
    const payload = {
      formateur_id: f.id,
      annee: year,
      mois,
      nb_hn: parseFloat(editForm.nb_hn) || 0,
      rap_hn: parseFloat(editForm.rap_hn) || 0,
      ...calc,
      override_actif: editForm.override_actif,
      override_net_a_payer: editForm.override_actif ? parseFloat(editForm.override_net_a_payer) || 0 : null,
      override_motif: editForm.override_actif ? editForm.override_motif : null,
      updated_at: new Date().toISOString()
    }
    await supabase.from('remunerations').upsert(payload, { onConflict: 'formateur_id,annee,mois' })
    setSaving(false)
    setEditModal(null)
    loadAll()
  }

  const byGroupe = ['Brain Management CDI', 'Arron Groupe A', 'Arron Groupe B']

  const fmt = (v) => v != null ? v.toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  const totalByGroupe = byGroupe.map(g => {
    const fGroup = formateurs.filter(f => f.groupe === g)
    const total_ttc = fGroup.reduce((s, f) => {
      const v = getDisplayValues(f)
      return s + (v.total_ttc || 0)
    }, 0)
    return { groupe: g, total_ttc }
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rémunérations</h1>
          <p className="page-sub">Fiches de paie formateurs · avec override manuel</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="year-selector">
            {years.map(y => <button key={y} className={`year-btn ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>)}
          </div>
          <select className="form-select" style={{ width: 140 }} value={mois} onChange={e => setMois(parseInt(e.target.value))}>
            {MOIS_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="page-body">
        {/* Totaux */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {totalByGroupe.map(g => (
            <div key={g.groupe} className="kpi-card">
              <div className="kpi-label">{g.groupe === 'Brain Management CDI' ? 'Brain Mgmt CDI' : g.groupe}</div>
              <div className="kpi-value" style={{ fontSize: 20 }}>{fmt(g.total_ttc)}</div>
              <div className="kpi-sub">MAD TTC</div>
            </div>
          ))}
        </div>

        {byGroupe.map(groupe => {
          const fGroup = formateurs.filter(f => f.groupe === groupe)
          if (!fGroup.length) return null
          return (
            <div key={groupe} className="card mb-24" style={{ padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                {groupe}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Formateur</th>
                      <th>Net Base</th>
                      <th>NB HN</th>
                      <th>RAP HN</th>
                      <th>MT P HN</th>
                      <th>MT F HN</th>
                      <th>CP</th>
                      <th>Total HT</th>
                      <th>Total TTC</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fGroup.map(f => {
                      const v = getDisplayValues(f)
                      return (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 500 }}>{f.prenom} {f.nom}</td>
                          <td className="mono">{fmt(v.isOverride ? v.override_net_a_payer : v.net_a_payer)}</td>
                          <td className="mono">{v.nb_hn || 0}</td>
                          <td className="mono">{v.rap_hn || 0}</td>
                          <td className="mono">{fmt(v.mt_p_hn)}</td>
                          <td className="mono">{fmt(v.mt_f_hn)}</td>
                          <td className="mono">{fmt(v.mt_f_cp)}</td>
                          <td className="mono">{fmt(v.total_ht)}</td>
                          <td className="mono" style={{ fontWeight: 600 }}>{fmt(v.total_ttc)}</td>
                          <td>
                            {v.isOverride ? (
                              <span className="badge badge-amber" title={v.override_motif}>
                                <Lock size={10} /> Forcé
                              </span>
                            ) : v.notSaved ? (
                              <span className="badge badge-gray">Estimé</span>
                            ) : (
                              <span className="badge badge-green">Auto</span>
                            )}
                          </td>
                          <td>
                            <button className="btn-icon" onClick={() => openEdit(f)} title="Modifier / Override">
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">
                {editForm.formateur?.prenom} {editForm.formateur?.nom} · {MOIS_LABELS[mois - 1]} {year}
              </div>
              <button className="btn-icon" onClick={() => setEditModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row mb-16">
                <div className="form-group">
                  <label className="form-label">NB HN (heures normales)</label>
                  <input className="form-input" type="number" step="0.01" value={editForm.nb_hn}
                    onChange={e => updateCalc(e.target.value, editForm.rap_hn)} />
                </div>
                <div className="form-group">
                  <label className="form-label">RAP HN (heures supp.)</label>
                  <input className="form-input" type="number" step="0.01" value={editForm.rap_hn}
                    onChange={e => updateCalc(editForm.nb_hn, e.target.value)} />
                </div>
              </div>

              {/* Calculated preview */}
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 8, color: 'var(--text2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Calcul automatique</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                  {[
                    ['Net à payer', editForm.net_a_payer],
                    ['MT P HN', editForm.mt_p_hn],
                    ['MT F HN', editForm.mt_f_hn],
                    ['MT F CP', editForm.mt_f_cp],
                    ['Total HT', editForm.total_ht],
                    ['Total TTC', editForm.total_ttc],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text3)' }}>{label}</span>
                      <span className="mono">{val?.toFixed(2)} MAD</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Override section */}
              <div className="override-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <input type="checkbox" id="override_chk" checked={editForm.override_actif}
                    onChange={e => setEditForm(ef => ({ ...ef, override_actif: e.target.checked }))}
                    style={{ width: 15, height: 15, cursor: 'pointer' }} />
                  <label htmlFor="override_chk" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--amber)' }}>
                    <Lock size={12} style={{ display: 'inline', marginRight: 5 }} />
                    Forcer le salaire manuellement
                  </label>
                </div>
                {editForm.override_actif && (
                  <>
                    <div className="form-group mb-8">
                      <label className="form-label">Salaire forcé (MAD)</label>
                      <input className="form-input" type="number" step="0.01"
                        value={editForm.override_net_a_payer}
                        onChange={e => setEditForm(ef => ({ ...ef, override_net_a_payer: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Motif (obligatoire)</label>
                      <input className="form-input" placeholder="Congé maternité, cas particulier..."
                        value={editForm.override_motif}
                        onChange={e => setEditForm(ef => ({ ...ef, override_motif: e.target.value }))} />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setEditModal(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveRemun} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
