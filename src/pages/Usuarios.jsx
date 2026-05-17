import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { UserCheck, UserX, Clock, Shield } from 'lucide-react'

const ROLES = [
  { value: 'admin',      label: 'Admin',      color: 'bg-purple-100 text-purple-700' },
  { value: 'compras',    label: 'Compras',    color: 'bg-blue-100 text-blue-700' },
  { value: 'preparador', label: 'Preparador', color: 'bg-amber-100 text-amber-700' },
  { value: 'repartidor', label: 'Repartidor', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'recepcion',  label: 'Recepción',  color: 'bg-orange-100 text-orange-700' },
]

function rolBadge(rol) {
  const r = ROLES.find(x => x.value === rol)
  if (!r) return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">Sin rol</span>
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.color}`}>{r.label}</span>
}

export default function Usuarios() {
  const { profile: myProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('activo', { ascending: true })
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function aprobar(id, rol) {
    setSaving(id)
    await supabase.from('profiles').update({ activo: true, rol }).eq('id', id)
    await fetchUsers()
    setSaving(null)
  }

  async function cambiarRol(id, rol) {
    setSaving(id)
    await supabase.from('profiles').update({ rol }).eq('id', id)
    await fetchUsers()
    setSaving(null)
  }

  async function desactivar(id) {
    if (!confirm('¿Desactivar este usuario?')) return
    setSaving(id)
    await supabase.from('profiles').update({ activo: false, rol: null }).eq('id', id)
    await fetchUsers()
    setSaving(null)
  }

  const pendientes = users.filter(u => !u.activo)
  const activos = users.filter(u => u.activo)

  if (loading) return <div className="p-6 text-slate-400">Cargando...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Usuarios</h1>
        <p className="text-slate-500 text-sm mt-1">Gestioná quién tiene acceso y con qué rol</p>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-2 mb-3">
            <Clock size={14} /> Esperando aprobación ({pendientes.length})
          </h2>
          <div className="space-y-2">
            {pendientes.map(u => (
              <PendingCard
                key={u.id}
                u={u}
                saving={saving === u.id}
                onAprobar={(rol) => aprobar(u.id, rol)}
                isMe={u.id === myProfile?.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Activos */}
      <div>
        <h2 className="text-sm font-semibold text-emerald-600 uppercase tracking-wide flex items-center gap-2 mb-3">
          <UserCheck size={14} /> Usuarios activos ({activos.length})
        </h2>
        {activos.length === 0 ? (
          <p className="text-slate-400 text-sm">No hay usuarios activos todavía</p>
        ) : (
          <div className="space-y-2">
            {activos.map(u => (
              <ActiveCard
                key={u.id}
                u={u}
                saving={saving === u.id}
                onCambiarRol={(rol) => cambiarRol(u.id, rol)}
                onDesactivar={() => desactivar(u.id)}
                isMe={u.id === myProfile?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PendingCard({ u, saving, onAprobar, isMe }) {
  const [rolSeleccionado, setRolSeleccionado] = useState('operativo')

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <Avatar url={u.avatar_url} nombre={u.nombre} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 text-sm">{u.nombre} {isMe && <span className="text-xs text-slate-400">(vos)</span>}</p>
        <p className="text-xs text-slate-500">{u.email}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={rolSeleccionado}
          onChange={e => setRolSeleccionado(e.target.value)}
          className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button
          onClick={() => onAprobar(rolSeleccionado)}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <UserCheck size={13} /> {saving ? 'Guardando...' : 'Aprobar'}
        </button>
      </div>
    </div>
  )
}

function ActiveCard({ u, saving, onCambiarRol, onDesactivar, isMe }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <Avatar url={u.avatar_url} nombre={u.nombre} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 text-sm">
          {u.nombre} {isMe && <span className="text-xs text-slate-400">(vos)</span>}
          {u.rol === 'admin' && <Shield size={12} className="inline ml-1 text-purple-500" />}
        </p>
        <p className="text-xs text-slate-500">{u.email}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {rolBadge(u.rol)}
        {!isMe && (
          <>
            <select
              defaultValue={u.rol || ''}
              onChange={e => onCambiarRol(e.target.value)}
              disabled={saving}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>Cambiar rol</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              onClick={onDesactivar}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50 text-xs rounded-lg transition-colors border border-red-200"
            >
              <UserX size={13} /> Revocar
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Avatar({ url, nombre }) {
  if (url) return <img src={url} alt={nombre} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
  const initials = nombre?.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() || '?'
  return (
    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-emerald-700">{initials}</span>
    </div>
  )
}
