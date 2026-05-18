import { useEffect, useState } from 'react'
import { Plus, Search, Phone, AlertTriangle, UserX, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const ESTADO_COLORS = {
  activo:   'bg-emerald-100 text-emerald-700',
  inactivo: 'bg-slate-100 text-slate-500',
}

const empty = {
  dni: '', nombre: '', apellido: '', celular: '',
  estado: 'activo', id_externo: '', observaciones: '',
}

function waLink(tel) {
  if (!tel) return null
  const num = tel.replace(/[\s\-()]/g, '')
  const clean = num.startsWith('+54') ? num.slice(1)
    : num.startsWith('0') ? '54' + num.slice(1)
    : '54' + num
  return `https://wa.me/${clean}`
}

function SortHeader({ label, col, sortCol, sortDir, onSort }) {
  const active = sortCol === col
  return (
    <th
      className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-slate-700 group"
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col leading-none">
          <ChevronUp  size={10} className={active && sortDir === 'asc'  ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-400'} />
          <ChevronDown size={10} className={active && sortDir === 'desc' ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-400'} />
        </span>
      </span>
    </th>
  )
}

export default function Personal() {
  const [rows, setRows]         = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch]     = useState('')
  const [estadoFilter, setEstadoFilter] = useState('activo')
  const [sortCol, setSortCol]   = useState('apellido')
  const [sortDir, setSortDir]   = useState('asc')
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm]         = useState(empty)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [alertas, setAlertas]   = useState([])

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    let data = rows
    if (estadoFilter !== 'todos') data = data.filter(r => r.estado === estadoFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(r =>
        r.nombre?.toLowerCase().includes(q) ||
        r.apellido?.toLowerCase().includes(q) ||
        r.dni?.includes(q) ||
        r.celular?.includes(q)
      )
    }
    data = [...data].sort((a, b) => {
      const va = (a[sortCol] ?? '').toString().toLowerCase()
      const vb = (b[sortCol] ?? '').toString().toLowerCase()
      const cmp = va.localeCompare(vb, 'es')
      return sortDir === 'asc' ? cmp : -cmp
    })
    setFiltered(data)
  }, [rows, search, estadoFilter, sortCol, sortDir])

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  async function fetchAll() {
    setLoading(true)
    const { data: personal } = await supabase.from('personal').select('*')
    setRows(personal ?? [])
    const { data: lugares } = await supabase
      .from('lugares')
      .select('id, nombre, responsable_id, personal:responsable_id(id, nombre, apellido, estado)')
      .not('responsable_id', 'is', null)
    setAlertas((lugares ?? []).filter(l => l.personal?.estado === 'inactivo'))
    setLoading(false)
  }

  function openNew()     { setForm(empty); setError(''); setModalOpen(true) }
  function openEdit(row) { setForm({ ...empty, ...row }); setError(''); setModalOpen(true) }

  async function handleSave() {
    if (!form.dni.trim())      { setError('El DNI es obligatorio'); return }
    if (!form.nombre.trim())   { setError('El nombre es obligatorio'); return }
    if (!form.apellido.trim()) { setError('El apellido es obligatorio'); return }
    setSaving(true); setError('')
    const payload = {
      dni:           form.dni.trim(),
      nombre:        form.nombre.trim(),
      apellido:      form.apellido.trim(),
      celular:       form.celular?.trim()       || null,
      estado:        form.estado,
      id_externo:    form.id_externo?.trim()    || null,
      observaciones: form.observaciones?.trim() || null,
      updated_at:    new Date().toISOString(),
    }
    const { error: err } = form.id
      ? await supabase.from('personal').update(payload).eq('id', form.id)
      : await supabase.from('personal').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    setModalOpen(false); fetchAll(); setSaving(false)
  }

  const inp = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500'
  const activos   = rows.filter(r => r.estado === 'activo').length
  const inactivos = rows.filter(r => r.estado === 'inactivo').length

  return (
    <div>
      {alertas.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
            <AlertTriangle size={16} /> {alertas.length} lugar{alertas.length > 1 ? 'es' : ''} con responsable dado de baja
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {alertas.map(l => (
              <span key={l.id} className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                <UserX size={11} /> {l.nombre} — {l.personal.nombre} {l.personal.apellido}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Personal</h1>
          <p className="text-sm text-slate-500 mt-0.5">{activos} activos · {inactivos} inactivos · {rows.length} total</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, apellido, DNI..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="todos">Todos</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {search || estadoFilter !== 'todos' ? 'No hay resultados' : 'No hay personal cargado aún'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <SortHeader label="Apellido"  col="apellido" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Nombre"    col="nombre"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">DNI</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Celular</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(row => (
                  <tr key={row.id} onClick={() => openEdit(row)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-slate-800">{row.apellido}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.nombre}
                      {row.id_externo && <div className="text-xs text-slate-400">ext. {row.id_externo}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell font-mono text-xs">{row.dni}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {row.celular ? (
                        <a href={waLink(row.celular) || '#'} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800">
                          <Phone size={11} /> {row.celular}
                        </a>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[row.estado]}`}>
                        {row.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={form.id ? 'Editar persona' : 'Nueva persona'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Apellido *</label>
              <input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">DNI *</label>
              <input value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Celular</label>
              <input value={form.celular ?? ''} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} className={inp} />
              {form.celular && waLink(form.celular) && (
                <a href={waLink(form.celular)} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-xs text-emerald-600 hover:text-emerald-800">
                  <Phone size={11} /> Abrir WhatsApp
                </a>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className={inp + ' bg-white'}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ID externo (RP)</label>
              <input value={form.id_externo ?? ''} onChange={e => setForm(f => ({ ...f, id_externo: e.target.value }))}
                placeholder="Legajo / ID RRHH" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
              <input value={form.observaciones ?? ''} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className={inp} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
