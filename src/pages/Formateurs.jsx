import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, Pencil, Archive, RotateCcw, X, Users } from 'lucide-react'

const GROUPES = ['Brain Management CDI', 'Arron Groupe A', 'Arron Groupe B']
const EMPTY_FORM = {
  matricule: '', nom: '', prenom: '', cin: '',
  groupe: 'Brain Management CDI',
  tx_horaire_p: 17.1, tx_horaire_f: 22.74, net_base: '',
  lab_key_1: '', lab_key_2: '', lab_key_3: '',
  actif: true, notes: ''
}

const TX_F_DEFAULT = { 'Brain Management CDI': 22.74, 'Arron Groupe A': 20.92, 'Arron Groupe B': 17.955 }

export default function Formateurs() {
  const [formateurs, setFormateurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGroupe, setFilterGroupe] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => { loadAll() }, [showArchived])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase.from('formateurs').select('*').eq('actif', showArchived ? false : true)
    setFormateurs(data || [])
    setLoading(false)
  }

  const filtered = formateurs.filter(f => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${f.prenom} ${f.nom}`.toLowerCase().includes(q) || f.cin?.toLowerCase().includes(q)
    const matchGroupe = !filterGroupe || f.groupe === filterGroupe
    return matchSearch && matchGroupe
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModal(true)
  }

  function openEdit(f) {
    setForm({
      matricule: f.matricule || '',
      nom: f.nom || '',
      prenom: f.prenom || '',
      cin: f.cin || '',
      groupe: f.groupe || 'Brain Management CDI',
      tx_horaire_p: f.tx_horaire_p || 17.1,
      tx_horaire_f: f.tx_horaire_f || 22.74,
      net_base: f.net_base || '',
      lab_key_1: f.lab_key_1 || '',
      lab_key_2: f.lab_key_2 || '',
      lab_key_3: f.lab_key_3 || '',
      actif: f.actif,
      notes: f.notes || ''
    })
    setEditId(f.id)
    setModal(true)
  }

  function handleGroupeChange(groupe) {
    setForm(f => ({ ...f, groupe, tx_horaire_f: TX_F_DEFAULT[groupe] || f.tx_horaire_f }))
  }

  async function save() {
    if (!form.nom || !form.prenom || !form.groupe) return
    setSaving(true)
    const payload = {
      ...form,
      tx_horaire_p: parseFloat(form.tx_horaire_p) || 17.1,
      tx_horaire_f: parseFloat(form.tx_horaire_f) || 22.74,
      net_base: form.net_base ? parseFloat(form.net_base) : null,
      updated_at: new Date().toISOString()
    }
    if (editId) {
      await supabase.from('formateurs').update(payload).eq('id', editId)
    } else {
      const { data: pays } = await supabase.from('pays').select('id').eq('code', 'MA').single()
      await supabase.from('formateurs').insert({ ...payload, pays_id: pays.id })
    }
    setSaving(false)
    setModal(false)
    loadAll()
  }

  async function toggleActif(f) {
    await supabase.from('formateurs').update({ actif: !f.actif, updated_at: new Date().toISOString() }).eq('id', f.id)
    setConfirmAction(null)
    loadAll()
  }

  async function deleteFormateur(id) {
    await supabase.from('formateurs').delete().eq('id', id)
    setConfirmAction(null)
    loadAll()
  }

  const groupBadge = (groupe) => {
    if (groupe === 'Brain Management CDI') return 'badge-purple'
    if (groupe === 'Arron Groupe A') return 'badge-blue'
    return 'badge-green'
  }

  const groupShort = (groupe) => {
    if (groupe === 'Brain Management CDI') return 'BM CDI'
    if (groupe === 'Arron Groupe A') return 'Arron A'
    return 'Arron B'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Formateurs</h1>
          <p className="page-sub">{formateurs.length} formateurs · Maroc</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Voir actifs' : 'Voir inactifs'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} /> Ajouter un formateur
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="search-wrap">
            <Search size={13} />
            <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 200 }} value={filterGroupe} onChange={e => setFilterGroupe(e.target.value)}>
            <option value="">Tous les groupes</option>
            {GROUPES.map(g => <option key={g}>{g}</option>)}
          </select>
          <span className="text-muted text-sm">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-page"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><Users size={32} /><p>Aucun formateur trouvé</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Matr.</th>
                    <th>Nom</th>
                    <th>CIN</th>
                    <th>Groupe</th>
                    <th>TX.F (MAD/h)</th>
                    <th>Net base</th>
                    <th>Lab assigné</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id}>
                      <td><span className="mono badge badge-gray">{f.matricule || '—'}</span></td>
                      <td style={{ fontWeight: 500 }}>{f.prenom} {f.nom}</td>
                      <td className="mono">{f.cin || '—'}</td>
                      <td><span className={`badge ${groupBadge(f.groupe)}`}>{groupShort(f.groupe)}</span></td>
                      <td className="mono">{f.tx_horaire_f}</td>
                      <td className="mono">{f.net_base ? `${f.net_base.toLocaleString('fr')} MAD` : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                        {[f.lab_key_1, f.lab_key_2, f.lab_key_3].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Modifier" onClick={() => openEdit(f)}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn-icon" title={f.actif ? 'Désactiver' : 'Réactiver'}
                            onClick={() => setConfirmAction({ f, action: f.actif ? 'deactivate' : 'activate' })}>
                            {f.actif ? <Archive size={13} /> : <RotateCcw size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Modifier le formateur' : 'Ajouter un formateur'}</div>
              <button className="btn-icon" onClick={() => setModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prénom *</label>
                  <input className="form-input" value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nom *</label>
                  <input className="form-input" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Matricule</label>
                  <input className="form-input" placeholder="368" value={form.matricule} onChange={e => setForm({ ...form, matricule: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">CIN</label>
                  <input className="form-input" placeholder="G529643" value={form.cin} onChange={e => setForm({ ...form, cin: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Groupe *</label>
                <select className="form-select" value={form.groupe} onChange={e => handleGroupeChange(e.target.value)}>
                  {GROUPES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">TX Horaire P</label>
                  <input className="form-input" type="number" step="0.01" value={form.tx_horaire_p} onChange={e => setForm({ ...form, tx_horaire_p: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">TX Horaire F</label>
                  <input className="form-input" type="number" step="0.01" value={form.tx_horaire_f} onChange={e => setForm({ ...form, tx_horaire_f: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Net de base (MAD)</label>
                  <input className="form-input" type="number" placeholder="3000" value={form.net_base} onChange={e => setForm({ ...form, net_base: e.target.value })} />
                </div>
              </div>
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Lab key 1</label>
                  <input className="form-input" placeholder="AZIZI Btissame" value={form.lab_key_1} onChange={e => setForm({ ...form, lab_key_1: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Lab key 2</label>
                  <input className="form-input" value={form.lab_key_2} onChange={e => setForm({ ...form, lab_key_2: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Lab key 3</label>
                  <input className="form-input" value={form.lab_key_3} onChange={e => setForm({ ...form, lab_key_3: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" placeholder="Congé maternité, cas particulier..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                {editId ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm */}
      {confirmAction && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmAction(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">
                {confirmAction.action === 'deactivate' ? 'Désactiver ce formateur ?' : 'Réactiver ?'}
              </div>
              <button className="btn-icon" onClick={() => setConfirmAction(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p>{confirmAction.f.prenom} {confirmAction.f.nom}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmAction(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => deleteFormateur(confirmAction.f.id)}>Supprimer définitivement</button>
              <button className="btn btn-primary" onClick={() => toggleActif(confirmAction.f)}>
                {confirmAction.action === 'deactivate' ? 'Désactiver' : 'Réactiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
