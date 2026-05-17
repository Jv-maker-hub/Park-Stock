import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, Package, MapPin, Filter, Download } from 'lucide-react'

// ── helpers ─────────────────────────────────────────────────────────────
function fmtMes(dateStr) {
  if (!dateStr) return ''
  const [y, m] = dateStr.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${meses[parseInt(m)-1]} ${y}`
}

function exportCSV(rows, name) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = name + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── component ─────────────────────────────────────────────────────────────
export default function Analisis() {
  const [data, setData]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [meses, setMeses]           = useState([])
  const [lugares, setLugares]       = useState([])
  const [categorias, setCategorias] = useState([])
  const [productos, setProductos]   = useState([])

  // filtros
  const [mesDesde, setMesDesde]   = useState('')
  const [mesHasta, setMesHasta]   = useState('')
  const [lugarFil, setLugarFil]   = useState('')
  const [catFil,   setCatFil]     = useState('')
  const [prodFil,  setProdFil]    = useState('')
  const [vista,    setVista]      = useState('lugares')  // lugares | productos | tendencia

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: raw } = await supabase
      .from('v_consumo_mensual')
      .select('*')
      .order('mes', { ascending: true })
    setData(raw ?? [])

    // build filter options
    const ms   = [...new Set((raw ?? []).map(r => r.mes))].sort()
    const ls   = [...new Map((raw ?? []).map(r => [r.lugar_id, r.lugar])).entries()].map(([id,n]) => ({ id, nombre: n }))
    const cs   = [...new Set((raw ?? []).map(r => r.categoria).filter(Boolean))].sort()
    const ps   = [...new Map((raw ?? []).map(r => [r.producto_id, r.producto])).entries()].map(([id,n]) => ({ id, nombre: n }))
    setMeses(ms)
    setLugares(ls)
    setCategorias(cs)
    setProductos(ps)
    if (ms.length) { setMesDesde(ms[0]); setMesHasta(ms[ms.length-1]) }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return data.filter(r =>
      (!mesDesde || r.mes >= mesDesde) &&
      (!mesHasta || r.mes <= mesHasta) &&
      (!lugarFil || String(r.lugar_id) === lugarFil) &&
      (!catFil   || r.categoria === catFil) &&
      (!prodFil  || String(r.producto_id) === prodFil)
    )
  }, [data, mesDesde, mesHasta, lugarFil, catFil, prodFil])

  // ── aggregations ──────────────────────────────────────────────────────
  const byLugar = useMemo(() => {
    const map = {}
    for (const r of filtered) {
      if (!map[r.lugar_id]) map[r.lugar_id] = { lugar: r.lugar, total: 0, productos: new Set() }
      map[r.lugar_id].total      += parseFloat(r.cantidad_mensual) || 0
      map[r.lugar_id].productos.add(r.producto_id)
    }
    return Object.values(map)
      .map(v => ({ ...v, productos: v.productos.size }))
      .sort((a,b) => b.total - a.total)
  }, [filtered])

  const byProducto = useMemo(() => {
    const map = {}
    for (const r of filtered) {
      if (!map[r.producto_id]) map[r.producto_id] = { producto: r.producto, unidad: r.unidad_entrega, total: 0, lugares: new Set() }
      map[r.producto_id].total  += parseFloat(r.cantidad_mensual) || 0
      map[r.producto_id].lugares.add(r.lugar_id)
    }
    return Object.values(map)
      .map(v => ({ ...v, lugares: v.lugares.size }))
      .sort((a,b) => b.total - a.total)
  }, [filtered])

  const byMes = useMemo(() => {
    const map = {}
    for (const r of filtered) {
      if (!map[r.mes]) map[r.mes] = { mes: fmtMes(r.mes), raw_mes: r.mes, total: 0, lugares: new Set(), productos: new Set() }
      map[r.mes].total    += parseFloat(r.cantidad_mensual) || 0
      map[r.mes].lugares.add(r.lugar_id)
      map[r.mes].productos.add(r.producto_id)
    }
    return Object.values(map)
      .map(v => ({ ...v, lugares: v.lugares.size, productos: v.productos.size }))
      .sort((a,b) => a.raw_mes.localeCompare(b.raw_mes))
  }, [filtered])

  const totalEntregas = filtered.reduce((s,r) => s + (parseFloat(r.cantidad_mensual)||0), 0)
  const totalLugares  = new Set(filtered.map(r => r.lugar_id)).size
  const totalProds    = new Set(filtered.map(r => r.producto_id)).size

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Análisis de Entregas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Consumo histórico por lugar y producto</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Filtros</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Desde</label>
            <select value={mesDesde} onChange={e => setMesDesde(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Todo</option>
              {meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hasta</label>
            <select value={mesHasta} onChange={e => setMesHasta(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Todo</option>
              {meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Lugar</label>
            <select value={lugarFil} onChange={e => setLugarFil(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Todos</option>
              {lugares.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Categoría</label>
            <select value={catFil} onChange={e => setCatFil(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Todas</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Producto</label>
            <select value={prodFil} onChange={e => setProdFil(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Todos</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Total entregas', value: totalEntregas.toLocaleString('es-AR', { maximumFractionDigits: 1 }), icon: Package, color: 'text-emerald-600' },
          { label: 'Lugares activos', value: totalLugares, icon: MapPin, color: 'text-blue-600' },
          { label: 'Productos', value: totalProds, icon: TrendingUp, color: 'text-violet-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-sm">Cargando datos...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-sm">No hay datos para los filtros seleccionados</div>
      ) : (
        <>
          {/* Vista tabs */}
          <div className="flex gap-2 mb-4">
            {[['lugares','Por Lugar'],['productos','Por Producto'],['tendencia','Tendencia']].map(([v,l]) => (
              <button key={v} onClick={() => setVista(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${vista===v ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── Vista por Lugar ── */}
          {vista === 'lugares' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">Top lugares por cantidad total</span>
                <button onClick={() => exportCSV(byLugar.map(r => ({ lugar: r.lugar, total: r.total, productos: r.productos })), 'analisis_lugares')}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                  <Download size={12}/> CSV
                </button>
              </div>
              <div className="p-4 h-64 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byLugar.slice(0,15)} layout="vertical" margin={{ left: 140, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="lugar" tick={{ fontSize: 10 }} width={135} />
                    <Tooltip formatter={(v) => [v.toFixed(1), 'Cantidad']} />
                    <Bar dataKey="total" fill="#10b981" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-t border-slate-100">
                    <th className="text-left px-4 py-2 text-slate-500">#</th>
                    <th className="text-left px-4 py-2 text-slate-500">Lugar</th>
                    <th className="text-right px-4 py-2 text-slate-500">Total</th>
                    <th className="text-right px-4 py-2 text-slate-500">Productos</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {byLugar.map((r,i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400">{i+1}</td>
                        <td className="px-4 py-2 text-slate-700 font-medium">{r.lugar}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-700">{r.total.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{r.productos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Vista por Producto ── */}
          {vista === 'productos' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">Productos más entregados</span>
                <button onClick={() => exportCSV(byProducto.map(r => ({ producto: r.producto, unidad: r.unidad, total: r.total, lugares: r.lugares })), 'analisis_productos')}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                  <Download size={12}/> CSV
                </button>
              </div>
              <div className="p-4 h-64 mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byProducto.slice(0,15)} layout="vertical" margin={{ left: 160, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="producto" tick={{ fontSize: 10 }} width={155} />
                    <Tooltip formatter={(v) => [v.toFixed(1), 'Cantidad']} />
                    <Bar dataKey="total" fill="#6366f1" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-t border-slate-100">
                    <th className="text-left px-4 py-2 text-slate-500">#</th>
                    <th className="text-left px-4 py-2 text-slate-500">Producto</th>
                    <th className="text-left px-4 py-2 text-slate-500">Unidad</th>
                    <th className="text-right px-4 py-2 text-slate-500">Total</th>
                    <th className="text-right px-4 py-2 text-slate-500">Lugares</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {byProducto.map((r,i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-400">{i+1}</td>
                        <td className="px-4 py-2 text-slate-700 font-medium">{r.producto}</td>
                        <td className="px-4 py-2 text-slate-400">{r.unidad ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-700">{r.total.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{r.lugares}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Vista Tendencia ── */}
          {vista === 'tendencia' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">Evolución mensual</span>
                <button onClick={() => exportCSV(byMes.map(r => ({ mes: r.mes, total: r.total, lugares: r.lugares, productos: r.productos })), 'analisis_tendencia')}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                  <Download size={12}/> CSV
                </button>
              </div>
              <div className="p-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMes} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Total entregas" fill="#10b981" radius={[3,3,0,0]} />
                    <Bar dataKey="lugares" name="Lugares" fill="#6366f1" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-t border-slate-100">
                    <th className="text-left px-4 py-2 text-slate-500">Mes</th>
                    <th className="text-right px-4 py-2 text-slate-500">Total</th>
                    <th className="text-right px-4 py-2 text-slate-500">Lugares</th>
                    <th className="text-right px-4 py-2 text-slate-500">Productos</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {byMes.map((r,i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700 font-medium">{r.mes}</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-700">{r.total.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{r.lugares}</td>
                        <td className="px-4 py-2 text-right text-slate-400">{r.productos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
