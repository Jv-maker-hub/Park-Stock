import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const empty = { nombre: '', razon_social: '', cuit: '', email: '', telefono: '', activo: true }

export default function Clientes() {
  const [rows, setRows] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (!search.trim()) { setFiltered(rows); return }
    const q = search.toLowerCase()
    setFiltered(rows.filter(r =>
      r.nombre.toLowerCase().includes(q) ||
      r.razon_social?.toLowerCase().includes(q) ||
      r.cuit?.includes(q)
    ))
  }, [rows, search])

  async function fetchAll() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setRows(data ?? [])
    setLoading(false)
  }

  function openNew() { setForm(empty); setError(''); setModalOpen(true) }
  function openEdit(row) { setForm({ ...row }); setError(''); setModalOpen(true) }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    const payload = {
      nombre: form.nombre.trim(),
      razon_social: form.razon_social?.trim() || null,
      cuit: form.cuit?.trim() || null,
      email: form.email?.trim() || null,
      telefono: form.telefono?.trim() || null,
      activo: form.activo,
    }
    const { error } = form.id
      ? await supabase.from('clientes').update(payload).eq('id', form.id)
      : await supabase.from('clientes').insert(payload)
    if (error) { setError(error.message); setSaving(false); return }
    setModalOpen(false)
    fetchAll()
    setSaving(false)
  }

  const input = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {rows.filter(r => r.activo).length} activos · {rows.length} total
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} /> Nuevo cliente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, razón social o CUIT..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {search ? 'Sin resultados' : 'No hay clientes cargados aún'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Razón social</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">CUIT</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{row.nombre}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{row.razon_social || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell font-mono text-xs">{row.cuit || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(row)}
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={form.id ? 'Editar cliente' : 'Nuevo cliente'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Razón social</label>
              <input value={form.razon_social ?? ''} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CUIT</label>
              <input value={form.cuit ?? ''} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))}
                placeholder="XX-XXXXXXXX-X" className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono</label>
              <input value={form.telefono ?? ''} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={input} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              className="w-4 h-4 accent-emerald-600" />
            <span className="text-sm text-slate-700">Activo</span>
          </label>

          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors">
              <Check size={15} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
