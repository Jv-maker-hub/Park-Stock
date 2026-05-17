import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Check, AlertTriangle, Layers, Tag, ChevronRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const UNIDADES = ['unidad','litro','kg','ml','gr','rollo','par','caja','paquete','bidón','saco','tarro']

const emptyProd = {
  nombre: '', codigo_interno: '', codigo_xubio: '',
  categoria_id: '', unidad: 'unidad', unidad_entrega: 'unidad',
  unidad_compra: '', factor_conversion: 1,
  stock_minimo: 0, activo: true,
}

const emptyVar = {
  nombre: '', marca: '', proveedor: '',
  codigo_barras: '', codigo_xubio: '', codigo_interno: '',
  unidad_compra: '', cantidad_por_unidad_compra: 1,
  activo: true,
}

const emptyCat = { nombre: '', descripcion: '' }

function conversionPreview(form) {
  const factor = parseFloat(form.factor_conversion)
  if (!form.unidad_compra || !factor || factor <= 1) return null
  const unidadEntrega = form.unidad_entrega || form.unidad || 'unidad'
  return `1 ${form.unidad_compra} = ${factor} ${unidadEntrega}`
}

export default function Productos() {
  const [tab, setTab] = useState('productos') // 'productos' | 'categorias'

  // Productos state
  const [rows, setRows] = useState([])
  const [filtered, setFiltered] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('todas')
  const [loading, setLoading] = useState(true)
  const [stockMap, setStockMap] = useState({})
  const [variantesMap, setVariantesMap] = useState({})
  const [categorias, setCategorias] = useState([])

  // Modales producto
  const [prodModal, setProdModal] = useState(false)
  const [form, setForm] = useState(emptyProd)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Modal variantes (lista)
  const [varModal, setVarModal] = useState(false)
  const [varProd, setVarProd] = useState(null)
  const [variantes, setVariantes] = useState([])
  const [varLoading, setVarLoading] = useState(false)

  // Sub-modal variante (form)
  const [varSubModal, setVarSubModal] = useState(false)
  const [varForm, setVarForm] = useState(emptyVar)
  const [varSaving, setVarSaving] = useState(false)
  const [varError, setVarError] = useState('')

  // Categorías state
  const [cats, setCats] = useState([])
  const [catModal, setCatModal] = useState(false)
  const [catForm, setCatForm] = useState(emptyCat)
  const [catSaving, setCatSaving] = useState(false)
  const [catError, setCatError] = useState('')

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    let data = rows
    if (catFilter !== 'todas') data = data.filter(r => String(r.categoria_id) === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(r =>
        r.nombre.toLowerCase().includes(q) ||
        r.codigo_interno?.toLowerCase().includes(q) ||
        r.codigo_xubio?.toLowerCase().includes(q)
      )
    }
    setFiltered(data)
  }, [rows, search, catFilter])

  async function fetchAll() {
    setLoading(true)
    const [prodsRes, stockRes, catsRes, varsRes] = await Promise.all([
      supabase.from('productos').select('*').order('nombre'),
      supabase.from('stock').select('*'),
      supabase.from('categorias_producto').select('*').order('nombre'),
      supabase.from('producto_variantes').select('producto_id').eq('activo', true),
    ])
    setRows(prodsRes.data ?? [])
    const map = {}
    stockRes.data?.forEach(s => { map[s.producto_id] = s.cantidad })
    setStockMap(map)
    setCategorias(catsRes.data ?? [])
    setCats(catsRes.data ?? [])
    const vmap = {}
    varsRes.data?.forEach(v => { vmap[v.producto_id] = (vmap[v.producto_id] || 0) + 1 })
    setVariantesMap(vmap)
    setLoading(false)
  }

  // ─── PRODUCTO MODAL ───────────────────────────────────────────────────────
  function openNewProd() { setForm(emptyProd); setError(''); setProdModal(true) }
  function openEditProd(row) {
    setForm({
      ...row,
      categoria_id: row.categoria_id ?? '',
      unidad_entrega: row.unidad_entrega || row.unidad || 'unidad',
      unidad_compra: row.unidad_compra || '',
      factor_conversion: row.factor_conversion ?? 1,
    })
    setError('')
    setProdModal(true)
  }

  async function handleSaveProd() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')
    const payload = {
      nombre: form.nombre.trim(),
      codigo_interno: form.codigo_interno?.trim() || null,
      codigo_xubio: form.codigo_xubio?.trim() || null,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      unidad: form.unidad_entrega || form.unidad,
      unidad_entrega: form.unidad_entrega || null,
      unidad_compra: form.unidad_compra?.trim() || null,
      factor_conversion: parseFloat(form.factor_conversion) || 1,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      activo: form.activo,
      updated_at: new Date().toISOString(),
    }
    const { error } = form.id
      ? await supabase.from('productos').update(payload).eq('id', form.id)
      : await supabase.from('productos').insert(payload)
    if (error) { setError(error.message); setSaving(false); return }
    setProdModal(false)
    fetchAll()
    setSaving(false)
  }

  // ─── VARIANTES MODAL ─────────────────────────────────────────────────────
  async function openVariantes(prod) {
    setVarProd(prod)
    setVarModal(true)
    setVarLoading(true)
    const { data } = await supabase
      .from('producto_variantes')
      .select('*')
      .eq('producto_id', prod.id)
      .order('nombre')
    setVariantes(data ?? [])
    setVarLoading(false)
  }

  function openNewVar() { setVarForm({ ...emptyVar }); setVarError(''); setVarSubModal(true) }
  function openEditVar(v) { setVarForm({ ...v }); setVarError(''); setVarSubModal(true) }

  async function handleSaveVar() {
    setVarSaving(true); setVarError('')
    const payload = {
      producto_id: varProd.id,
      nombre: varForm.nombre?.trim() || null,
      marca: varForm.marca?.trim() || null,
      proveedor: varForm.proveedor?.trim() || null,
      codigo_barras: varForm.codigo_barras?.trim() || null,
      codigo_xubio: varForm.codigo_xubio?.trim() || null,
      codigo_interno: varForm.codigo_interno?.trim() || null,
      unidad_compra: varForm.unidad_compra?.trim() || null,
      cantidad_por_unidad_compra: parseFloat(varForm.cantidad_por_unidad_compra) || 1,
      activo: varForm.activo,
      updated_at: new Date().toISOString(),
    }
    const { error } = varForm.id
      ? await supabase.from('producto_variantes').update(payload).eq('id', varForm.id)
      : await supabase.from('producto_variantes').insert(payload)
    if (error) { setVarError(error.message); setVarSaving(false); return }
    setVarSubModal(false)
    // recargar lista variantes
    const { data } = await supabase
      .from('producto_variantes')
      .select('*')
      .eq('producto_id', varProd.id)
      .order('nombre')
    setVariantes(data ?? [])
    fetchAll()
    setVarSaving(false)
  }

  // ─── CATEGORÍAS ──────────────────────────────────────────────────────────
  function openNewCat() { setCatForm(emptyCat); setCatError(''); setCatModal(true) }
  function openEditCat(c) { setCatForm({ ...c }); setCatError(''); setCatModal(true) }

  async function handleSaveCat() {
    if (!catForm.nombre.trim()) { setCatError('El nombre es obligatorio'); return }
    setCatSaving(true); setCatError('')
    const payload = {
      nombre: catForm.nombre.trim(),
      descripcion: catForm.descripcion?.trim() || null,
    }
    const { error } = catForm.id
      ? await supabase.from('categorias_producto').update(payload).eq('id', catForm.id)
      : await supabase.from('categorias_producto').insert(payload)
    if (error) { setCatError(error.message); setCatSaving(false); return }
    setCatModal(false)
    fetchAll()
    setCatSaving(false)
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const catName = (id) => categorias.find(c => c.id === id)?.nombre || null

  const input = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Productos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {rows.filter(r => r.activo).length} activos · {rows.length} total
          </p>
        </div>
        {tab === 'productos' ? (
          <button onClick={openNewProd}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> Nuevo producto
          </button>
        ) : (
          <button onClick={openNewCat}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={16} /> Nueva categoría
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('productos')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'productos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Layers size={14} /> Productos
        </button>
        <button onClick={() => setTab('categorias')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'categorias' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          <Tag size={14} /> Categorías
          <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">{cats.length}</span>
        </button>
      </div>

      {/* ── TAB: PRODUCTOS ── */}
      {tab === 'productos' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o código..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="todas">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={String(c.id)}>{c.nombre}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No hay productos</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Producto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Código</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Categoría</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Stock</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">Variantes</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(row => {
                    const stock = stockMap[row.id] ?? null
                    const bajominimo = stock !== null && stock < row.stock_minimo
                    const nvar = variantesMap[row.id] || 0
                    const unidad = row.unidad_entrega || row.unidad
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{row.nombre}</div>
                          <div className="text-xs text-slate-400">{unidad}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden sm:table-cell font-mono text-xs">
                          {row.codigo_interno || row.codigo_xubio || '—'}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {catName(row.categoria_id)
                            ? <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{catName(row.categoria_id)}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          {stock === null ? (
                            <span className="text-slate-300 text-xs">Sin dato</span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {bajominimo && <AlertTriangle size={13} className="text-amber-500" />}
                              <span className={bajominimo ? 'text-amber-600 font-medium' : 'text-slate-700'}>
                                {stock} {unidad}
                              </span>
                            </div>
                          )}
                          {row.stock_minimo > 0 && (
                            <div className="text-xs text-slate-400">mín: {row.stock_minimo}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <button onClick={() => openVariantes(row)}
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 hover:underline">
                            {nvar > 0
                              ? <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">{nvar} var.</span>
                              : <span className="text-slate-400">+ var.</span>
                            }
                            <ChevronRight size={12} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEditProd(row)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CATEGORÍAS ── */}
      {tab === 'categorias' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100">
          {cats.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No hay categorías</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {cats.map(c => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{c.nombre}</div>
                    {c.descripcion && <div className="text-xs text-slate-400 mt-0.5">{c.descripcion}</div>}
                  </div>
                  <button onClick={() => openEditCat(c)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL PRODUCTO ── */}
      <Modal open={prodModal} onClose={() => setProdModal(false)} title={form.id ? 'Editar producto' : 'Nuevo producto'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={input} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código interno</label>
              <input value={form.codigo_interno ?? ''} onChange={e => setForm(f => ({ ...f, codigo_interno: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código Xubio</label>
              <input value={form.codigo_xubio ?? ''} onChange={e => setForm(f => ({ ...f, codigo_xubio: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
              <select value={form.categoria_id ?? ''} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                className={input + ' bg-white'}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unidad de entrega</label>
              <select value={form.unidad_entrega || form.unidad} onChange={e => setForm(f => ({ ...f, unidad_entrega: e.target.value, unidad: e.target.value }))}
                className={input + ' bg-white'}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unidad de compra</label>
              <input value={form.unidad_compra ?? ''} onChange={e => setForm(f => ({ ...f, unidad_compra: e.target.value }))}
                placeholder="ej: caja, fardo..." className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Factor conversión</label>
              <input type="number" min="1" step="1" value={form.factor_conversion}
                onChange={e => setForm(f => ({ ...f, factor_conversion: e.target.value }))} className={input} />
            </div>
          </div>

          {conversionPreview(form) && (
            <div className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-2 rounded-lg">
              {conversionPreview(form)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Stock mínimo</label>
              <input type="number" min="0" step="1" value={form.stock_minimo}
                onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} className={input} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-600" />
                <span className="text-sm text-slate-700">Activo</span>
              </label>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setProdModal(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
            <button onClick={handleSaveProd} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors">
              <Check size={15} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL VARIANTES (lista) ── */}
      <Modal open={varModal} onClose={() => setVarModal(false)}
        title={varProd ? `Variantes — ${varProd.nombre}` : 'Variantes'} size="lg">
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNewVar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors">
              <Plus size={14} /> Nueva variante
            </button>
          </div>

          {varLoading ? (
            <div className="py-6 text-center text-slate-400 text-sm">Cargando...</div>
          ) : variantes.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-sm">No hay variantes para este producto</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
              {variantes.map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <div>
                    <div className="font-medium text-slate-800 text-sm">
                      {v.marca || v.nombre || '—'}
                      {v.nombre && v.marca && <span className="text-slate-400 font-normal"> · {v.nombre}</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 space-x-2">
                      {v.proveedor && <span>{v.proveedor}</span>}
                      {v.unidad_compra && <span>{v.cantidad_por_unidad_compra} {v.unidad_compra}</span>}
                      {!v.activo && <span className="text-slate-300">· inactivo</span>}
                    </div>
                  </div>
                  <button onClick={() => openEditVar(v)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── SUB-MODAL VARIANTE (form) ── */}
      <Modal open={varSubModal} onClose={() => setVarSubModal(false)}
        title={varForm.id ? 'Editar variante' : 'Nueva variante'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Marca</label>
              <input value={varForm.marca ?? ''} onChange={e => setVarForm(f => ({ ...f, marca: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre / versión</label>
              <input value={varForm.nombre ?? ''} onChange={e => setVarForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="ej: 5L, fragancia limón..." className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Proveedor</label>
              <input value={varForm.proveedor ?? ''} onChange={e => setVarForm(f => ({ ...f, proveedor: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código de barras</label>
              <input value={varForm.codigo_barras ?? ''} onChange={e => setVarForm(f => ({ ...f, codigo_barras: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código Xubio</label>
              <input value={varForm.codigo_xubio ?? ''} onChange={e => setVarForm(f => ({ ...f, codigo_xubio: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Código interno</label>
              <input value={varForm.codigo_interno ?? ''} onChange={e => setVarForm(f => ({ ...f, codigo_interno: e.target.value }))} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Unidad de compra</label>
              <input value={varForm.unidad_compra ?? ''} onChange={e => setVarForm(f => ({ ...f, unidad_compra: e.target.value }))}
                placeholder="ej: caja, fardo..." className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad por unidad</label>
              <input type="number" min="1" step="1" value={varForm.cantidad_por_unidad_compra}
                onChange={e => setVarForm(f => ({ ...f, cantidad_por_unidad_compra: e.target.value }))} className={input} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" checked={varForm.activo} onChange={e => setVarForm(f => ({ ...f, activo: e.target.checked }))}
              className="w-4 h-4 accent-emerald-600" />
            <span className="text-sm text-slate-700">Activo</span>
          </div>

          {varError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{varError}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setVarSubModal(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
            <button onClick={handleSaveVar} disabled={varSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors">
              <Check size={15} />
              {varSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL CATEGORÍA ── */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={catForm.id ? 'Editar categoría' : 'Nueva categoría'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input value={catForm.nombre} onChange={e => setCatForm(f => ({ ...f, nombre: e.target.value }))} className={input} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
            <input value={catForm.descripcion ?? ''} onChange={e => setCatForm(f => ({ ...f, descripcion: e.target.value }))} className={input} />
          </div>

          {catError && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">{catError}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setCatModal(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
            <button onClick={handleSaveCat} disabled={catSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium rounded-lg transition-colors">
              <Check size={15} />
              {catSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
