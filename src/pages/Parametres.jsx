import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, X, Save, History } from 'lucide-react'

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

export default function Parametres() {
  const [tab, setTab] = useState('partenaires')
  const [partenaires, setPartenaires] = useState([])
  const [imports, setImports] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ code: '', nom: '' })
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from('partenaires').select('*').order('code'),
      supabase.from('import_log').select('*').order('imported_at', { ascending: false }).limit(50)
    ])
    setPartenaires(p || [])
    setImports(i || [])
    setLoading(false)
  }

  async function savePartenaire() {
    if (!form.code || !form.nom) return
    setSaving(true)
    if (editId) {
      await supabase.from('partenaires').update({ code: form.code.toUpperCase(), nom: form.nom }).eq('id', editId)
    } else {
      await supabase.from('partenaires').insert({ code: form.code.toUpperCase(), nom: form.nom })
    }
    setSaving(false)
    setModal(false)
    setEditId(null)
    setForm({ code: '', nom: '' })
    loadAll()
  }

  async function togglePartenaire(p) {
    await supabase.from('partenaires').update({ actif: !p.actif }).eq('id', p.id)
    loadAll()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-sub">Configuration et historique</p>
        </div>
      </div>

      <div className="page-body">
        <div className="tabs">
          <button className={`tab ${tab === 'partenaires' ? 'active' : ''}`} onClick={() => setTab('partenaires')}>Partenaires</button>
          <button className={`tab ${tab === 'imports' ? 'active' : ''}`} onClick={() => setTab('imports')}>Historique des imports</button>
        </div>

        {tab === 'partenaires' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={() => { setForm({ code: '', nom: '' }); setEditId(null); setModal(true) }}>
                <Plus size={15} /> Ajouter un partenaire
              </button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom complet</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partenaires.map(p => (
                    <tr key={p.id}>
                      <td><span className="badge badge-blue mono">{p.code}</span></td>
                      <td style={{ fontWeight: 500 }}>{p.nom}</td>
                      <td>
                        <span className={`badge ${p.actif ? 'badge-green' : 'badge-gray'}`}>
                          {p.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" onClick={() => { setForm({ code: p.code, nom: p.nom }); setEditId(p.id); setModal(true) }}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => togglePartenaire(p)}>
                            {p.actif ? 'Désactiver' : 'Activer'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'imports' && (
          <div className="card" style={{ padding: 0 }}>
            {imports.length === 0 ? (
              <div className="empty-state"><History size={32} /><p>Aucun import enregistré</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Période</th>
                    <th>Fichier</th>
                    <th>Labs importés</th>
                    <th>Non reconnus</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map(imp => (
                    <tr key={imp.id}>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {new Date(imp.imported_at).toLocaleDateString('fr', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{MOIS_LABELS[imp.mois - 1]} {imp.annee}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>{imp.nom_fichier || '—'}</td>
                      <td><span className="badge badge-green">{imp.nb_labs_importes}</span></td>
                      <td>
                        {imp.nb_labs_inconnus > 0
                          ? <span className="badge badge-amber">{imp.nb_labs_inconnus}</span>
                          : <span className="badge badge-gray">0</span>
                        }
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 200 }}>
                        {imp.labs_inconnus?.length > 0 ? imp.labs_inconnus.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Modifier le partenaire' : 'Nouveau partenaire'}</div>
              <button className="btn-icon" onClick={() => setModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Code (ex: MJS, EDU) *</label>
                <input className="form-input" placeholder="NOUVEAU" value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} />
              </div>
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input className="form-input" placeholder="Nom de l'organisation" value={form.nom}
                  onChange={e => setForm({ ...form, nom: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={savePartenaire} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
