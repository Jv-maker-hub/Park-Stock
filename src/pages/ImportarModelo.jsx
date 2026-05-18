import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Upload, CheckCircle, AlertCircle, XCircle, Loader2, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

const FREQ_MAP = { 'SEMANAL': 4, 'QUINCENAL': 2, 'MENSUAL': 1 }

function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
    .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n')
    .replace(/\./g,'').replace(/\s+/g,' ').trim()
}

function matchScore(a, b) {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return 100
  if (na.includes(nb) || nb.includes(na)) return 80
  const wa = na.split(' '), wb = nb.split(' ')
  const common = wa.filter(w => w.length > 3 && wb.some(v => v.includes(w) || w.includes(v)))
  return common.length > 0 ? Math.min(60, common.length * 20) : 0
}

function bestMatch(name, list, keyFn) {
  let best = null, bestScore = 0
  for (const item of list) {
    const score = matchScore(name, keyFn(item))
    if (score > bestScore) { bestScore = score; best = item }
  }
  return bestScore >= 40 ? { item: best, score: bestScore } : null
}

export default function ImportarModelo() {
  const { profile } = useAuth()
  const [step, setStep]         = useState(1) // 1=upload, 2=preview, 3=done
  const [parsing, setParsing]   = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows]         = useState([])    // parsed from Excel
  const [matches, setMatches]   = useState([])    // matched rows
  const [lugares, setLugares]   = useState([])
  const [productos, setProductos] = useState([])
  const [modeloNombre, setModeloNombre] = useState(`Modelo ${new Date().toLocaleString('es-AR', {month:'long', year:'numeric'})}`)
  const [modeloMes, setModeloMes] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 7)
  })
  const [expanded, setExpanded] = useState({})
  const [resultado, setResultado] = useState(null)

  async function parseExcel(file) {
    setParsing(true)
    // Fetch DB data for matching
    const [lugRes, prodRes] = await Promise.all([
      supabase.from('lugares').select('id, nombre, frecuencia_entrega').eq('estado', 'activo'),
      supabase.from('productos').select('id, nombre, codigo_interno').eq('activo', true),
    ])
    const lug  = lugRes.data || []
    const prod = prodRes.data || []
    setLugares(lug)
    setProductos(prod)

    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type: 'array' })

    const parsed = []
    for (const shname of wb.SheetNames) {
      if (shname === 'BLANCO') continue
      const ws = wb.Sheets[shname]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

      // Frecuencia de la hoja
      let frecuencia = 1
      for (let r = 0; r < Math.min(4, raw.length); r++) {
        const row = raw[r] || []
        for (let c = 0; c < row.length - 1; c++) {
          if (row[c] && String(row[c]).toUpperCase().includes('FRECUENCIA')) {
            const v = String(row[c+1] || '').toUpperCase().trim()
            frecuencia = FREQ_MAP[v] || 1
          }
        }
      }

      // Encontrar fila de headers (CODIGO)
      let headerIdx = -1
      for (let r = 0; r < Math.min(10, raw.length); r++) {
        if (raw[r] && raw[r][0] && String(raw[r][0]).toUpperCase().includes('CODIGO')) {
          headerIdx = r; break
        }
      }
      if (headerIdx < 0) continue

      // Columna Mensual
      const headers = raw[headerIdx] || []
      let colMensual = 3
      for (let c = 0; c < headers.length; c++) {
        if (headers[c] && String(headers[c]).toLowerCase().includes('mensual')) {
          colMensual = c; break
        }
      }

      // Leer productos
      const productos_lugar = []
      for (let r = headerIdx + 1; r < raw.length; r++) {
        const row = raw[r] || []
        const codigo   = row[0]
        const articulo = row[1]
        const mensual  = row[colMensual]
        if (!codigo || !articulo) continue
        if (String(articulo).toUpperCase().includes('ARTICULO')) continue
        let qty = null
        if (mensual !== null && mensual !== '' && !String(mensual).startsWith('=')) {
          const n = parseFloat(String(mensual).replace(',','.'))
          if (!isNaN(n) && n > 0) qty = n
        }
        if (qty === null) continue
        productos_lugar.push({ codigo: String(codigo).trim(), articulo: String(articulo).trim(), qty_mensual: qty, qty_visita: qty / frecuencia })
      }

      if (productos_lugar.length > 0) {
        parsed.push({ hoja: shname, frecuencia, productos: productos_lugar })
      }
    }

    // Hacer matching
    const matched = parsed.map(p => {
      const lugMatch = bestMatch(p.hoja, lug, l => l.nombre)
      const prods = p.productos.map(pr => {
        const byCode = pr.codigo ? prod.find(x => x.codigo_interno === pr.codigo) : null
        const byName = !byCode ? (bestMatch(pr.articulo, prod, x => x.nombre)?.item) : null
        const producto = byCode || byName
        return { ...pr, producto, matchedByCode: !!byCode }
      })
      return {
        ...p,
        lugar: lugMatch?.item || null,
        lugarScore: lugMatch?.score || 0,
        productos: prods,
        totalMatch: prods.filter(x => x.producto).length,
        totalProds: prods.length,
      }
    })

    setRows(parsed)
    setMatches(matched)
    setParsing(false)
    setStep(2)
  }

  async function importar() {
    setImporting(true)
    const mes = modeloMes + '-01'

    // Crear modelo
    const { data: modelo, error: mErr } = await supabase.from('pedido_modelo')
      .insert({ nombre: modeloNombre, mes, created_by: profile.id })
      .select().single()
    if (mErr || !modelo) { setImporting(false); alert('Error creando modelo: ' + mErr?.message); return }

    // Actualizar frecuencias en lugares
    const freqUpdates = matches.filter(m => m.lugar && m.frecuencia !== 1)
    for (const m of freqUpdates) {
      await supabase.from('lugares').update({ frecuencia_entrega: m.frecuencia }).eq('id', m.lugar.id)
    }

    // Insertar detalle en batches
    const detalles = []
    for (const m of matches) {
      if (!m.lugar) continue
      for (const p of m.productos) {
        if (!p.producto) continue
        detalles.push({
          modelo_id: modelo.id,
          lugar_id: m.lugar.id,
          producto_id: p.producto.id,
          cantidad_por_visita: Math.round(p.qty_visita * 100) / 100,
        })
      }
    }

    // Insertar en lotes de 500
    let insertados = 0
    for (let i = 0; i < detalles.length; i += 500) {
      const batch = detalles.slice(i, i + 500)
      const { error } = await supabase.from('pedido_modelo_detalle').insert(batch)
      if (!error) insertados += batch.length
    }

    setResultado({ modeloId: modelo.id, insertados, total: detalles.length })
    setImporting(false)
    setStep(3)
  }

  const noMatch   = matches.filter(m => !m.lugar)
  const ok        = matches.filter(m => m.lugar)
  const totalLineas = matches.reduce((s, m) => s + m.totalMatch, 0)
  const totalProds  = matches.reduce((s, m) => s + m.totalProds, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Importar Pedido Modelo</h1>
        <p className="text-slate-500 text-sm mt-1">Cargá la planilla de Patri para generar el modelo mensual</p>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Nombre del modelo</label>
              <input value={modeloNombre} onChange={e => setModeloNombre(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Mes</label>
              <input type="month" value={modeloMes} onChange={e => setModeloMes(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <label className={`block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${parsing ? 'border-slate-200 bg-slate-50' : 'border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'}`}>
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={parsing}
              onChange={e => e.target.files[0] && parseExcel(e.target.files[0])} />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="text-emerald-500 animate-spin" />
                <span className="text-sm text-slate-500">Analizando planilla y buscando matches...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={32} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Subí la planilla MODELO.xlsx</span>
                <span className="text-xs text-slate-400">Click o arrastrá el archivo</span>
              </div>
            )}
          </label>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Lugares encontrados', val: ok.length, color: 'text-emerald-600' },
              { label: 'Sin match de lugar', val: noMatch.length, color: noMatch.length > 0 ? 'text-red-500' : 'text-slate-400' },
              { label: 'Líneas con producto', val: totalLineas, color: 'text-emerald-600' },
              { label: 'Sin match producto', val: totalProds - totalLineas, color: totalProds - totalLineas > 0 ? 'text-amber-500' : 'text-slate-400' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Lugares sin match */}
          {noMatch.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5"><XCircle size={14}/> Lugares no encontrados en el sistema ({noMatch.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {noMatch.map(m => (
                  <span key={m.hoja} className="px-2 py-0.5 bg-white border border-red-200 rounded text-xs text-red-600">{m.hoja}</span>
                ))}
              </div>
            </div>
          )}

          {/* Lista de lugares con match */}
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {ok.map(m => {
              const open = expanded[m.hoja]
              const sinProd = m.productos.filter(p => !p.producto)
              return (
                <div key={m.hoja}>
                  <button onClick={() => setExpanded(e => ({...e, [m.hoja]: !open}))}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors">
                    <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700">{m.hoja}</span>
                      <ArrowRight size={12} className="inline mx-1 text-slate-400" />
                      <span className="text-sm text-emerald-700">{m.lugar.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100">{m.frecuencia === 4 ? 'Semanal' : m.frecuencia === 2 ? 'Quincenal' : 'Mensual'}</span>
                      <span>{m.totalMatch}/{m.totalProds} prods</span>
                      {sinProd.length > 0 && <AlertCircle size={13} className="text-amber-500" />}
                    </div>
                    {open ? <ChevronUp size={14} className="text-slate-300"/> : <ChevronDown size={14} className="text-slate-300"/>}
                  </button>
                  {open && (
                    <div className="px-4 pb-3 space-y-0.5">
                      {m.productos.slice(0,20).map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                          {p.producto ? <CheckCircle size={11} className="text-emerald-400 shrink-0"/> : <XCircle size={11} className="text-red-400 shrink-0"/>}
                          <span className={p.producto ? 'text-slate-600' : 'text-red-500 line-through'}>{p.articulo}</span>
                          {p.producto && <span className="text-slate-400">→ {p.producto.nombre} · {p.qty_visita % 1 === 0 ? p.qty_visita : p.qty_visita.toFixed(2)}/visita</span>}
                        </div>
                      ))}
                      {m.productos.length > 20 && <p className="text-xs text-slate-400">... y {m.productos.length - 20} más</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              ← Volver
            </button>
            <button onClick={importar} disabled={importing || ok.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {importing ? <><Loader2 size={15} className="animate-spin"/> Importando...</> : <><CheckCircle size={15}/> Confirmar e importar ({totalLineas} líneas)</>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && resultado && (
        <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
          <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
          <h2 className="text-lg font-bold text-slate-800 mb-1">¡Modelo importado!</h2>
          <p className="text-slate-500 text-sm">{resultado.insertados} líneas importadas en "{modeloNombre}"</p>
          <a href="/pedido-modelo" className="inline-block mt-4 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors">
            Ver el modelo →
          </a>
        </div>
      )}
    </div>
  )
}
