import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  Truck, PackageCheck, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, RefreshCw, Loader2,
  ClipboardList, X
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function estadoBadge(estado) {
  const map = {
    aprobada:               { label: 'Aprobada',      bg: 'bg-green-100 text-green-700' },
    enviada:                { label: 'Enviada',       bg: 'bg-blue-100 text-blue-700' },
    parcialmente_recibida:  { label: 'Parcial',       bg: 'bg-violet-100 text-violet-700' },
    recibida:               { label: 'Recibida ✓',   bg: 'bg-emerald-100 text-emerald-700' },
  }
  const { label, bg } = map[estado] || { label: estado, bg: 'bg-slate-100 text-slate-700' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg}`}>{label}</span>
}

// ─── Modal: Registrar recepción ────────────────────────────────────────────────
function RecepcionModal({ oc, onClose, onSaved }) {
  const { profile } = useAuth()
  const [lineas, setLineas] = useState(
    (oc.ordenes_compra_linea || []).map(l => ({
      ...l,
      cant_recibida_input: l.cantidad_recibida > 0 ? String(l.cantidad_recibida) : String(l.cantidad_pedida),
      obs_input: '',
    }))
  )
  const [obsGeneral, setObsGeneral] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateLinea(id, field, val) {
    setLineas(prev => prev.map(l => l.id === id ? { ...l, [field]: val } : l))
  }

  async function handleGuardar() {
    setError('')
    setSaving(true)
    try {
      const ahora = new Date().toISOString()
      const hayDiferencias = lineas.some(l => {
        const recibida = Number(l.cant_recibida_input) || 0
        return Math.abs(recibida - l.cantidad_pedida) > 0.001
      })

      // Insertar recepción
      const { data: rec, error: recErr } = await supabase
        .from('recepciones')
        .insert({
          oc_id: oc.id,
          recibido_por: profile.id,
          fecha_recepcion: new Date().toISOString().slice(0, 10),
          observaciones: obsGeneral,
          diferencias: hayDiferencias,
          stock_actualizado: false,
        })
        .select()
        .single()

      if (recErr) throw recErr

      // Insertar líneas de recepción
      const recLineas = lineas.map(l => ({
        recepcion_id: rec.id,
        oc_linea_id: l.id,
        cantidad_recibida: Number(l.cant_recibida_input) || 0,
        observaciones: l.obs_input || null,
      }))

      const { error: rlErr } = await supabase
        .from('recepciones_linea')
        .insert(recLineas)

      if (rlErr) throw rlErr

      // Actualizar cantidades recibidas en ordenes_compra_linea
      for (const l of lineas) {
        await supabase
          .from('ordenes_compra_linea')
          .update({
            cantidad_recibida: Number(l.cant_recibida_input) || 0,
            recibida_en: ahora,
            recibida_por: profile.id,
          })
          .eq('id', l.id)
      }

      // Determinar nuevo estado de la OC
      const totalPedido   = lineas.reduce((s, l) => s + l.cantidad_pedida, 0)
      const totalRecibido = lineas.reduce((s, l) => s + (Number(l.cant_recibida_input) || 0), 0)
      const nuevoEstado   = totalRecibido >= totalPedido
        ? 'recibida'
        : totalRecibido > 0
        ? 'parcialmente_recibida'
        : 'enviada'

      await supabase
        .from('ordenes_compra')
        .update({ estado: nuevoEstado })
        .eq('id', oc.id)

      onSaved(rec.id, hayDiferencias)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Actualizar stock ──────────────────────────────────────────────────────
  async function handleActualizarStock(recepcionId) {
    setSaving(true)
    setError('')
    try {
      // Obtener líneas de recepción
      const { data: rl } = await supabase
        .from('recepciones_linea')
        .select('cantidad_recibida, oc_linea_id')
        .eq('recepcion_id', recepcionId)

      const { data: ocLineas } = await supabase
        .from('ordenes_compra_linea')
        .select('id, producto_id')
        .in('id', rl.map(r => r.oc_linea_id))

      const lineasMap = {}
      for (const l of ocLineas || []) lineasMap[l.id] = l

      // Upsert en tabla stock (asumiendo tabla stock con lugar_id o sin lugar)
      for (const r of rl || []) {
        const ocLinea = lineasMap[r.oc_linea_id]
        if (!ocLinea?.producto_id || !r.cantidad_recibida) continue

        // Incrementar stock en depósito (lugar_id = null = depósito central)
        const { data: existing } = await supabase
          .from('stock')
          .select('id, cantidad')
          .eq('producto_id', ocLinea.producto_id)
          .is('lugar_id', null)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('stock')
            .update({ cantidad: existing.cantidad + r.cantidad_recibida })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('stock')
            .insert({ producto_id: ocLinea.producto_id, lugar_id: null, cantidad: r.cantidad_recibida })
        }
      }

      // Marcar recepción como stock actualizado
      await supabase
        .from('recepciones')
        .update({ stock_actualizado: true })
        .eq('id', recepcionId)

      alert('Stock actualizado correctamente')
      onSaved(recepcionId, false)
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
          <div>
            <h2 className="font-semibold text-slate-800">Registrar recepción</h2>
            <p className="text-xs text-slate-400 mt-0.5">{oc.numero} · {oc.proveedores?.nombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Header de columnas */}
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 uppercase px-1">
            <div className="col-span-5">Producto</div>
            <div className="col-span-2 text-right">Pedido</div>
            <div className="col-span-2 text-right">Recibido</div>
            <div className="col-span-3 text-right">Diferencia</div>
          </div>

          {/* Líneas */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {lineas.map(l => {
              const recibida = Number(l.cant_recibida_input) || 0
              const diff = recibida - l.cantidad_pedida
              const diffColor = Math.abs(diff) < 0.001 ? 'text-green-600' : diff > 0 ? 'text-amber-600' : 'text-red-600'

              return (
                <div key={l.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg px-3 py-2">
                  <div className="col-span-5 text-sm text-slate-700">{l.nombre_snapshot}</div>
                  <div className="col-span-2 text-right text-sm font-mono text-slate-500">{l.cantidad_pedida}</div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={l.cant_recibida_input}
                      onChange={e => updateLinea(l.id, 'cant_recibida_input', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>
                  <div className={`col-span-3 text-right text-sm font-semibold ${diffColor}`}>
                    {Math.abs(diff) < 0.001
                      ? <span className="flex items-center justify-end gap-1"><CheckCircle size={14}/> OK</span>
                      : diff > 0
                      ? `+${diff.toFixed(1)}`
                      : diff.toFixed(1)
                    }
                  </div>
                </div>
              )
            })}
          </div>

          {/* Observaciones generales */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones generales</label>
            <textarea
              value={obsGeneral}
              onChange={e => setObsGeneral(e.target.value)}
              rows={2}
              placeholder="Ej: Llegó en buen estado, faltaron 5 bolsas de repuesto..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Alerta diferencias */}
          {lineas.some(l => Math.abs((Number(l.cant_recibida_input) || 0) - l.cantidad_pedida) > 0.001) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0"/>
              <p className="text-xs text-amber-700">
                Hay diferencias entre lo pedido y lo recibido. Quedará registrado. El stock se actualizará con la cantidad real recibida.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin"/> : <PackageCheck size={15}/>}
            Confirmar recepción y actualizar stock
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Card de OC pendiente ─────────────────────────────────────────────────────
function OCPendienteCard({ oc, onRecibir }) {
  const [open, setOpen] = useState(false)

  const totalLineas   = oc.ordenes_compra_linea?.length || 0
  const pct           = totalLineas > 0
    ? Math.round(
        (oc.ordenes_compra_linea || []).reduce((s, l) => s + (l.cantidad_recibida || 0), 0) /
        (oc.ordenes_compra_linea || []).reduce((s, l) => s + l.cantidad_pedida, 0) * 100
      )
    : 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <Truck size={20} className="text-blue-500"/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm">{oc.numero}</span>
              {estadoBadge(oc.estado)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {oc.proveedores?.nombre || 'Sin proveedor'}
              {oc.fecha_esperada && ` · Esperada: ${oc.fecha_esperada}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="hidden sm:block w-32">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Recibido</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }}/>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onRecibir(oc) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700"
          >
            <PackageCheck size={14}/> Recibir
          </button>
          {open ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400">
                <th className="text-left pb-2">Producto</th>
                <th className="text-right pb-2">Pedido</th>
                <th className="text-right pb-2">Recibido</th>
                <th className="text-right pb-2">Falta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(oc.ordenes_compra_linea || []).map(l => {
                const falta = l.cantidad_pedida - (l.cantidad_recibida || 0)
                return (
                  <tr key={l.id} className="text-slate-700">
                    <td className="py-1.5">{l.nombre_snapshot}</td>
                    <td className="py-1.5 text-right font-mono">{l.cantidad_pedida} {l.unidad || ''}</td>
                    <td className="py-1.5 text-right font-mono text-emerald-600">{l.cantidad_recibida || 0}</td>
                    <td className={`py-1.5 text-right font-mono ${falta > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                      {falta > 0 ? falta : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {oc.observaciones && (
            <p className="text-xs text-slate-400 italic mt-2">Obs: {oc.observaciones}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Historial de recepciones ─────────────────────────────────────────────────
function HistorialCard({ rec }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${rec.diferencias ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            {rec.diferencias ? <AlertTriangle size={16} className="text-amber-500"/> : <CheckCircle size={16} className="text-emerald-500"/>}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{rec.ordenes_compra?.numero || `OC #${rec.oc_id}`}</p>
            <p className="text-xs text-slate-400">{rec.fecha_recepcion} · {rec.profiles?.nombre || 'Desconocido'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {rec.diferencias
            ? <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">Con diferencias</span>
            : <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">OK</span>
          }
          {rec.stock_actualizado
            ? <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Stock ✓</span>
            : <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-400">Stock pendiente</span>
          }
          {open ? <ChevronUp size={14} className="text-slate-300"/> : <ChevronDown size={14} className="text-slate-300"/>}
        </div>
      </div>

      {open && rec.observaciones && (
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-500">{rec.observaciones}</p>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Recepcion() {
  const [tab, setTab] = useState('pendientes')
  const [pendientes, setPendientes] = useState([])
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [ocActiva, setOcActiva] = useState(null)

  const fetchPendientes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ordenes_compra')
      .select(`
        *,
        proveedores(nombre),
        ordenes_compra_linea(*)
      `)
      .in('estado', ['aprobada', 'enviada', 'parcialmente_recibida'])
      .order('fecha_esperada', { ascending: true, nullsLast: true })
    setPendientes(data || [])
    setLoading(false)
  }, [])

  const fetchHistorial = useCallback(async () => {
    const { data } = await supabase
      .from('recepciones')
      .select(`
        *,
        ordenes_compra(numero),
        profiles(nombre)
      `)
      .order('created_at', { ascending: false })
      .limit(50)
    setHistorial(data || [])
  }, [])

  useEffect(() => { fetchPendientes() }, [fetchPendientes])
  useEffect(() => { if (tab === 'historial') fetchHistorial() }, [tab, fetchHistorial])

  function handleRecepcionGuardada() {
    setOcActiva(null)
    fetchPendientes()
    if (tab === 'historial') fetchHistorial()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Recepción de mercadería</h1>
          <p className="text-sm text-slate-500 mt-0.5">Controlá y registrá las entregas de proveedores</p>
        </div>
        <button
          onClick={fetchPendientes}
          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
        >
          <RefreshCw size={16}/>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { id: 'pendientes', label: `Pendientes (${pendientes.length})`, icon: Truck },
          { id: 'historial',  label: 'Historial',                        icon: ClipboardList },
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
      {tab === 'pendientes' && (
        <div className="space-y-3">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-emerald-500"/>
            </div>
          )}
          {!loading && pendientes.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Truck size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="text-sm">No hay entregas pendientes</p>
              <p className="text-xs mt-1">Las OCs aprobadas o enviadas aparecen acá</p>
            </div>
          )}
          {pendientes.map(oc => (
            <OCPendienteCard
              key={oc.id}
              oc={oc}
              onRecibir={setOcActiva}
            />
          ))}
        </div>
      )}

      {tab === 'historial' && (
        <div className="space-y-2">
          {historial.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="text-sm">Sin recepciones registradas</p>
            </div>
          )}
          {historial.map(rec => (
            <HistorialCard key={rec.id} rec={rec}/>
          ))}
        </div>
      )}

      {/* Modal recepción */}
      {ocActiva && (
        <RecepcionModal
          oc={ocActiva}
          onClose={() => setOcActiva(null)}
          onSaved={handleRecepcionGuardada}
        />
      )}
    </div>
  )
}
