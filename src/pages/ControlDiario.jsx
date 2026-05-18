import { useEffect, useState, useCallback } from 'react'
import {
  ClipboardCheck, CheckCircle2, Circle, AlertTriangle,
  TrendingDown, TrendingUp, Minus, ArrowRight, Lock,
  Clock, PackageCheck, ChevronRight, X, Info
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => n == null ? '—' : parseFloat(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const fmtHora = (ts) => ts
  ? new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  : null
const fmtFechaHora = (ts) => ts
  ? new Date(ts).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  : '—'
const hoy = () => new Date().toISOString().split('T')[0]
const esLaborable = () => { const d = new Date().getDay(); return d >= 1 && d <= 5 }

function DiffChip({ val, label, positiveIsGood = false }) {
  if (val == null) return null
  if (val === 0) return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
      <Minus size={10} /> {label} ok
    </span>
  )
  const malo = positiveIsGood ? val < 0 : val !== 0
  if (val > 0) return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${malo ? 'text-amber-600 bg-amber-50' : 'text-blue-600 bg-blue-50'}`}>
      <TrendingUp size={10} /> {label}: +{fmt(val)}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">
      <TrendingDown size={10} /> {label}: {fmt(val)}
    </span>
  )
}

// ─── Fila de producto para conteo ────────────────────────────────────────────
function LineaItem({ linea, momento, onGuardar }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  const yaContado = momento === 'inicial'
    ? linea.cantidad_inicial != null
    : linea.cantidad_post_prep != null

  const cantMostrada = momento === 'inicial' ? linea.cantidad_inicial : linea.cantidad_post_prep

  // Diferencia en conteo inicial vs sistema
  const diffSistema = linea.cantidad_inicial != null
    ? parseFloat(linea.cantidad_inicial) - parseFloat(linea.cantidad_sistema ?? 0)
    : null

  // Esperado post-prep = inicial - preparada_sistema
  const esperado = linea.cantidad_inicial != null
    ? parseFloat(linea.cantidad_inicial) - parseFloat(linea.cantidad_preparada_sis ?? 0)
    : null

  // Diferencia post-prep = post_prep - esperado
  const diffPrep = linea.cantidad_post_prep != null && esperado != null
    ? parseFloat(linea.cantidad_post_prep) - esperado
    : null

  const hayProblema = momento === 'inicial'
    ? (diffSistema != null && diffSistema !== 0)
    : (diffPrep != null && diffPrep !== 0)

  async function handleGuardar() {
    if (val.trim() === '') { setEditing(false); return }
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) return
    setSaving(true)
    await onGuardar(linea.id, n, momento)
    setEditing(false); setSaving(false)
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 border-b border-slate-50 transition-colors ${
      editing ? 'bg-violet-50' : hayProblema ? 'bg-red-50/40' : yaContado ? 'bg-emerald-50/20' : 'hover:bg-slate-50'
    }`}>
      <div className="shrink-0">
        {!yaContado ? <Circle size={18} className="text-slate-200" />
          : hayProblema ? <AlertTriangle size={18} className="text-red-400" />
          : <CheckCircle2 size={18} className="text-emerald-500" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{linea.producto_nombre}</div>
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          <span className="text-xs text-slate-400">
            Sistema: <span className="font-medium text-slate-600">{fmt(linea.cantidad_sistema)}</span>
            {linea.producto_unidad && <span className="ml-0.5">{linea.producto_unidad}</span>}
          </span>
          {momento === 'post_prep' && linea.cantidad_preparada_sis > 0 && (
            <span className="text-xs text-slate-400">
              Preparado por sistema: <span className="font-medium text-blue-600">{fmt(linea.cantidad_preparada_sis)}</span>
            </span>
          )}
          {momento === 'post_prep' && esperado != null && (
            <span className="text-xs text-slate-400">
              Esperado: <span className="font-medium text-slate-700">{fmt(esperado)}</span>
            </span>
          )}
          {linea.cantidad_inicial != null && (
            <DiffChip val={diffSistema} label="vs sistema" />
          )}
          {linea.cantidad_post_prep != null && (
            <DiffChip val={diffPrep} label="faltante" />
          )}
        </div>
        {/* Hora de cada conteo */}
        {linea.cantidad_inicial != null && (
          <div className="text-xs text-slate-300 mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            Inicial: {fmtHora(linea.inicial_en)}
            {linea.cantidad_post_prep != null && (
              <> · Post-prep: {fmtHora(linea.post_prep_en)}</>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="number" step="0.01" min="0"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleGuardar(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus placeholder="Cantidad"
            className="w-24 px-2 py-1.5 text-sm border border-violet-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <button onClick={handleGuardar} disabled={saving}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg disabled:opacity-50">
            OK
          </button>
          <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          {yaContado && <span className="text-sm font-semibold text-slate-700">{fmt(cantMostrada)}</span>}
          <button onClick={() => { setVal(cantMostrada != null ? String(cantMostrada) : ''); setEditing(true) }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              yaContado ? 'text-slate-500 hover:bg-slate-100' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
            }`}>
            {yaContado ? 'Editar' : 'Contar'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Vista detalle de un control (admin) ─────────────────────────────────────
function DetalleControl({ control, lineas, onBack }) {
  const diffTotal = lineas.reduce((s, l) => {
    if (l.cantidad_post_prep == null || l.cantidad_inicial == null) return s
    const esp = parseFloat(l.cantidad_inicial) - parseFloat(l.cantidad_preparada_sis ?? 0)
    return s + (parseFloat(l.cantidad_post_prep) - esp)
  }, 0)

  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        ← Volver
      </button>

      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">
          Control diario — {new Date(control.fecha_conteo + 'T12:00:00').toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {control.estado === 'cerrado' ? '✅ Completado' : '🕐 En progreso'}
          {control.diferencias_count > 0 && ` · ⚠️ ${control.diferencias_count} diferencias`}
        </p>
      </div>

      {diffTotal !== 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {Math.abs(diffTotal)} unidades sin explicación
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {diffTotal < 0
                ? 'El preparador sacó más unidades de las que el sistema registra como preparadas.'
                : 'Hay más unidades de las esperadas — posible error en el registro de preparación.'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header tabla */}
        <div className="grid grid-cols-12 px-4 py-2.5 border-b border-slate-100 bg-slate-50">
          <div className="col-span-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Producto</div>
          <div className="col-span-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Sistema</div>
          <div className="col-span-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Conteo inicial</div>
          <div className="col-span-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Preparado</div>
          <div className="col-span-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Post-prep</div>
          <div className="col-span-1 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">Dif.</div>
        </div>

        {lineas.map(l => {
          const esperado = l.cantidad_inicial != null
            ? parseFloat(l.cantidad_inicial) - parseFloat(l.cantidad_preparada_sis ?? 0)
            : null
          const diff = l.cantidad_post_prep != null && esperado != null
            ? parseFloat(l.cantidad_post_prep) - esperado
            : null
          const hayProblema = diff != null && diff !== 0
          return (
            <div key={l.id}
              className={`grid grid-cols-12 px-4 py-3 border-b border-slate-50 text-sm ${hayProblema ? 'bg-red-50/60' : ''}`}>
              <div className="col-span-3">
                <div className="font-medium text-slate-800 truncate">{l.producto_nombre}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {fmtHora(l.inicial_en) && <span>Inicial: {fmtHora(l.inicial_en)}</span>}
                  {fmtHora(l.post_prep_en) && <span> · Post: {fmtHora(l.post_prep_en)}</span>}
                </div>
              </div>
              <div className="col-span-2 text-right text-slate-500">{fmt(l.cantidad_sistema)}</div>
              <div className="col-span-2 text-right text-slate-700 font-medium">
                {l.cantidad_inicial != null ? fmt(l.cantidad_inicial) : <span className="text-slate-300">—</span>}
              </div>
              <div className="col-span-2 text-right text-blue-600">
                {l.cantidad_preparada_sis > 0 ? fmt(l.cantidad_preparada_sis) : <span className="text-slate-300">—</span>}
              </div>
              <div className={`col-span-2 text-right font-medium ${hayProblema ? 'text-red-600' : 'text-slate-700'}`}>
                {l.cantidad_post_prep != null
                  ? <>{fmt(l.cantidad_post_prep)}{esperado != null && <span className="text-xs text-slate-400 ml-1">(esp. {fmt(esperado)})</span>}</>
                  : <span className="text-slate-300">—</span>}
              </div>
              <div className="col-span-1 text-right">
                {diff == null ? null : diff === 0
                  ? <span className="text-emerald-500 text-xs">ok</span>
                  : <span className={`text-xs font-bold ${diff < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {diff > 0 ? '+' : ''}{fmt(diff)}
                    </span>
                }
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function ControlDiario() {
  const { profile, user } = useAuth()
  const isAdmin = ['admin','auditor','compras'].includes(profile?.rol)
  const isRepartidor = profile?.rol === 'repartidor'

  const [tarea, setTarea] = useState(undefined)
  const [lineas, setLineas] = useState([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [momento, setMomento] = useState('inicial')
  const [cerrando, setCerrando] = useState(false)

  // Admin
  const [historial, setHistorial] = useState([])
  const [detalleControl, setDetalleControl] = useState(null)
  const [detalleLineas, setDetalleLineas] = useState([])

  const fetchTarea = useCallback(async () => {
    if (isAdmin) {
      const { data } = await supabase
        .from('stock_arqueo')
        .select('*')
        .eq('tipo', 'diario')
        .eq('fecha_conteo', hoy())
        .order('created_at', { ascending: false })
      setHistorial(data ?? [])
    } else {
      const { data } = await supabase
        .from('stock_arqueo')
        .select('*')
        .eq('tipo', 'diario')
        .eq('fecha_conteo', hoy())
        .eq('assigned_to', user?.id)
        .maybeSingle()
      setTarea(data ?? null)
      if (data) {
        const { data: ls } = await supabase
          .from('stock_arqueo_linea').select('*').eq('arqueo_id', data.id).order('producto_nombre')
        setLineas(ls ?? [])
        const inicialDone = (ls ?? []).every(l => l.cantidad_inicial != null)
        setMomento(inicialDone ? 'post_prep' : 'inicial')
      }
    }
    setLoading(false)
  }, [isAdmin, user?.id])

  useEffect(() => { fetchTarea() }, [fetchTarea])

  async function generarTarea() {
    setGenerando(true)

    // Productos activos + stock actual
    const [prodRes, stockRes] = await Promise.all([
      supabase.from('productos').select('id, nombre, unidad, unidad_entrega').eq('activo', true),
      supabase.from('stock').select('producto_id, cantidad'),
    ])
    const prods = prodRes.data ?? []
    if (prods.length === 0) { setGenerando(false); return }
    const stockMap = {}
    stockRes.data?.forEach(s => { stockMap[s.producto_id] = s.cantidad ?? 0 })

    // Selección aleatoria de 10
    const seleccion = [...prods].sort(() => Math.random() - 0.5).slice(0, Math.min(10, prods.length))

    // Buscar repartidores activos para asignar
    const { data: repartidores } = await supabase
      .from('profiles').select('id').eq('rol', 'repartidor').eq('activo', true)
    const assignTo = repartidores?.[0]?.id ?? null

    const { data: nuevaTarea } = await supabase.from('stock_arqueo').insert({
      tipo: 'diario',
      estado: 'en_progreso',
      fecha_conteo: hoy(),
      assigned_to: assignTo,
      auditor_id: user?.id,
      productos_total: seleccion.length,
    }).select().single()

    if (!nuevaTarea) { setGenerando(false); return }

    await supabase.from('stock_arqueo_linea').insert(
      seleccion.map(p => ({
        arqueo_id: nuevaTarea.id,
        producto_id: p.id,
        producto_nombre: p.nombre,
        producto_unidad: p.unidad_entrega || p.unidad,
        cantidad_sistema: stockMap[p.id] ?? 0,
        cantidad_preparada_sis: 0,
      }))
    )

    await fetchTarea()
    setGenerando(false)
  }

  // Actualizar cantidad_preparada_sis con lo que dice pedido_detalle del día
  async function actualizarPreparadas() {
    if (!tarea) return
    const fechaHoy = hoy()
    for (const l of lineas) {
      const { data: prep } = await supabase
        .from('pedido_detalle')
        .select('cantidad_planificada')
        .eq('producto_id', l.producto_id)
        .eq('preparado', true)
        .gte('preparado_at', fechaHoy + 'T00:00:00')
        .lte('preparado_at', fechaHoy + 'T23:59:59')
      const total = (prep ?? []).reduce((s, r) => s + parseFloat(r.cantidad_planificada ?? 0), 0)
      await supabase.from('stock_arqueo_linea')
        .update({ cantidad_preparada_sis: total })
        .eq('id', l.id)
    }
    // Recargar lineas
    const { data: ls } = await supabase
      .from('stock_arqueo_linea').select('*').eq('arqueo_id', tarea.id).order('producto_nombre')
    setLineas(ls ?? [])
  }

  async function handleGuardarLinea(lineaId, cantidad, mom) {
    const ahora = new Date().toISOString()
    const update = mom === 'inicial'
      ? { cantidad_inicial: cantidad, inicial_en: ahora, inicial_por: user?.id }
      : { cantidad_post_prep: cantidad, post_prep_en: ahora, post_prep_por: user?.id }

    await supabase.from('stock_arqueo_linea').update(update).eq('id', lineaId)
    setLineas(prev => prev.map(l => l.id === lineaId ? { ...l, ...update } : l))

    const updatedLineas = lineas.map(l => l.id === lineaId ? { ...l, ...update } : l)
    const inicialDone = updatedLineas.every(l => l.cantidad_inicial != null)
    if (mom === 'inicial' && inicialDone) {
      await supabase.from('stock_arqueo').update({ productos_contados: updatedLineas.length }).eq('id', tarea.id)
      setMomento('post_prep')
    }
  }

  async function cerrarInicial() {
    setCerrando(true)
    await supabase.from('stock_arqueo').update({ productos_contados: lineas.length }).eq('id', tarea.id)
    await actualizarPreparadas()
    setMomento('post_prep')
    setCerrando(false)
  }

  async function cerrarPostPrep() {
    setCerrando(true)
    const diffs = lineas.filter(l => {
      if (l.cantidad_post_prep == null || l.cantidad_inicial == null) return false
      const esp = parseFloat(l.cantidad_inicial) - parseFloat(l.cantidad_preparada_sis ?? 0)
      return parseFloat(l.cantidad_post_prep) !== esp
    }).length
    await supabase.from('stock_arqueo').update({
      estado: 'cerrado',
      cerrado_at: new Date().toISOString(),
      post_prep_completado: true,
      diferencias_count: diffs,
    }).eq('id', tarea.id)
    setTarea(t => ({ ...t, estado: 'cerrado', diferencias_count: diffs }))
    setCerrando(false)
  }

  async function openDetalle(arq) {
    setDetalleControl(arq)
    const { data } = await supabase
      .from('stock_arqueo_linea').select('*').eq('arqueo_id', arq.id).order('producto_nombre')
    setDetalleLineas(data ?? [])
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // ── ADMIN: detalle ──
  if (isAdmin && detalleControl) return (
    <DetalleControl control={detalleControl} lineas={detalleLineas} onBack={() => setDetalleControl(null)} />
  )

  // ── ADMIN: historial del día ──
  if (isAdmin) return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Control diario</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <button onClick={generarTarea} disabled={generando}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          <ClipboardCheck size={15} />
          {generando ? 'Generando...' : 'Generar tarea de hoy'}
        </button>
      </div>

      {historial.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-14 text-center">
          <ClipboardCheck size={30} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No hay controles para hoy</p>
          <p className="text-slate-300 text-xs mt-1">Generá la tarea para asignarla al repartidor</p>
        </div>
      ) : (
        <div className="space-y-3">
          {historial.map(arq => (
            <button key={arq.id} onClick={() => openDetalle(arq)}
              className="w-full bg-white rounded-xl border border-slate-100 shadow-sm p-4 hover:border-violet-200 transition-colors text-left">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${arq.estado === 'cerrado' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="text-sm font-semibold text-slate-800">
                    {arq.estado === 'cerrado' ? 'Completado' : 'En progreso'}
                  </span>
                  {arq.diferencias_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      <AlertTriangle size={10} /> {arq.diferencias_count} diferencias
                    </span>
                  )}
                  {arq.diferencias_count === 0 && arq.estado === 'cerrado' && (
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Sin diferencias
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{arq.productos_contados}/{arq.productos_total} productos</span>
                  <ChevronRight size={14} className="text-slate-300" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // ── REPARTIDOR: sin tarea ──
  if (tarea === null) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-4">
        <ClipboardCheck size={30} className="text-violet-500" />
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-2">No hay tarea para hoy</h2>
      <p className="text-slate-400 text-sm max-w-xs">
        {esLaborable()
          ? 'El admin genera la tarea. Si no aparece, avisale.'
          : 'No hay control los fines de semana 🙌'}
      </p>
    </div>
  )

  // ── REPARTIDOR: tarea completada ──
  if (tarea?.estado === 'cerrado') {
    const diffs = tarea.diferencias_count ?? 0
    const okCount = lineas.length - diffs

    // Calcular detalle por linea
    const lineasConDiff = lineas.filter(l => {
      if (l.cantidad_post_prep == null || l.cantidad_inicial == null) return false
      const esp = parseFloat(l.cantidad_inicial) - parseFloat(l.cantidad_preparada_sis ?? 0)
      return Math.abs(parseFloat(l.cantidad_post_prep) - esp) > 0.001
    })

    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

    return (
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Ícono y título */}
        <div className="text-center mb-6">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${diffs > 0 ? 'bg-amber-100' : 'bg-emerald-100'}`}>
            {diffs > 0 ? <AlertTriangle size={36} className="text-amber-500" /> : <CheckCircle2 size={36} className="text-emerald-500" />}
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            {diffs > 0 ? 'Control completado con diferencias' : '¡Todo en orden! 🎉'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Cerrado a las {hora}</p>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{okCount}</div>
            <div className="text-xs text-emerald-700 mt-0.5">Sin diferencias</div>
          </div>
          <div className={`rounded-xl p-4 text-center border ${diffs > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
            <div className={`text-2xl font-bold ${diffs > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{diffs}</div>
            <div className={`text-xs mt-0.5 ${diffs > 0 ? 'text-amber-700' : 'text-slate-400'}`}>Con diferencia</div>
          </div>
        </div>

        {/* Detalle de diferencias */}
        {lineasConDiff.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden mb-5">
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Productos con diferencia</p>
            </div>
            {lineasConDiff.map(l => {
              const esp = parseFloat(l.cantidad_inicial) - parseFloat(l.cantidad_preparada_sis ?? 0)
              const diff = parseFloat(l.cantidad_post_prep) - esp
              return (
                <div key={l.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{l.producto_nombre}</p>
                    <p className="text-xs text-slate-400">
                      Esperado: {fmt(esp)} · Contado: {fmt(l.cantidad_post_prep)}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${diff < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {diff > 0 ? '+' : ''}{fmt(diff)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Productos ok (colapsado) */}
        {okCount > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-emerald-700">
              <span className="font-semibold">{okCount} productos</span> coincidieron perfectamente con lo esperado ✓
            </p>
          </div>
        )}

        {/* Mensaje de agradecimiento */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-600 font-medium">
            {diffs > 0
              ? 'Gracias por el control, Lorena 👏'
              : '¡Excelente trabajo hoy, Lorena! 🌟'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {diffs > 0
              ? 'Tu reporte ayuda a detectar irregularidades. El admin ya fue notificado.'
              : 'Todo en orden. Tu trabajo hace que el sistema funcione.'}
          </p>
        </div>
      </div>
    )
  }

  const inicialDone = lineas.length > 0 && lineas.every(l => l.cantidad_inicial != null)
  const postPrepDone = lineas.length > 0 && lineas.every(l => l.cantidad_post_prep != null)
  const lineasContadas = momento === 'inicial'
    ? lineas.filter(l => l.cantidad_inicial != null).length
    : lineas.filter(l => l.cantidad_post_prep != null).length

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Control diario</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}
          {' · '}{lineas.length} productos
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setMomento('inicial')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
            momento === 'inicial' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'
          }`}>
          <PackageCheck size={16} />
          Conteo inicial
          {inicialDone && <CheckCircle2 size={14} className="text-emerald-500" />}
        </button>
        <ArrowRight size={14} className="text-slate-300 shrink-0" />
        <button
          onClick={() => inicialDone && setMomento('post_prep')}
          disabled={!inicialDone}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
            momento === 'post_prep' ? 'border-violet-500 bg-violet-50 text-violet-700'
            : inicialDone ? 'border-slate-200 text-slate-500 hover:border-slate-300'
            : 'border-slate-100 text-slate-300 cursor-not-allowed'
          }`}>
          <Clock size={16} />
          Post-preparación
          {postPrepDone && <CheckCircle2 size={14} className="text-emerald-500" />}
        </button>
      </div>

      {/* Instrucción contextual */}
      <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${
        momento === 'inicial' ? 'bg-blue-50 text-blue-800' : 'bg-violet-50 text-violet-800'
      }`}>
        {momento === 'inicial'
          ? '📦 Contá la cantidad física de cada producto en el depósito ahora, antes de que se arme el pedido.'
          : <>
              🔍 El pedido ya fue preparado. Contá nuevamente cada producto.<br />
              <span className="text-xs opacity-75 mt-1 block">El sistema calcula automáticamente cuánto debería quedar basándose en lo que preparó el sistema.</span>
            </>
        }
      </div>

      {/* Progreso */}
      {lineas.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${momento === 'inicial' ? 'bg-blue-400' : 'bg-violet-400'}`}
              style={{ width: `${(lineasContadas / lineas.length) * 100}%` }} />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">{lineasContadas}/{lineas.length}</span>
        </div>
      )}

      {/* Lista */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-4">
        {lineas.map(l => (
          <LineaItem key={l.id} linea={l} momento={momento} onGuardar={handleGuardarLinea} />
        ))}
      </div>

      {/* Botones de cierre */}
      <div className="flex justify-end">
        {momento === 'inicial' && inicialDone && !postPrepDone && (
          <button onClick={cerrarInicial} disabled={cerrando}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
            <ArrowRight size={15} />
            {cerrando ? 'Actualizando sistema...' : 'Listo — esperar preparación'}
          </button>
        )}
        {momento === 'post_prep' && postPrepDone && (
          <button onClick={cerrarPostPrep} disabled={cerrando}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
            <Lock size={15} />
            {cerrando ? 'Guardando...' : 'Cerrar control del día'}
          </button>
        )}
      </div>
    </div>
  )
}
