import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, Pencil, Archive, RotateCcw, Trash2, X, FlaskConical } from 'lucide-react'

const ZONES = ['Urbaine', 'Rurale']
const CONTEXTES = ['Standard', 'Difficile', 'Social spécifique']
const ENGAGEMENTS = ['Moyen', 'Bon', 'Excellent']

const EMPTY_FORM = {
  code: '', nom: '', partenaire_id: '', formateur_id: '',
  ville: '', zone: 'Urbaine', nb_pcs: '', contexte: 'Standard', engagement: 'Moyen'
}

export default function Labs() {
  const [labs, setLabs] = useState([])
  const [partenaires, setPartenaires] = useState([])
  const [formateurs, setFormateurs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPart, setFilterPart] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(null)

  useEffect(() => { loadAll() }, [showArchived])

  async function loadAll() {
    setLoading(true)
    const [{ data: l }, { data: p }, { data: f }] = await Promise.all([
      supabase.from('labs').select('*, partenaires(id, code, nom), formateurs(id, nom, prenom)')
        .eq('archive', showArchived),
      supabase.from('partenaires').select('*').eq('actif', true),
      supabase.from('formateurs').select('id, nom, prenom, groupe').eq('actif', true),
    ])
    setLabs(l || [])
    setPartenaires(p || [])
    setFormateurs(f || [])
    setLoading(false)
  }

  const filtered = labs.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.nom.toLowerCase().includes(q) || l.ville?.toLowerCase().includes(q)
    const matchPart = !filterPart || l.partenaire_id === filterPart
    return matchSearch && matchPart
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModal('form')
  }

  function openEdit(lab) {
    setForm({
      code: lab.code || '',
      nom: lab.nom || '',
      partenaire_id: lab.partenaire_id || '',
      formateur_id: lab.formateur_id || '',
      ville: lab.ville || '',
      zone: lab.zone || 'Urbaine',
      nb_pcs: lab.nb_pcs || '',
      contexte: lab.contexte || 'Standard',
      engagement: lab.engagement || 'Moyen',
    })
    setEditId(lab.id)
    setModal('form')
  }

  async function save() {
    if (!form.nom || !form.code) return
    setSaving(true)
    const payload = {
      ...form,
      nb_pcs: form.nb_pcs ? parseInt(form.nb_pcs) : null,
      formateur_id: form.formateur_id || null,
      partenaire_id: form.partenaire_id || null,
    }
    if (editId) {
      await supabase.from('labs').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
    } else {
      // Get pays_id (Maroc)
      const { data: pays } = await supabase.from('pays').select('id').eq('code', 'MA').single()
      await supabase.from('labs').insert({ ...payload, pays_id: pays.id })
    }
    setSaving(false)
    setModal(null)
    loadAll()
  }

  async function toggleArchive(lab) {
    await supabase.from('labs').update({ archive: !lab.archive, updated_at: new Date().toISOString() }).eq('id', lab.id)
    setConfirmArchive(null)
    loadAll()
  }

  async function deleteLab(id) {
    await supabase.from('labs').delete().eq('id', id)
    setConfirmArchive(null)
    loadAll()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Labs</h1>
          <p className="page-sub">{labs.length} labs · Maroc</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Voir actifs' : 'Voir archivés'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} /> Ajouter un lab
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="search-wrap">
            <Search size={13} />
            <input className="search-input" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={filterPart} onChange={e => setFilterPart(e.target.value)}>
            <option value="">Tous partenaires</option>
            {partenaires.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
          </select>
          <span className="text-muted text-sm">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <div className="loading-page"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <FlaskConical size={32} />
              <p>Aucun lab trouvé</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom du lab</th>
                    <th>Partenaire</th>
                    <th>Formateur</th>
                    <th>Ville</th>
                    <th>Zone</th>
                    <th>PCs</th>
                    <th>Contexte</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lab => (
                    <tr key={lab.id}>
                      <td><span className="mono badge badge-gray">{lab.code}</span></td>
                      <td style={{ maxWidth: 280 }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lab.nom}</div>
                      </td>
                      <td>
                        {lab.partenaires && (
                          <span className="badge badge-blue">{lab.partenaires.code}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {lab.formateurs ? `${lab.formateurs.prenom} ${lab.formateurs.nom}` : <span className="text-muted">—</span>}
                      </td>
                      <td>{lab.ville || '—'}</td>
                      <td>
                        <span className={`badge ${lab.zone === 'Rurale' ? 'badge-amber' : 'badge-blue'}`}>{lab.zone}</span>
                      </td>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{lab.nb_pcs ?? '—'}</td>
                      <td>
                        <span className={`badge ${lab.contexte === 'Difficile' ? 'badge-orange' : lab.contexte === 'Social spécifique' ? 'badge-purple' : 'badge-gray'}`}>
                          {lab.contexte}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Modifier" onClick={() => openEdit(lab)}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn-icon" title={lab.archive ? 'Restaurer' : 'Archiver'} onClick={() => setConfirmArchive({ lab, action: lab.archive ? 'restore' : 'archive' })}>
                            {lab.archive ? <RotateCcw size={13} /> : <Archive size={13} />}
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
      {modal === 'form' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Modifier le lab' : 'Ajouter un lab'}</div>
              <button className="btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Code *</label>
                  <input className="form-input" placeholder="Lab82" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre de PCs</label>
                  <input className="form-input" type="number" placeholder="10" value={form.nb_pcs} onChange={e => setForm({ ...form, nb_pcs: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nom complet *</label>
                <input className="form-input" placeholder="Lab82 - Centre FRONTON" value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Partenaire</label>
                  <select className="form-select" value={form.partenaire_id} onChange={e => setForm({ ...form, partenaire_id: e.target.value })}>
                    <option value="">— Sélectionner —</option>
                    {partenaires.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Formateur assigné</label>
                  <select className="form-select" value={form.formateur_id} onChange={e => setForm({ ...form, formateur_id: e.target.value })}>
                    <option value="">— Sélectionner —</option>
                    {formateurs.map(f => <option key={f.id} value={f.id}>{f.prenom} {f.nom} ({f.groupe})</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ville</label>
                  <input className="form-input" placeholder="Casablanca" value={form.ville} onChange={e => setForm({ ...form, ville: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Zone</label>
                  <select className="form-select" value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}>
                    {ZONES.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contexte</label>
                  <select className="form-select" value={form.contexte} onChange={e => setForm({ ...form, contexte: e.target.value })}>
                    {CONTEXTES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Engagement</label>
                  <select className="form-select" value={form.engagement} onChange={e => setForm({ ...form, engagement: e.target.value })}>
                    {ENGAGEMENTS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : null}
                {editId ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Archive/Delete */}
      {confirmArchive && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmArchive(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">
                {confirmArchive.action === 'archive' ? 'Archiver ce lab ?' : confirmArchive.action === 'restore' ? 'Restaurer ce lab ?' : 'Supprimer ?'}
              </div>
              <button className="btn-icon" onClick={() => setConfirmArchive(null)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <p className="text-muted">{confirmArchive.lab.nom}</p>
              {confirmArchive.action === 'archive' && (
                <p style={{ marginTop: 8, fontSize: 13 }}>Le lab sera archivé mais ses données seront conservées.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmArchive(null)}>Annuler</button>
              {confirmArchive.action === 'delete' && (
                <button className="btn btn-danger" onClick={() => deleteLab(confirmArchive.lab.id)}>Supprimer</button>
              )}
              <button className="btn btn-primary" onClick={() => toggleArchive(confirmArchive.lab)}>
                {confirmArchive.action === 'restore' ? 'Restaurer' : 'Archiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
