import { useEffect, useState } from 'react'
import { Upload, CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp,
         Loader2, Save, Download, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

// ── shared helpers ────────────────────────────────────────────
function boolFromStr(v) {
  if (v === null || v === undefined || v === '') return true
  return ['si','sí','yes','true','1'].includes(v.toString().toLowerCase())
}
function numOrNull(v) {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}
function norm(s) { return s?.toString().toLowerCase().trim() ?? '' }

// ── component ─────────────────────────────────────────────────
export default function Importar() {
  const [tab, setTab] = useState('lugares')
  const TABS = [['lugares','Lugares'],['productos','Productos'],['planilla','Planillas de entregas']]
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Importar</h1>
        <p className="text-sm text-slate-500 mt-0.5">Cargá datos masivamente desde Excel</p>
      </div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab===v ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'lugares'   && <ImportarLugares />}
      {tab === 'productos' && <ImportarProductos />}
      {tab === 'planilla'  && <ImportarPlanilla />}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// TAB: LUGARES
// ═════════════════════════════════════════════════════════════
const LUGAR_COLS = ['id_numerico','nombre','nombre_patri','direccion',
  'estado','contacto_nombre','contacto_apellido','contacto_dni','contacto_tel',
  'metros_cuadrados','cantidad_empleados','cantidad_banos','cantidad_pisos',
  'acceso_publico','tiene_cocina','frecuencia_limpieza','personal_limpieza',
  'dia_reparto','observaciones']
const TIPO_OPTS   = ['administrativo','salud','deportivo','educativo','seguridad','servicios','otro']
const ESTADO_OPTS = ['activo','inactivo','revisar']

function downloadLugaresTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    LUGAR_COLS,
    [1,'Palacio Municipal','Municipalidad de Tigre','Av. Cazón 1514','administrativo','activo','Juan Pérez','1123456789',500,30,4,2,'SI','NO',5,2,'Lunes','Ejemplo'],
  ])
  ws['!cols'] = LUGAR_COLS.map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lugares')
  XLSX.writeFile(wb, 'template_lugares.xlsx')
}

// Mapeo de encabezados amigables → nombre interno del campo
const FRIENDLY_MAP = {
  'id': 'id_numerico',
  'id (no cambiar)': 'id_numerico',
  'nombre park service': 'nombre',
  'nombre park service ⭐': 'nombre',
  'nombre entrega (patri)': 'nombre_patri',
  'nombre anterior': 'nombre_patri',
  'dirección': 'direccion',
  'direccion': 'direccion',
  'estado': 'estado',
  'contacto nombre': 'contacto_nombre',
  'contacto apellido': 'contacto_apellido',
  'contacto dni': 'contacto_dni',
  'contacto tel': 'contacto_tel',
  'm²': 'metros_cuadrados',
  'empleados': 'cantidad_empleados',
  'baños': 'cantidad_banos',
  'pisos': 'cantidad_pisos',
  'acceso público (si/no)': 'acceso_publico',
  'tiene cocina (si/no)': 'tiene_cocina',
  'frec. limpieza (días)': 'frecuencia_limpieza',
  'personal limpieza': 'personal_limpieza',
  'día de reparto': 'dia_reparto',
  'dia de reparto': 'dia_reparto',
  'observaciones': 'observaciones',
  // nombres internos directos (compatibilidad hacia atrás)
  'id_numerico': 'id_numerico',
  'nombre': 'nombre',
  'nombre_patri': 'nombre_patri',
  'nombre_anterior': 'nombre_patri',
}

function parseLugaresFile(wb) {
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
  if (raw.length < 2) return []
  // Row 0 = encabezados (amigables o internos)
  // Si la primera celda es numérica, no hay encabezado — poco probable pero se maneja
  const hasHeader = isNaN(Number(raw[0][0]?.toString().trim()))
  const headerRow = hasHeader ? raw[0] : null
  const dataStart = hasHeader ? 1 : 0
  const headers = headerRow
    ? headerRow.map(h => {
        const key = h?.toString().trim().toLowerCase()
        return FRIENDLY_MAP[key] ?? key.replace(/[^a-z0-9_]/g,'')
      })
    : LUGAR_COLS
  return raw.slice(dataStart).filter(r => r[0] !== '' && r[0] !== null && r[0] !== undefined).map(row => {
    const obj = {}
    headers.forEach((h,i) => { if (h) obj[h] = row[i]?.toString().trim() ?? '' })
    return obj
  })
}


async function geocodeAddress(address) {
  if (!address) return { lat: null, lng: null }
  try {
    const query = encodeURIComponent(address + (address.toLowerCase().includes('tigre') || address.toLowerCase().includes('san fernando') ? '' : ', Tigre, Buenos Aires, Argentina'))
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`, {
      headers: { 'Accept-Language': 'es' }
    })
    const data = await res.json()
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return { lat: null, lng: null }
}

function ImportarLugares() {
  const [step, setStep]           = useState('upload')
  const [parsed, setParsed]       = useState([])
  const [existing, setExisting]   = useState([])
  const [preview, setPreview]     = useState([])
  const [dupAction, setDupAction] = useState('skip')
  const [saving, setSaving]       = useState(false)
  const [result, setResult]       = useState(null)

  useEffect(() => { supabase.from('lugares').select('id,id_numerico,nombre').then(({data}) => setExisting(data ?? [])) }, [])

  function buildPreview(rows, ex) {
    return rows.map(r => {
      const byId   = r.id_numerico ? ex.find(e => e.id_numerico === parseInt(r.id_numerico)) : null
      const byName = ex.find(e => norm(e.nombre) === norm(r.nombre))
      const found  = byId ?? byName
      return { ...r, _status: found ? 'duplicado' : 'nuevo', _id: found?.id ?? null }
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    const wb   = XLSX.read(await file.arrayBuffer())
    const rows = parseLugaresFile(wb)
    setParsed(rows)
    setPreview(buildPreview(rows, existing))
    setStep('preview')
  }

  async function doImport() {
    setSaving(true)
    let created=0, updated=0, skipped=0
    for (const row of preview) {
      // Geocode address if present and no lat/lng in row
      let lat = null, lng = null
      if (row.direccion?.trim()) {
        const geo = await geocodeAddress(row.direccion.trim())
        lat = geo.lat; lng = geo.lng
        await new Promise(r => setTimeout(r, 1100)) // Nominatim rate limit
      }
      const payload = {
        id_numerico:         row.id_numerico ? parseInt(row.id_numerico) : null,
        nombre:              row.nombre?.trim(),
        nombre_anterior:     row.nombre_patri?.trim()        || null,
        direccion:           row.direccion?.trim()           || null,
        lat, lng,
        estado:              ESTADO_OPTS.includes(row.estado)   ? row.estado     : 'activo',
        contacto_nombre:     row.contacto_nombre?.trim()     || null,
        contacto_apellido:   row.contacto_apellido?.trim()   || null,
        contacto_dni:        row.contacto_dni?.trim()        || null,
        contacto_tel:        row.contacto_tel?.trim()        || null,
        metros_cuadrados:    numOrNull(row.metros_cuadrados),
        cantidad_empleados:  numOrNull(row.cantidad_empleados),
        cantidad_banos:      numOrNull(row.cantidad_banos),
        cantidad_pisos:      numOrNull(row.cantidad_pisos),
        acceso_publico:      boolFromStr(row.acceso_publico),
        tiene_cocina:        boolFromStr(row.tiene_cocina),
        frecuencia_limpieza: numOrNull(row.frecuencia_limpieza),
        personal_limpieza:   numOrNull(row.personal_limpieza),
        dia_reparto:         row.dia_reparto?.trim()         || null,
        observaciones:       row.observaciones?.trim()       || null,
      }
      if (row._status === 'nuevo') {
        await supabase.from('lugares').insert(payload); created++
      } else if (dupAction === 'update') {
        // Solo pisar campos que vienen con valor — celdas vacías no borran datos existentes
        const existente = existing.find(e => e.id === row._id) || {}
        const safePayload = Object.fromEntries(
          Object.entries(payload).filter(([k, v]) => {
            if (v !== null && v !== undefined && v !== '') return true
            // Si el valor es vacío/null, solo lo incluimos si el campo existente también era vacío
            return existente[k] === null || existente[k] === undefined || existente[k] === ''
          })
        )
        await supabase.from('lugares').update({ ...safePayload, updated_at: new Date().toISOString() }).eq('id', row._id); updated++
      } else { skipped++ }
    }
    setSaving(false)
    setResult({ created, updated, skipped })
    setStep('done')
  }

  const nuevos     = preview.filter(r => r._status === 'nuevo').length
  const duplicados = preview.filter(r => r._status === 'duplicado').length
  const toImport   = nuevos + (dupAction === 'update' ? duplicados : 0)

  return <ImportLayout
    step={step} saving={saving} result={result}
    templateBtn={<button onClick={downloadLugaresTemplate}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700">
      <Download size={14}/> Descargar plantilla
    </button>}
    uploadHint="Subí el Excel con los lugares"
    onFile={handleFile}
    onReset={() => { setStep('upload'); setParsed([]); setPreview([]); setResult(null) }}
    onImport={doImport}
    toImport={toImport}
    duplicatePanel={duplicados > 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-sm font-medium text-amber-800 mb-2">¿Qué hacer con los {duplicados} que ya existen?</div>
        <div className="flex flex-wrap gap-4">
          {[['skip','Ignorarlos (no tocar lo que ya está)'],['update','Actualizarlos con los datos del archivo']].map(([v,l]) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
              <input type="radio" name="dupLug" value={v} checked={dupAction===v}
                onChange={() => setDupAction(v)} className="accent-emerald-600"/> {l}
            </label>
          ))}
        </div>
      </div>
    )}
    previewTable={
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b border-slate-100">
            <tr>
              <th className="px-3 py-2 w-5"></th>
              <th className="text-left px-3 py-2 text-slate-500 w-10">#</th>
              <th className="text-left px-3 py-2 text-slate-500">Nombre</th>
              <th className="text-left px-3 py-2 text-slate-500 hidden sm:table-cell">Dirección</th>
              <th className="text-left px-3 py-2 text-slate-500 hidden md:table-cell">Tipo</th>
              <th className="text-left px-3 py-2 text-slate-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {preview.map((r,i) => (
              <tr key={i} className={r._status === 'duplicado' ? 'bg-amber-50/50' : ''}>
                <td className="px-3 py-2">{r._status==='nuevo' ? <CheckCircle size={13} className="text-emerald-500"/> : <AlertCircle size={13} className="text-amber-400"/>}</td>
                <td className="px-3 py-2 font-mono text-slate-400 text-xs">{r.id_numerico||'—'}</td>
                <td className="px-3 py-2 font-medium text-slate-700">{r.nombre}{r._status==='duplicado' && <span className="ml-1.5 text-amber-500 font-normal text-xs">· ya existe</span>}</td>
                <td className="px-3 py-2 text-slate-400 hidden sm:table-cell truncate max-w-xs">{r.direccion||'—'}</td>
                <td className="px-3 py-2 text-slate-400 capitalize">{r.estado||'activo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    }
    stats={{ nuevos, duplicados }}
    resultLabel="lugares"
  />
}

// ═════════════════════════════════════════════════════════════
// TAB: PRODUCTOS
// ═════════════════════════════════════════════════════════════
const PROD_COLS = ['nombre','codigo_interno','categoria','unidad_entrega',
  'unidad_compra','factor_conversion','stock_minimo','activo']
const UNIDADES  = ['unidad','litro','kg','ml','gr','rollo','par','caja','paquete','bidón','saco','tarro']

function downloadProductosTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    PROD_COLS,
    ['Papel higiénico doble hoja','PHD-001','Higiene','rollo','fardo',96,500,'SI'],
    ['Desengrasante industrial','DEG-001','Limpieza','litro','bidón de 5L',5,20,'SI'],
  ])
  ws['!cols'] = PROD_COLS.map(() => ({ wch: 22 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Productos')
  XLSX.writeFile(wb, 'template_productos.xlsx')
}

function parseProductosFile(wb) {
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
  if (raw.length < 2) return []
  const headers = raw[0].map(h => h?.toString().trim().toLowerCase())
  return raw.slice(1).filter(r => r[0]).map(row => {
    const obj = {}
    headers.forEach((h,i) => { obj[h] = row[i]?.toString().trim() ?? '' })
    return obj
  })
}

function ImportarProductos() {
  const [step, setStep]           = useState('upload')
  const [parsed, setParsed]       = useState([])
  const [existing, setExisting]   = useState([])
  const [categorias, setCategorias] = useState([])
  const [preview, setPreview]     = useState([])
  const [dupAction, setDupAction] = useState('skip')
  const [saving, setSaving]       = useState(false)
  const [result, setResult]       = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('productos').select('id,nombre,codigo_interno'),
      supabase.from('categorias_producto').select('id,nombre'),
    ]).then(([p, c]) => {
      setExisting(p.data ?? [])
      setCategorias(c.data ?? [])
    })
  }, [])

  function buildPreview(rows) {
    return rows.map(r => {
      const byCode = r.codigo_interno ? existing.find(e => norm(e.codigo_interno) === norm(r.codigo_interno)) : null
      const byName = existing.find(e => norm(e.nombre) === norm(r.nombre))
      const found  = byCode || byName
      // resolve categoria
      const cat = categorias.find(c => norm(c.nombre) === norm(r.categoria))
      return { ...r, _status: found ? 'duplicado' : 'nuevo', _id: found?.id ?? null, _cat_id: cat?.id ?? null, _cat_ok: !!cat || !r.categoria }
    })
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    const rows = parseProductosFile(XLSX.read(await file.arrayBuffer()))
    setParsed(rows)
    setPreview(buildPreview(rows))
    setStep('preview')
  }

  async function doImport() {
    setSaving(true)
    let created=0, updated=0, skipped=0
    for (const row of preview) {
      const payload = {
        nombre:            row.nombre?.trim(),
        codigo_interno:    row.codigo_interno?.trim()    || null,
        categoria_id:      row._cat_id                  || null,
        unidad:            UNIDADES.includes(row.unidad_entrega) ? row.unidad_entrega : 'unidad',
        unidad_entrega:    UNIDADES.includes(row.unidad_entrega) ? row.unidad_entrega : 'unidad',
        unidad_compra:     row.unidad_compra?.trim()    || null,
        factor_conversion: numOrNull(row.factor_conversion) ?? 1,
        stock_minimo:      numOrNull(row.stock_minimo)  ?? 0,
        activo:            boolFromStr(row.activo),
      }
      if (row._status === 'nuevo') {
        await supabase.from('productos').insert(payload); created++
      } else if (dupAction === 'update') {
        await supabase.from('productos').update(payload).eq('id', row._id); updated++
      } else { skipped++ }
    }
    setSaving(false)
    setResult({ created, updated, skipped })
    setStep('done')
  }

  const nuevos     = preview.filter(r => r._status === 'nuevo').length
  const duplicados = preview.filter(r => r._status === 'duplicado').length
  const sinCat     = preview.filter(r => r.categoria && !r._cat_id).length
  const toImport   = nuevos + (dupAction === 'update' ? duplicados : 0)

  return <ImportLayout
    step={step} saving={saving} result={result}
    templateBtn={<button onClick={downloadProductosTemplate}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700">
      <Download size={14}/> Descargar plantilla
    </button>}
    uploadHint="Subí el Excel con los productos"
    onFile={handleFile}
    onReset={() => { setStep('upload'); setParsed([]); setPreview([]); setResult(null) }}
    onImport={doImport}
    toImport={toImport}
    duplicatePanel={<>
      {sinCat > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
          ⚠ {sinCat} producto(s) tienen una categoría que no existe en el sistema — se importarán sin categoría. Podés crear las categorías desde la página de Productos.
        </div>
      )}
      {duplicados > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-sm font-medium text-amber-800 mb-2">¿Qué hacer con los {duplicados} que ya existen?</div>
          <div className="flex flex-wrap gap-4">
            {[['skip','Ignorarlos'],['update','Actualizarlos con los datos del archivo']].map(([v,l]) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input type="radio" name="dupProd" value={v} checked={dupAction===v}
                  onChange={() => setDupAction(v)} className="accent-emerald-600"/> {l}
              </label>
            ))}
          </div>
        </div>
      )}
    </>}
    previewTable={
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white border-b border-slate-100">
            <tr>
              <th className="px-3 py-2 w-5"></th>
              <th className="text-left px-3 py-2 text-slate-500">Nombre</th>
              <th className="text-left px-3 py-2 text-slate-500 hidden sm:table-cell">Código</th>
              <th className="text-left px-3 py-2 text-slate-500 hidden md:table-cell">Categoría</th>
              <th className="text-left px-3 py-2 text-slate-500 hidden md:table-cell">Unidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {preview.map((r,i) => (
              <tr key={i} className={r._status === 'duplicado' ? 'bg-amber-50/50' : ''}>
                <td className="px-3 py-2">{r._status==='nuevo' ? <CheckCircle size={13} className="text-emerald-500"/> : <AlertCircle size={13} className="text-amber-400"/>}</td>
                <td className="px-3 py-2 font-medium text-slate-700">{r.nombre}{r._status==='duplicado' && <span className="ml-1.5 text-amber-500 font-normal">· ya existe</span>}</td>
                <td className="px-3 py-2 text-slate-400 hidden sm:table-cell font-mono">{r.codigo_interno||'—'}</td>
                <td className="px-3 py-2 hidden md:table-cell">
                  {r.categoria
                    ? r._cat_id ? <span className="text-slate-600">{r.categoria}</span> : <span className="text-amber-500">{r.categoria} ⚠</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2 text-slate-400 hidden md:table-cell">{r.unidad_entrega||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    }
    stats={{ nuevos, duplicados }}
    resultLabel="productos"
  />
}

// ═════════════════════════════════════════════════════════════
// SHARED LAYOUT (upload → preview → done)
// ═════════════════════════════════════════════════════════════
function ImportLayout({ step, saving, result, templateBtn, uploadHint, onFile,
  onReset, onImport, toImport, duplicatePanel, previewTable, stats, resultLabel }) {

  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile({ target: { files: [file] } })
  }

  if (step === 'upload') return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div>
          <div className="text-sm font-medium text-slate-700">Plantilla Excel</div>
          <div className="text-xs text-slate-400 mt-0.5">Descargá, completá y subí el archivo</div>
        </div>
        {templateBtn}
      </div>
      <label
        className={`flex flex-col items-center gap-4 cursor-pointer group rounded-xl border-2 border-dashed p-8 transition-colors ${dragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragEnter={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-emerald-100' : 'bg-emerald-50 group-hover:bg-emerald-100'}`}>
          <Upload size={26} className="text-emerald-600"/>
        </div>
        <div className="text-center">
          <div className="text-sm font-medium text-slate-700">
            {dragging ? 'Soltá el archivo acá' : uploadHint}
          </div>
          <div className="text-xs text-slate-400 mt-1">arrastrá el archivo o hacé clic · .xlsx o .csv</div>
        </div>
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile}/>
      </label>
    </div>
  )

  if (step === 'preview') return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 text-sm font-medium text-slate-700">{(stats.nuevos + stats.duplicados)} filas en el archivo</div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-700"><CheckCircle size={14}/> {stats.nuevos} nuevos</span>
          {stats.duplicados > 0 && <span className="flex items-center gap-1.5 text-amber-600"><AlertCircle size={14}/> {stats.duplicados} ya existen</span>}
        </div>
      </div>
      {duplicatePanel}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">{previewTable}</div>
      <div className="flex justify-between gap-3">
        <button onClick={onReset} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
          <RefreshCw size={14}/> Cambiar archivo
        </button>
        <button onClick={onImport} disabled={saving || toImport === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg">
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
          {saving ? 'Importando...' : `Importar ${toImport} ${resultLabel}`}
        </button>
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
      <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={30} className="text-emerald-600"/>
      </div>
      <h2 className="text-lg font-bold text-slate-800">¡Importación completada!</h2>
      <div className="flex justify-center gap-6 mt-3 text-sm">
        <span className="text-emerald-700"><strong>{result.created}</strong> creados</span>
        <span className="text-blue-600"><strong>{result.updated}</strong> actualizados</span>
        <span className="text-slate-400"><strong>{result.skipped}</strong> ignorados</span>
      </div>
      <button onClick={onReset} className="mt-6 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg">
        Importar otro archivo
      </button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════
// TAB: PLANILLA DE ENTREGAS
// ═════════════════════════════════════════════════════════════
const PCOL = { CODIGO:0, NOMBRE:1, MENSUAL:3, SEM1:5, SEM2:7, SEM3:9, SEM4:11, SEM5:13 }

function parsePlanilla(wb) {
  const sheets = []
  for (const sheetName of wb.SheetNames) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1, defval:null })
    if (!raw || raw.length < 6) continue
    const contacto = (raw[2]?.[1] ?? raw[1]?.[1] ?? '').toString().trim()
    const products = []
    for (let r = 5; r < raw.length; r++) {
      const row = raw[r]; if (!row) continue
      const nombre = row[PCOL.NOMBRE]?.toString().trim()
      if (!nombre || nombre.toLowerCase() === 'total') continue
      const mensual = parseFloat(row[PCOL.MENSUAL])||null
      const sem1=parseFloat(row[PCOL.SEM1])||null, sem2=parseFloat(row[PCOL.SEM2])||null
      const sem3=parseFloat(row[PCOL.SEM3])||null, sem4=parseFloat(row[PCOL.SEM4])||null
      const sem5=parseFloat(row[PCOL.SEM5])||null
      if (!mensual && !sem1 && !sem2 && !sem3 && !sem4 && !sem5) continue
      products.push({ codigo: row[PCOL.CODIGO]?.toString().trim(), nombre, mensual, sem1, sem2, sem3, sem4, sem5 })
    }
    if (products.length > 0) sheets.push({ sheetName, contacto, products })
  }
  return sheets
}

function mesFromFilename(name) {
  const m = { enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12 }
  const match = name.toLowerCase().match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{4})/)
  return match ? `${match[2]}-${String(m[match[1]]).padStart(2,'0')}-01` : null
}

function ImportarPlanilla() {
  const [step, setStep]         = useState('upload')
  const [fileName, setFileName] = useState('')
  const [mes, setMes]           = useState('')
  const [sheets, setSheets]     = useState([])
  const [mapeoL, setMapeoL]     = useState({})
  const [mapeoP, setMapeoP]     = useState({})
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [openSheet, setOpenSheet] = useState(null)
  const [lugares, setLugares]   = useState([])
  const [productos, setProductos] = useState([])
  const [stats, setStats]       = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('lugares').select('id,nombre').order('nombre'),
      supabase.from('productos').select('id,nombre,codigo_interno').order('nombre'),
    ]).then(([l,p]) => { setLugares(l.data??[]); setProductos(p.data??[]) })
  }, [])

  async function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return
    setError(''); setFileName(file.name)
    const gm = mesFromFilename(file.name); if (gm) setMes(gm)
    setLoading(true)
    const data = parsePlanilla(XLSX.read(await file.arrayBuffer()))
    setSheets(data); setLoading(false)
    await validateMappings(data)
  }

  async function validateMappings(data) {
    setLoading(true)
    const [mlRes, mpRes] = await Promise.all([
      supabase.from('mapeo_lugares').select('*'),
      supabase.from('mapeo_productos').select('*'),
    ])
    const exL = mlRes.data??[], exP = mpRes.data??[]

    const newMapL = {}
    for (const s of data) {
      const found = exL.find(m => m.nombre_planilla === s.sheetName)
      if (found) {
        const lug = lugares.find(l => l.id === found.lugar_id)
        newMapL[s.sheetName] = { lugar_id: found.lugar_id, lugar_nombre: lug?.nombre??'?', confirmado: true }
      } else {
        const words = s.sheetName.toLowerCase().split(/\s+/).filter(w => w.length > 2)
        const auto  = lugares.find(l => words.every(w => l.nombre.toLowerCase().includes(w)))
        newMapL[s.sheetName] = { lugar_id: auto?.id??null, lugar_nombre: auto?.nombre??'', confirmado: false }
      }
    }

    const allProds = {}
    for (const s of data) for (const p of s.products) {
      const key = `${p.codigo??''}||${p.nombre}`
      if (!allProds[key]) allProds[key] = p
    }
    const newMapP = {}
    for (const [key, p] of Object.entries(allProds)) {
      const found = exP.find(m => m.nombre_planilla === p.nombre)
      if (found) {
        const prod = productos.find(x => x.id === found.producto_id)
        newMapP[key] = { producto_id: found.producto_id, prod_nombre: prod?.nombre??'?', confirmado: true }
      } else {
        const auto = productos.find(x =>
          (p.codigo && x.codigo_interno === p.codigo) || norm(x.nombre) === norm(p.nombre))
        newMapP[key] = { producto_id: auto?.id??null, prod_nombre: auto?.nombre??'', confirmado: false }
      }
    }
    setMapeoL(newMapL); setMapeoP(newMapP); setLoading(false); setStep('validate')
  }

  async function saveMappings() {
    setSaving(true)
    for (const [nombre_planilla, v] of Object.entries(mapeoL))
      if (v.lugar_id) await supabase.from('mapeo_lugares')
        .upsert({ nombre_planilla, lugar_id: v.lugar_id, confirmado: true }, { onConflict:'nombre_planilla' })
    for (const [key, v] of Object.entries(mapeoP)) {
      const [codigo, nombre_planilla] = key.split('||')
      if (v.producto_id) await supabase.from('mapeo_productos')
        .upsert({ codigo_planilla:codigo||null, nombre_planilla, producto_id:v.producto_id, confirmado:true }, { onConflict:'nombre_planilla' })
    }
    let mapped=0, skipped=0
    for (const s of sheets) {
      const lMap = mapeoL[s.sheetName]
      if (!lMap?.lugar_id) { skipped+=s.products.length; continue }
      for (const p of s.products) {
        if (mapeoP[`${p.codigo??''}||${p.nombre}`]?.producto_id) mapped++; else skipped++
      }
    }
    setStats({ mapped, skipped, lugaresOk:Object.values(mapeoL).filter(v=>v.lugar_id).length, lugaresMissing:Object.values(mapeoL).filter(v=>!v.lugar_id).length })
    setSaving(false); setStep('preview')
  }

  async function doImport() {
    if (!mes) { setError('Seleccioná el mes'); return }
    setSaving(true); setError('')
    const rows = []
    for (const s of sheets) {
      const lMap = mapeoL[s.sheetName]; if (!lMap?.lugar_id) continue
      for (const p of s.products) {
        const pMap = mapeoP[`${p.codigo??''}||${p.nombre}`]; if (!pMap?.producto_id) continue
        rows.push({ lugar_id:lMap.lugar_id, producto_id:pMap.producto_id, mes,
          cantidad_mensual:p.mensual, semana_1:p.sem1, semana_2:p.sem2,
          semana_3:p.sem3, semana_4:p.sem4, semana_5:p.sem5,
          fuente:'planilla_excel', archivo_origen:fileName, contacto_planilla:s.contacto||null })
      }
    }
    let err=null
    for (let i=0; i<rows.length; i+=100) {
      const { error:e } = await supabase.from('entregas').upsert(rows.slice(i,i+100), { onConflict:'lugar_id,producto_id,mes' })
      if (e) { err=e.message; break }
    }
    setSaving(false)
    if (err) { setError(err); return }
    setStats(s => ({ ...s, imported:rows.length })); setStep('done')
  }

  const lugaresOk = Object.values(mapeoL).filter(v=>v.lugar_id).length
  const lugMissing = Object.values(mapeoL).filter(v=>!v.lugar_id).length
  const prodOk    = Object.values(mapeoP).filter(v=>v.producto_id).length
  const prodMiss  = Object.values(mapeoP).filter(v=>!v.producto_id).length
  const STEPS = [['upload','1. Archivo'],['validate','2. Mapeo'],['preview','3. Preview'],['done','4. Importado']]
  const si = STEPS.findIndex(([v])=>v===step)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
        {STEPS.map(([v,l],i) => (
          <div key={v} className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full ${step===v?'bg-emerald-600 text-white':si>i?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-400'}`}>{l}</span>
            {i<STEPS.length-1 && <span className="text-slate-300">→</span>}
          </div>
        ))}
      </div>

      {step==='upload' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <label className="flex flex-col items-center gap-4 cursor-pointer group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center">
              <Upload size={26} className="text-emerald-600"/>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-slate-700">Seleccioná la planilla Excel de Patri</div>
              <div className="text-xs text-slate-400 mt-1">.xlsx</div>
            </div>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile}/>
          </label>
          {loading && <div className="flex justify-center gap-2 mt-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Procesando...</div>}
        </div>
      )}

      {step==='validate' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap justify-between gap-3">
            <div><div className="font-medium text-slate-800">{fileName}</div><div className="text-xs text-slate-500 mt-0.5">{sheets.length} hojas · {Object.keys(mapeoP).length} productos</div></div>
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-700"><CheckCircle size={13}/> {lugaresOk} lugares OK</span>
              {lugMissing>0 && <span className="flex items-center gap-1 text-amber-600"><AlertCircle size={13}/> {lugMissing} sin mapear</span>}
              <span className="flex items-center gap-1 text-emerald-700"><CheckCircle size={13}/> {prodOk} prod. OK</span>
              {prodMiss>0 && <span className="flex items-center gap-1 text-amber-600"><AlertCircle size={13}/> {prodMiss} sin mapear</span>}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <label className="block text-xs font-medium text-slate-600 mb-1">Mes de la planilla *</label>
            <input type="month" value={mes?mes.slice(0,7):''} onChange={e=>setMes(e.target.value?e.target.value+'-01':'')}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">Mapeo de Lugares</div>
            <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
              {sheets.map(s=>(
                <div key={s.sheetName} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  {mapeoL[s.sheetName]?.lugar_id?<CheckCircle size={14} className="text-emerald-500 shrink-0"/>:<AlertCircle size={14} className="text-amber-400 shrink-0"/>}
                  <span className="text-slate-600 flex-1 truncate text-xs">{s.sheetName}</span>
                  <span className="text-slate-400 text-xs">→</span>
                  <select value={mapeoL[s.sheetName]?.lugar_id??''}
                    onChange={e=>{const id=e.target.value?parseInt(e.target.value):null;const lug=lugares.find(l=>l.id===id);setMapeoL(m=>({...m,[s.sheetName]:{lugar_id:id,lugar_nombre:lug?.nombre??'',confirmado:false}}))}}
                    className="flex-1 max-w-xs px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    <option value="">— sin mapear —</option>
                    {lugares.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {prodMiss>0 && (
            <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-100 text-sm font-medium text-amber-700">Productos sin mapear ({prodMiss})</div>
              <div className="divide-y divide-slate-50 max-h-52 overflow-y-auto">
                {Object.entries(mapeoP).filter(([,v])=>!v.producto_id).map(([key,v])=>{
                  const [cod,nom]=key.split('||')
                  return (
                    <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                      <XCircle size={14} className="text-slate-300 shrink-0"/>
                      <span className="text-slate-600 flex-1 truncate text-xs">{cod?`[${cod}] `:''}{nom}</span>
                      <span className="text-slate-400 text-xs">→</span>
                      <select value={v.producto_id??''}
                        onChange={e=>{const id=e.target.value?parseInt(e.target.value):null;const prod=productos.find(p=>p.id===id);setMapeoP(m=>({...m,[key]:{producto_id:id,prod_nombre:prod?.nombre??'',confirmado:false}}))}}
                        className="flex-1 max-w-xs px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option value="">— sin mapear —</option>
                        {productos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</div>}
          <div className="flex justify-end gap-3">
            <button onClick={()=>setStep('upload')} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Volver</button>
            <button onClick={saveMappings} disabled={saving||!mes}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg">
              {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>} Guardar mapeo y continuar
            </button>
          </div>
        </div>
      )}

      {step==='preview' && (
        <div className="space-y-4">
          {stats && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div><div className="text-2xl font-bold text-emerald-600">{stats.lugaresOk}</div><div className="text-xs text-slate-500">Lugares mapeados</div></div>
                <div><div className="text-2xl font-bold text-amber-500">{stats.lugaresMissing}</div><div className="text-xs text-slate-500">Sin mapear</div></div>
                <div><div className="text-2xl font-bold text-emerald-600">{stats.mapped}</div><div className="text-xs text-slate-500">Filas a importar</div></div>
                <div><div className="text-2xl font-bold text-slate-400">{stats.skipped}</div><div className="text-xs text-slate-500">A omitir</div></div>
              </div>
              <div className="mt-3 text-xs text-slate-400 text-center">Mes: <strong>{mes}</strong> · {fileName}</div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">Preview por lugar</div>
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {sheets.map(s=>{
                const lMap=mapeoL[s.sheetName]
                const ok=s.products.filter(p=>mapeoP[`${p.codigo??''}||${p.nombre}`]?.producto_id)
                return (
                  <div key={s.sheetName}>
                    <button onClick={()=>setOpenSheet(v=>v===s.sheetName?null:s.sheetName)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-sm">
                      <div className="flex items-center gap-2">
                        {lMap?.lugar_id?<CheckCircle size={14} className="text-emerald-500"/>:<XCircle size={14} className="text-slate-300"/>}
                        <span className="font-medium text-slate-700 text-xs">{s.sheetName}</span>
                        {lMap?.lugar_id&&<span className="text-xs text-slate-400">→ {lMap.lugar_nombre}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{ok.length} prod.</span>
                        {openSheet===s.sheetName?<ChevronUp size={12}/>:<ChevronDown size={12}/>}
                      </div>
                    </button>
                    {openSheet===s.sheetName&&ok.length>0&&(
                      <div className="px-6 pb-3 text-xs text-slate-500 space-y-0.5">
                        {ok.map((p,i)=>{const pm=mapeoP[`${p.codigo??''}||${p.nombre}`];return<div key={i} className="flex gap-3"><span className="flex-1 truncate">{pm.prod_nombre}</span><span className="font-mono">{p.mensual??'—'}</span></div>})}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</div>}
          <div className="flex justify-end gap-3">
            <button onClick={()=>setStep('validate')} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Volver</button>
            <button onClick={doImport} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg">
              {saving?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>}
              {saving?'Importando...':'Importar al sistema'}
            </button>
          </div>
        </div>
      )}

      {step==='done' && (
        <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={30} className="text-emerald-600"/></div>
          <h2 className="text-lg font-bold text-slate-800">¡Importación completada!</h2>
          <p className="text-sm text-slate-500 mt-2">Se importaron <strong>{stats?.imported}</strong> registros para <strong>{mes}</strong></p>
          <button onClick={()=>{setStep('upload');setFileName('');setSheets([]);setMes('');setStats(null)}}
            className="mt-6 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg">
            Importar otra planilla
          </button>
        </div>
      )}
    </div>
  )
}
