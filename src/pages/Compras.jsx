import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ShoppingCart, Package, TrendingDown, AlertTriangle,
  CheckCircle, Clock, ChevronRight, Plus, Trash2,
  Send, X, ChevronDown, ChevronUp, RefreshCw, Loader2, Download
} from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────────────────────
const WORKER_URL = 'https://xubio-proxy.julianvilche.workers.dev'

const ESTADO_LABELS = {
  borrador:               { label: 'Borrador',           color: 'slate' },
  pendiente_aprobacion:   { label: 'Pend. aprobación',   color: 'amber' },
  aprobada:               { label: 'Aprobada',           color: 'green' },
  enviada:                { label: 'Enviada',            color: 'blue' },
  parcialmente_recibida:  { label: 'Parcial',            color: 'violet' },
  recibida:               { label: 'Recibida',           color: 'emerald' },
  anulada:                { label: 'Anulada',            color: 'red' },
}

const HORIZON_OPTIONS = [
  { value: 30,  label: '30 días' },
  { value: 60,  label: '60 días' },
  { value: 90,  label: '90 días' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function estadoBadge(estado) {
  const { label, color } = ESTADO_LABELS[estado] || { label: estado, color: 'slate' }
  const classes = {
    slate:   'bg-slate-100 text-slate-700',
    amber:   'bg-amber-100 text-amber-700',
    green:   'bg-green-100 text-green-700',
    blue:    'bg-blue-100 text-blue-700',
    violet:  'bg-violet-100 text-violet-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red:     'bg-red-100 text-red-700',
  }[color] || 'bg-slate-100 text-slate-700'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>{label}</span>
}

function coberturaBadge(dias) {
  if (dias === null || dias === undefined) return <span className="text-xs text-slate-400">—</span>
  if (dias <= 0)  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle size={11}/>Sin stock</span>
  if (dias <= 15) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><TrendingDown size={11}/>{dias}d</span>
  if (dias <= 30) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Clock size={11}/>{dias}d</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle size={11}/>{dias}d</span>
}

// ─── Modal: Nueva OC ──────────────────────────────────────────────────────────
function NuevaOCModal({ proveedores, sugeridos, onClose, onSaved }) {
  const { profile } = useAuth()
  const [step, setStep] = useState(1) // 1=proveedor, 2=productos, 3=resumen
  const [proveedorId, setProveedorId] = useState('')
  const [fechaEsperada, setFechaEsperada] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState(
    sugeridos.map(s => ({
      producto_id: s.id,
      xubio_producto_id: s.codigo_xubio,
      nombre_snapshot: s.nombre,
      cantidad_pedida: s.cantidad_sugerida || 1,
      precio_unitario: s.precio_unitario || '',
      unidad: s.unidad || '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const proveedorSel = proveedores.find(p => p.id === Number(proveedorId))

  function addLinea() {
    setLineas(prev => [...prev, {
      producto_id: '', xubio_producto_id: null,
      nombre_snapshot: '', cantidad_pedida: 1,
      precio_unitario: '', unidad: '',
    }])
  }

  function updateLinea(idx, field, val) {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  function removeLinea(idx) {
    setLineas(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setError('')
    if (!proveedorId) { setError('Seleccioná un proveedor'); return }
    if (lineas.length === 0) { setError('Agregá al menos un producto'); return }
    const invalid = lineas.find(l => !l.nombre_snapshot || !l.cantidad_pedida)
    if (invalid) { setError('Completá nombre y cantidad en todas las líneas'); return }

    setSaving(true)
    try {
      // Insertar OC
      const numero = `OC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
      const { data: oc, error: ocErr } = await supabase
        .from('ordenes_compra')
        .insert({
          numero,
          proveedor_id: Number(proveedorId),
          estado: 'borrador',
          fecha_emision: new Date().toISOString().slice(0, 10),
          fecha_esperada: fechaEsperada || null,
          observaciones,
          creada_por: profile.id,
        })
        .select()
        .single()

      if (ocErr) throw ocErr

      // Insertar líneas
      const lineasInsert = lineas.map(l => ({
        oc_id: oc.id,
        producto_id: l.producto_id || null,
        xubio_producto_id: l.xubio_producto_id || null,
        nombre_snapshot: l.nombre_snapshot,
        cantidad_pedida: Number(l.cantidad_pedida),
        precio_unitario: l.precio_unitario ? Number(l.precio_unitario) : null,
        unidad: l.unidad || null,
      }))

      const { error: linErr } = await supabase
        .from('ordenes_compra_linea')
        .insert(lineasInsert)

      if (linErr) throw linErr

      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mt-8 mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-slate-800">Nueva orden de compra</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Proveedor y fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor *</label>
              <select
                value={proveedorId}
                onChange={e => setProveedorId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Seleccioná…</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha esperada</label>
              <input
                type="date"
                value={fechaEsperada}
                onChange={e => setFechaEsperada(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Productos *</label>
              <button onClick={addLinea} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                <Plus size={14}/> Agregar línea
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {lineas.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg px-3 py-2">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={l.nombre_snapshot}
                      onChange={e => updateLinea(i, 'nombre_snapshot', e.target.value)}
                      placeholder="Nombre del producto"
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={l.cantidad_pedida}
                      onChange={e => updateLinea(i, 'cantidad_pedida', e.target.value)}
                      placeholder="Cant."
                      min="0.01"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={l.precio_unitario}
                      onChange={e => updateLinea(i, 'precio_unitario', e.target.value)}
                      placeholder="$ unit."
                      min="0"
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={l.unidad}
                      onChange={e => updateLinea(i, 'unidad', e.target.value)}
                      placeholder="Unidad"
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeLinea(i)} className="text-slate-300 hover:text-red-400">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
              {lineas.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-4">Sin productos. Usá "Agregar línea".</p>
              )}
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Resumen de totales */}
          {lineas.length > 0 && (
            <div className="bg-slate-50 rounded-lg px-4 py-3 flex justify-between text-sm">
              <span className="text-slate-500">{lineas.length} producto{lineas.length !== 1 ? 's' : ''}</span>
              <span className="font-semibold text-slate-700">
                Total estimado: ${lineas.reduce((acc, l) => {
                  const sub = (Number(l.cantidad_pedida) || 0) * (Number(l.precio_unitario) || 0)
                  return acc + sub
                }, 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin"/> : <Plus size={15}/>}
            Guardar OC
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Panel: Proyección de stock ────────────────────────────────────────────────
function TabProyeccion({ horizon, setHorizon, proyeccion, loading, onNuevaOC }) {
  const [expandedRows, setExpandedRows] = useState(new Set())

  const criticos = proyeccion.filter(p => p.cobertura_dias !== null && p.cobertura_dias <= horizon)
  const ok       = proyeccion.filter(p => p.cobertura_dias === null || p.cobertura_dias > horizon)

  function toggleRow(id) {
    setExpandedRows(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin text-emerald-500"/>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Horizon selector + botón OC */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">Ver cobertura para:</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {HORIZON_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setHorizon(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  horizon === opt.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {criticos.length > 0 && (
          <button
            onClick={() => onNuevaOC(criticos)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
          >
            <ShoppingCart size={15}/>
            Generar OC ({criticos.length} productos)
          </button>
        )}
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs text-red-500 font-medium mb-1">Sin stock</p>
          <p className="text-2xl font-bold text-red-600">{proyeccion.filter(p => p.cobertura_dias !== null && p.cobertura_dias <= 0).length}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-500 font-medium mb-1">Críticos (&lt;{horizon}d)</p>
          <p className="text-2xl font-bold text-amber-600">{criticos.length}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-500 font-medium mb-1">Con cobertura</p>
          <p className="text-2xl font-bold text-green-600">{ok.length}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Producto</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Stock</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Consumo/día</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Cobertura</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Sugerido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {proyeccion.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Sin datos de stock</td></tr>
            )}
            {proyeccion.map(p => (
              <tr
                key={p.id}
                onClick={() => toggleRow(p.id)}
                className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                  p.cobertura_dias !== null && p.cobertura_dias <= horizon ? 'bg-amber-50/40' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {expandedRows.has(p.id) ? <ChevronUp size={14} className="text-slate-400"/> : <ChevronDown size={14} className="text-slate-400"/>}
                    <div>
                      <p className="font-medium text-slate-800">{p.nombre}</p>
                      {p.categoria && <p className="text-xs text-slate-400">{p.categoria}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-700">
                  {p.stock_actual?.toFixed(1) ?? '—'} {p.unidad || ''}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">
                  {p.consumo_diario?.toFixed(2) ?? '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {coberturaBadge(p.cobertura_dias !== null ? Math.round(p.cobertura_dias) : null)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                  {p.cantidad_sugerida != null ? `${p.cantidad_sugerida.toFixed(1)} ${p.unidad || ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Panel: Lista de OCs ──────────────────────────────────────────────────────
function TabOrdenes({ ocs, loading, onRefresh, onAprobar, onEnviarXubio, profile }) {
  const esAdmin = profile?.rol === 'admin'
  const esCompras = profile?.rol === 'compras'

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin text-emerald-500"/>
    </div>
  )

  return (
    <div className="space-y-3">
      {ocs.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <ShoppingCart size={40} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">Sin órdenes de compra</p>
        </div>
      )}
      {ocs.map(oc => (
        <OCCard
          key={oc.id}
          oc={oc}
          esAdmin={esAdmin}
          esCompras={esCompras}
          onAprobar={onAprobar}
          onEnviarXubio={onEnviarXubio}
        />
      ))}
    </div>
  )
}

function OCCard({ oc, esAdmin, esCompras, onAprobar, onEnviarXubio }) {
  const [open, setOpen] = useState(false)

  const puedeAprobar = (esAdmin) && oc.estado === 'pendiente_aprobacion'
  const puedeEnviar  = (esAdmin || esCompras) && oc.estado === 'aprobada' && !oc.enviada_xubio

  const totalLineas = oc.ordenes_compra_linea?.length || 0
  const total = (oc.ordenes_compra_linea || []).reduce((acc, l) => {
    return acc + (Number(l.cantidad_pedida) || 0) * (Number(l.precio_unitario) || 0)
  }, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm">{oc.numero}</span>
              {estadoBadge(oc.estado)}
              {oc.enviada_xubio && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">En Xubio</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {oc.proveedores?.nombre || 'Sin proveedor'} · {oc.fecha_emision}
              {oc.fecha_esperada && ` · Entrega: ${oc.fecha_esperada}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-400">{totalLineas} producto{totalLineas !== 1 ? 's' : ''}</p>
            {total > 0 && <p className="text-sm font-semibold text-slate-700">${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</p>}
          </div>
          {open ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          {/* Líneas */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="text-left pb-2">Producto</th>
                <th className="text-right pb-2">Cantidad</th>
                <th className="text-right pb-2">$ Unit.</th>
                <th className="text-right pb-2">Subtotal</th>
                <th className="text-right pb-2">Recibido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(oc.ordenes_compra_linea || []).map(l => {
                const sub = (Number(l.cantidad_pedida) || 0) * (Number(l.precio_unitario) || 0)
                const recibPct = l.cantidad_pedida > 0 ? Math.round((l.cantidad_recibida / l.cantidad_pedida) * 100) : 0
                return (
                  <tr key={l.id} className="text-slate-700">
                    <td className="py-2">{l.nombre_snapshot}</td>
                    <td className="py-2 text-right font-mono">{l.cantidad_pedida} {l.unidad || ''}</td>
                    <td className="py-2 text-right font-mono">{l.precio_unitario ? `$${Number(l.precio_unitario).toLocaleString('es-AR')}` : '—'}</td>
                    <td className="py-2 text-right font-mono">{sub > 0 ? `$${sub.toLocaleString('es-AR')}` : '—'}</td>
                    <td className="py-2 text-right">
                      {l.cantidad_recibida > 0
                        ? <span className={`text-xs font-medium ${recibPct >= 100 ? 'text-green-600' : 'text-amber-600'}`}>{l.cantidad_recibida}/{l.cantidad_pedida}</span>
                        : <span className="text-xs text-slate-300">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Observaciones */}
          {oc.observaciones && (
            <p className="text-xs text-slate-500 italic">Obs: {oc.observaciones}</p>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1">
            {puedeAprobar && (
              <button
                onClick={() => onAprobar(oc.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
              >
                <CheckCircle size={14}/> Aprobar OC
              </button>
            )}
            {puedeEnviar && (
              <button
                onClick={() => onEnviarXubio(oc)}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700"
              >
                <Send size={14}/> Enviar a Xubio
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Compras() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('proyeccion')
  const [horizon, setHorizon] = useState(30)
  const [proyeccion, setProyeccion] = useState([])
  const [loadingProy, setLoadingProy] = useState(true)
  const [ocs, setOcs] = useState([])
  const [loadingOcs, setLoadingOcs] = useState(true)
  const [proveedores, setProveedores] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [sugeridosModal, setSugeridosModal] = useState([])

  // ── Cargar proyección ────────────────────────────────────────────────────────
  const fetchProyeccion = useCallback(async () => {
    setLoadingProy(true)
    try {
      // Obtener stock actual
      const { data: stocks } = await supabase
        .from('stock')
        .select('producto_id, cantidad')

      // Obtener pedidos entregados en los últimos 90 días para calcular consumo
      const desde = new Date()
      desde.setDate(desde.getDate() - 90)
      const { data: pedidos } = await supabase
        .from('pedido_detalle')
        .select('producto_id, cantidad')
        .gte('created_at', desde.toISOString())

      // Obtener todos los productos
      const { data: productos } = await supabase
        .from('productos')
        .select('id, nombre, unidad, codigo_xubio, categorias(nombre)')
        .eq('activo', true)

      if (!productos) return

      // Mapa de stock actual
      const stockMap = {}
      for (const s of stocks || []) stockMap[s.producto_id] = (stockMap[s.producto_id] || 0) + s.cantidad

      // Consumo diario promedio (90 días)
      const consumoMap = {}
      for (const p of pedidos || []) consumoMap[p.producto_id] = (consumoMap[p.producto_id] || 0) + p.cantidad

      const result = productos.map(prod => {
        const stockActual  = stockMap[prod.id] || 0
        const consumoTotal = consumoMap[prod.id] || 0
        const consumoDiario = consumoTotal / 90
        const coberturaDias = consumoDiario > 0 ? stockActual / consumoDiario : null
        const cantSugerida  = consumoDiario > 0
          ? Math.max(0, consumoDiario * horizon * 1.2 - stockActual)
          : null

        return {
          id: prod.id,
          nombre: prod.nombre,
          unidad: prod.unidad,
          codigo_xubio: prod.codigo_xubio,
          categoria: prod.categorias?.nombre,
          stock_actual: stockActual,
          consumo_diario: consumoDiario,
          cobertura_dias: coberturaDias !== null ? parseFloat(coberturaDias.toFixed(1)) : null,
          cantidad_sugerida: cantSugerida !== null ? parseFloat(cantSugerida.toFixed(1)) : null,
        }
      })

      // Ordenar: sin stock primero, luego por cobertura ascendente
      result.sort((a, b) => {
        const da = a.cobertura_dias ?? 9999
        const db = b.cobertura_dias ?? 9999
        return da - db
      })

      setProyeccion(result)
    } finally {
      setLoadingProy(false)
    }
  }, [horizon])

  // ── Cargar OCs ───────────────────────────────────────────────────────────────
  const fetchOcs = useCallback(async () => {
    setLoadingOcs(true)
    const { data } = await supabase
      .from('ordenes_compra')
      .select(`
        *,
        proveedores(nombre),
        ordenes_compra_linea(*)
      `)
      .order('created_at', { ascending: false })
    setOcs(data || [])
    setLoadingOcs(false)
  }, [])

  const fetchProveedores = useCallback(async () => {
    const { data } = await supabase
      .from('proveedores')
      .select('id, nombre, xubio_id')
      .eq('activo', true)
      .order('nombre')
    setProveedores(data || [])
  }, [])

  // ── Sincronizar proveedores desde Xubio ──────────────────────────────────────
  const [syncingProvs, setSyncingProvs] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  async function handleSyncProveedores() {
    setSyncingProvs(true)
    setSyncResult(null)
    try {
      const res = await fetch(`${WORKER_URL}/api/xubio/proveedores`)
      if (!res.ok) throw new Error(`Worker error: ${res.status}`)
      const xubioProvs = await res.json()

      let nuevos = 0
      let actualizados = 0

      for (const p of xubioProvs) {
        // Buscar si ya existe por xubio_id
        const { data: existing } = await supabase
          .from('proveedores')
          .select('id')
          .eq('xubio_id', p.xubio_id)
          .maybeSingle()

        if (existing) {
          // Actualizar nombre si cambió
          await supabase
            .from('proveedores')
            .update({ nombre: p.nombre })
            .eq('id', existing.id)
          actualizados++
        } else {
          // Insertar nuevo
          await supabase
            .from('proveedores')
            .insert({ nombre: p.nombre, xubio_id: p.xubio_id, activo: true })
          nuevos++
        }
      }

      await fetchProveedores()
      setSyncResult({ ok: true, nuevos, actualizados, total: xubioProvs.length })
    } catch (e) {
      setSyncResult({ ok: false, error: e.message })
    } finally {
      setSyncingProvs(false)
    }
  }

  useEffect(() => { fetchProyeccion() }, [fetchProyeccion])
  useEffect(() => { fetchOcs(); fetchProveedores() }, [fetchOcs, fetchProveedores])

  // ── Aprobar OC ───────────────────────────────────────────────────────────────
  async function handleAprobar(ocId) {
    await supabase
      .from('ordenes_compra')
      .update({
        estado: 'aprobada',
        aprobada_por: profile.id,
        aprobada_at: new Date().toISOString(),
      })
      .eq('id', ocId)
    fetchOcs()
  }

  // ── Enviar a Xubio ────────────────────────────────────────────────────────────
  async function handleEnviarXubio(oc) {
    try {
      const prov = proveedores.find(p => p.id === oc.proveedor_id)
      if (!prov?.xubio_id) {
        alert('El proveedor no tiene ID de Xubio configurado. Asocialo en la tabla de proveedores.')
        return
      }

      const items = (oc.ordenes_compra_linea || []).map(l => ({
        xubio_producto_id: l.xubio_producto_id,
        nombre: l.nombre_snapshot,
        cantidad: l.cantidad_pedida,
        precio: l.precio_unitario || 0,
      })).filter(i => i.xubio_producto_id)

      if (items.length === 0) {
        alert('Ninguna línea tiene ID de producto Xubio. Mapeá los productos primero.')
        return
      }

      const res = await fetch(`${WORKER_URL}/api/xubio/ordenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_xubio_id: prov.xubio_id,
          fecha: oc.fecha_emision,
          items,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear en Xubio')
      }

      const xubioData = await res.json()

      await supabase
        .from('ordenes_compra')
        .update({
          xubio_id: xubioData.transaccionid || null,
          enviada_xubio: true,
          enviada_xubio_at: new Date().toISOString(),
          estado: 'enviada',
        })
        .eq('id', oc.id)

      fetchOcs()
    } catch (e) {
      alert(`Error al enviar a Xubio: ${e.message}`)
    }
  }

  function handleNuevaOC(sugeridos = []) {
    setSugeridosModal(sugeridos)
    setShowModal(true)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Compras</h1>
          <p className="text-sm text-slate-500 mt-0.5">Proyección de stock y órdenes de compra</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchProyeccion(); fetchOcs() }}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <RefreshCw size={16}/>
          </button>
          <button
            onClick={handleSyncProveedores}
            disabled={syncingProvs}
            title="Sincronizar proveedores desde Xubio"
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {syncingProvs ? <Loader2 size={15} className="animate-spin"/> : <Download size={15}/>}
            Proveedores Xubio
          </button>
          <button
            onClick={() => handleNuevaOC([])}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
          >
            <Plus size={16}/> Nueva OC
          </button>
        </div>
      </div>

      {/* Resultado sync */}
      {syncResult && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm ${syncResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {syncResult.ok
            ? <span>✓ Sincronización completa — {syncResult.nuevos} nuevos, {syncResult.actualizados} actualizados ({syncResult.total} proveedores en Xubio)</span>
            : <span>✗ Error: {syncResult.error}</span>
          }
          <button onClick={() => setSyncResult(null)} className="ml-4 opacity-60 hover:opacity-100"><X size={14}/></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { id: 'proyeccion', label: 'Proyección de stock', icon: TrendingDown },
          { id: 'ordenes',    label: `Órdenes de compra (${ocs.length})`, icon: ShoppingCart },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'proyeccion' && (
        <TabProyeccion
          horizon={horizon}
          setHorizon={setHorizon}
          proyeccion={proyeccion}
          loading={loadingProy}
          onNuevaOC={handleNuevaOC}
        />
      )}
      {tab === 'ordenes' && (
        <TabOrdenes
          ocs={ocs}
          loading={loadingOcs}
          onRefresh={fetchOcs}
          onAprobar={handleAprobar}
          onEnviarXubio={handleEnviarXubio}
          profile={profile}
        />
      )}

      {/* Modal nueva OC */}
      {showModal && (
        <NuevaOCModal
          proveedores={proveedores}
          sugeridos={sugeridosModal}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchOcs(); setTab('ordenes') }}
        />
      )}
    </div>
  )
}
