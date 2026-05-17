import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { User, Mail, Phone, Briefcase, Save, CheckCircle } from 'lucide-react'

const ROL_LABELS = {
  admin:      'Administrador',
  compras:    'Compras',
  preparador: 'Preparador',
  repartidor: 'Repartidor',
  recepcion:  'Recepción',
}

export default function Perfil() {
  const { profile, setProfile } = useAuth()
  const [form, setForm] = useState({
    nombre:   profile?.nombre   || '',
    telefono: profile?.telefono || '',
    cargo:    profile?.cargo    || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ nombre: form.nombre.trim(), telefono: form.telefono.trim(), cargo: form.cargo.trim() })
      .eq('id', profile.id)
      .select()
      .single()
    if (!error && data) {
      setProfile(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  const initials = profile?.nombre?.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() || '?'

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Mi perfil</h1>
        <p className="text-slate-500 text-sm mt-1">Tus datos personales en el sistema</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={profile.nombre} className="w-20 h-20 rounded-full object-cover ring-4 ring-emerald-100" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center ring-4 ring-emerald-50">
            <span className="text-2xl font-bold text-emerald-700">{initials}</span>
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-800 text-lg">{profile?.nombre}</p>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            {ROL_LABELS[profile?.rol] || profile?.rol || 'Sin rol'}
          </span>
          {profile?.avatar_url && (
            <p className="text-xs text-slate-400 mt-1">Foto de Google</p>
          )}
        </div>
      </div>

      {/* Datos de solo lectura */}
      <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
        <Mail size={16} className="text-slate-400 shrink-0" />
        <div>
          <p className="text-xs text-slate-400">Email (cuenta Google)</p>
          <p className="text-sm font-medium text-slate-700">{profile?.email || '—'}</p>
        </div>
      </div>

      {/* Formulario editable */}
      <form onSubmit={guardar} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <User size={14} className="inline mr-1.5 text-slate-400" />Nombre completo
          </label>
          <input
            type="text"
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            required
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Phone size={14} className="inline mr-1.5 text-slate-400" />Teléfono
          </label>
          <input
            type="tel"
            value={form.telefono}
            onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
            placeholder="Ej: 11 1234-5678"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Briefcase size={14} className="inline mr-1.5 text-slate-400" />Cargo / Función
          </label>
          <input
            type="text"
            value={form.cargo}
            onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
            placeholder="Ej: Encargado de compras"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-sm transition-colors"
        >
          {saved ? (
            <><CheckCircle size={16} /> Guardado</>
          ) : saving ? (
            'Guardando...'
          ) : (
            <><Save size={16} /> Guardar cambios</>
          )}
        </button>
      </form>
    </div>
  )
}
