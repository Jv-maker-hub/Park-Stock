import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Plus, Package, ChevronRight, Calendar, CheckCircle, Truck, FileEdit, Clock } from 'lucide-react'

const ESTADO = {
  borrador:    { label: 'Borrador',     color: 'bg-slate-100 text-slate-600',   icon: FileEdit },
  confirmado:  { label: 'Confirmado',   color: 'bg-blue-100 text-blue-700',     icon: CheckCircle },
  en_reparto:  { label: 'En reparto',   color: 'bg-amber-100 text-amber-700',   icon: Truck },
  completado:  { label: 'Completado',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function mesLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export default function Pedidos() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pedidos, setPedidos]   = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm]   = useState({ mes: '', cliente_id: '' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [pedRes, cliRes] = await Promise.all([
      supabase.from('pedidos').select('*, clientes(nombre), pedido_detalle(id, entregado)').order('mes', { ascending: false }),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setPedidos(pedRes.data || [])
    setClientes(cliRes.data || [])
    setLoading(false)
  }

  async function crearPedido() {
    if (!newForm.mes) return
    const { data } = await supabase
      .from('pedidos')
      .insert({ mes: newForm.mes + '-01', cliente_id: newForm.cliente_id || null, created_by: profile.id })
      .select()
      .single()
    if (data) {
      setCreating(false)
      navigate(`/pedidos/${data.id}`)
    }
  }

  // Mes por defecto: mes actual
  const hoy = new Date()
  const mesDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  if (loading) return <div className="p-6 text-slate-400 text-sm">Cargando...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pedidos</h1>
          <p className="text-slate-500 text-sm mt-1">Entregas mensuales por lugar</p>
        </div>
        {['admin','compras'].includes(profile?.rol) && (
          <button
            onClick={() => { setCreating(true); setNewForm({ mes: mesDefault, cliente_id: clientes[0]?.id || '' }) }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo pedido
          </button>
        )}
      </div>

      {/* Form nuevo pedido */}
      {creating && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-slate-800">Nuevo pedido mensual</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Mes</label>
              <input type="month" value={newForm.mes}
                onChange={e => setNewForm(f => ({ ...f, mes: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            {clientes.length > 0 && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
                <select value={newForm.cliente_id}
                  onChange={e => setNewForm(f => ({ ...f, cliente_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={crearPedido}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
              Crear
            </button>
            <button onClick={() => setCreating(false)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm rounded-lg transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de pedidos */}
      {pedidos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No hay pedidos todavía</p>
          <p className="text-slate-400 text-xs mt-1">Creá el primer pedido mensual</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pedidos.map(p => {
            const est = ESTADO[p.estado] || ESTADO.borrador
            const Icon = est.icon
            const total   = p.pedido_detalle?.length || 0
            const entregados = p.pedido_detalle?.filter(d => d.entregado).length || 0
            return (
              <button key={p.id} onClick={() => navigate(`/pedidos/${p.id}`)}
                className="w-full bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 hover:border-emerald-300 hover:shadow-sm transition-all text-left">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Calendar size={18} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{mesLabel(p.mes)}</span>
                    {p.clientes?.nombre && (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{p.clientes.nombre}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {total > 0 ? `${entregados} / ${total} líneas entregadas` : 'Sin líneas cargadas'}
                  </div>
                </div>
                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${est.color}`}>
                  <Icon size={11} /> {est.label}
                </span>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
