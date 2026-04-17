import React, { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const MOIS_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

export default function Import() {
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [step, setStep] = useState('select') // select | preview | confirm | done
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [existingData, setExistingData] = useState(false)
  const fileRef = useRef()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  async function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)

    // Parse Excel
    const buf = await f.arrayBuffer()
    const wb = XLSX.read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

    // Find header row (contains 'Laboratoire')
    let headerIdx = rows.findIndex(r => r.some(c => String(c || '').includes('Laboratoire')))
    if (headerIdx === -1) headerIdx = 0

    const data = rows.slice(headerIdx + 1).filter(r => r[1] && String(r[1]).trim())
    const parsed = data.map(r => ({
      type: String(r[0] || '').trim(),
      nom: String(r[1] || '').trim(),
      etudiants: parseInt(r[2]) || 0,
      cours: parseInt(r[3]) || 0,
    })).filter(r => r.nom && r.etudiants > 0)

    setPreview(parsed)

    // Check if data already exists for this mois/annee
    const { data: existing } = await supabase
      .from('participants_mensuels')
      .select('id')
      .eq('annee', annee)
      .eq('mois', mois)
      .limit(1)
    setExistingData(existing && existing.length > 0)
    setStep('preview')
  }

  // Extract lab code from name (e.g. "Lab82", "Lab 82")
  function extractCode(nom) {
    const m = nom.match(/Lab\s*(\d+)/i)
    return m ? `Lab${m[1]}` : null
  }

  async function doImport() {
    setImporting(true)
    const { data: allLabs } = await supabase.from('labs').select('id, nom, code').eq('archive', false)

    let imported = 0, unknown = [], overwritten = 0

    for (const row of preview) {
      // Try to match by code in name
      const code = extractCode(row.nom)
      let matched = null

      if (code) {
        matched = allLabs.find(l => l.code?.toLowerCase() === code.toLowerCase())
      }
      if (!matched) {
        // Fuzzy match: find lab whose nom contains the number
        const numMatch = row.nom.match(/\d+/)
        if (numMatch) {
          matched = allLabs.find(l => l.code?.includes(numMatch[0]) || l.nom.includes(numMatch[0]))
        }
      }
      if (!matched) {
        unknown.push(row.nom)
        continue
      }

      // Upsert
      const { error } = await supabase.from('participants_mensuels').upsert({
        lab_id: matched.id,
        annee,
        mois,
        nb_etudiants: row.etudiants,
        nb_cours: row.cours,
        source_import: 'excel',
        imported_at: new Date().toISOString()
      }, { onConflict: 'lab_id,annee,mois' })

      if (!error) imported++
    }

    // Log
    await supabase.from('import_log').insert({
      annee, mois,
      nom_fichier: file.name,
      nb_labs_importes: imported,
      nb_labs_inconnus: unknown.length,
      labs_inconnus: unknown
    })

    setResult({ imported, unknown })
    setStep('done')
    setImporting(false)
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setStep('select')
    setResult(null)
    setExistingData(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Import mensuel</h1>
          <p className="page-sub">Chargement des données participants depuis Excel</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 760 }}>

        {/* Step 1 — Selection mois/annee + upload */}
        <div className="card mb-24">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>1 · Sélectionner la période</div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <div className="form-group">
              <label className="form-label">Mois</label>
              <select className="form-select" value={mois} onChange={e => { setMois(parseInt(e.target.value)); reset() }}>
                {MOIS_LABELS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Année</label>
              <select className="form-select" value={annee} onChange={e => { setAnnee(parseInt(e.target.value)); reset() }}>
                {years.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2 — Upload file */}
        {step === 'select' && (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
              2 · Importer le fichier Excel — {MOIS_LABELS[mois - 1]} {annee}
            </div>
            <div
              style={{
                border: '2px dashed var(--border2)',
                borderRadius: 10,
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s'
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const fake = { target: { files: [f] } }; handleFile(fake) } }}
            >
              <FileSpreadsheet size={36} style={{ color: 'var(--accent)', marginBottom: 12 }} />
              <div style={{ fontWeight: 500, marginBottom: 6 }}>Glissez votre fichier Excel ici</div>
              <div className="text-muted text-sm">ou cliquez pour parcourir · Format: .xlsx, .xls</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
            </div>
            <div className="alert alert-info" style={{ marginTop: 16, marginBottom: 0 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>Format attendu : colonnes <strong>Laboratoire</strong>, <strong>Etudiants</strong>, <strong>Cours</strong>. Le matching se fait automatiquement par numéro de lab (Lab82, Lab05…).</div>
            </div>
          </div>
        )}

        {/* Step 3 — Preview */}
        {step === 'preview' && preview && (
          <div className="card">
            <div className="flex-between mb-16">
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                2 · Aperçu — {preview.length} lignes détectées
              </div>
              <button className="btn-icon" onClick={reset}><X size={16} /></button>
            </div>

            {existingData && (
              <div className="alert alert-warning mb-16">
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <div>Des données existent déjà pour <strong>{MOIS_LABELS[mois - 1]} {annee}</strong>. L'import <strong>écrasera</strong> les données existantes pour les labs correspondants.</div>
              </div>
            )}

            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Laboratoire</th>
                    <th style={{ textAlign: 'right' }}>Étudiants</th>
                    <th style={{ textAlign: 'right' }}>Cours</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-gray">{r.type}</span></td>
                      <td style={{ fontSize: 12 }}>{r.nom}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{r.etudiants}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{r.cours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={reset}>Annuler</button>
              <button className="btn btn-primary" onClick={doImport} disabled={importing}>
                {importing ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Upload size={14} />}
                Confirmer l'import
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Done */}
        {step === 'done' && result && (
          <div className="card">
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle size={40} style={{ color: 'var(--green)', marginBottom: 12 }} />
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Import terminé</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
                {result.imported} labs importés · {MOIS_LABELS[mois - 1]} {annee}
              </div>

              {result.unknown.length > 0 && (
                <div className="alert alert-warning" style={{ textAlign: 'left', marginBottom: 16 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>{result.unknown.length} lab(s) non reconnu(s)</strong> — à ajouter manuellement dans Gestion Labs :
                    <ul style={{ marginTop: 6, paddingLeft: 16, fontSize: 12 }}>
                      {result.unknown.map((u, i) => <li key={i}>{u}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <button className="btn btn-primary" onClick={reset}>
                Nouvel import
              </button>
            </div>
          </div>
        )}

        {/* History note */}
        <div style={{ marginTop: 24, padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text3)' }}>
          Tous les imports sont tracés automatiquement. Pour consulter l'historique, allez dans Paramètres → Historique des imports.
        </div>
      </div>
    </div>
  )
}
