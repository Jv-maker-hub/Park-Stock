/**
 * Cloudflare Worker — Xubio API Proxy
 *
 * Secrets requeridos (wrangler secret put):
 *   XUBIO_CLIENT_ID
 *   XUBIO_CLIENT_SECRET
 *
 * KV Namespace requerida (wrangler kv:namespace create "XUBIO_CACHE"):
 *   binding: XUBIO_CACHE
 *
 * Rutas disponibles:
 *   GET  /api/xubio/proveedores        — lista de proveedores de OCs existentes
 *   GET  /api/xubio/ordenes            — lista de OCs (filtros: estado, limite)
 *   GET  /api/xubio/ordenes/:id        — detalle de una OC
 *   POST /api/xubio/ordenes            — crear OC en Xubio
 *   GET  /api/xubio/productos          — lista de productos (puede fallar si el plan no incluye)
 *
 * CORS: solo acepta requests de stockps.metodojv.com.ar y localhost:5173
 */

const XUBIO_BASE = 'https://xubio.com/API/1.1'
const TOKEN_KEY  = 'xubio_token'

const ALLOWED_ORIGINS = [
  'https://stockps.metodojv.com.ar',
  'http://localhost:5173',
  'http://localhost:4173',
]

// ─── Token management ────────────────────────────────────────────────────────

async function getToken(env) {
  // Try KV cache first
  const cached = await env.XUBIO_CACHE.get(TOKEN_KEY, 'json')
  if (cached && cached.expires_at > Date.now()) {
    return cached.access_token
  }

  // Fetch new token
  const res = await fetch(`${XUBIO_BASE}/TokenEndpoint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     env.XUBIO_CLIENT_ID,
      client_secret: env.XUBIO_CLIENT_SECRET,
    }),
  })

  if (!res.ok) {
    throw new Error(`Xubio token error: ${res.status}`)
  }

  const data = await res.json()
  const token = data.access_token
  const expiresIn = (data.expires_in || 3600) - 60 // 1 min buffer

  await env.XUBIO_CACHE.put(TOKEN_KEY, JSON.stringify({
    access_token: token,
    expires_at: Date.now() + expiresIn * 1000,
  }), { expirationTtl: expiresIn })

  return token
}

// ─── Xubio API helpers ────────────────────────────────────────────────────────

async function xubioGet(env, path) {
  const token = await getToken(env)
  const res = await fetch(`${XUBIO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Xubio GET ${path} → ${res.status}`)
  return res.json()
}

async function xubioPost(env, path, body) {
  const token = await getToken(env)
  const res = await fetch(`${XUBIO_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Xubio POST ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── CORS helpers ─────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  })
}

function errorResponse(msg, status = 500, origin = '') {
  return jsonResponse({ error: msg }, status, origin)
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleProveedores(env) {
  // Xubio no tiene endpoint de proveedores accesible en plan básico.
  // Extraemos proveedores únicos de las OCs existentes.
  const data = await xubioGet(env, '/ordenCompraBean')
  const ocs = Array.isArray(data) ? data : (data.items || data.data || [])

  const map = new Map()
  for (const oc of ocs) {
    const p = oc.proveedor
    if (p && !map.has(p.ID)) {
      map.set(p.ID, { xubio_id: p.ID, nombre: p.nombre })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

async function handleOrdenes(env, url) {
  const data = await xubioGet(env, '/ordenCompraBean')
  let ocs = Array.isArray(data) ? data : (data.items || data.data || [])

  // Filtro opcional por estado
  const estado = url.searchParams.get('estado')
  if (estado) {
    ocs = ocs.filter(oc => oc.estado?.codigo?.toLowerCase() === estado.toLowerCase())
  }

  // Normalizar estructura
  return ocs.map(oc => ({
    xubio_id:         oc.transaccionid,
    numero:           oc.numeroDocumento,
    fecha:            oc.fecha,
    proveedor_id:     oc.proveedor?.ID,
    proveedor_nombre: oc.proveedor?.nombre,
    estado:           oc.estado?.codigo,
    items: (oc.transaccionProductoItems || []).map(item => ({
      xubio_producto_id: item.producto?.ID,
      nombre:            item.producto?.nombre,
      cantidad:          item.cantidad,
      precio:            item.precio,
      deposito:          item.deposito?.nombre,
    })),
  }))
}

async function handleOrdenDetalle(env, id) {
  const data = await xubioGet(env, `/ordenCompraBean/${id}`)
  const oc = Array.isArray(data) ? data[0] : data
  return {
    xubio_id:         oc.transaccionid,
    numero:           oc.numeroDocumento,
    fecha:            oc.fecha,
    proveedor_id:     oc.proveedor?.ID,
    proveedor_nombre: oc.proveedor?.nombre,
    estado:           oc.estado?.codigo,
    items: (oc.transaccionProductoItems || []).map(item => ({
      xubio_producto_id: item.producto?.ID,
      nombre:            item.producto?.nombre,
      cantidad:          item.cantidad,
      precio:            item.precio,
    })),
  }
}

async function handleCrearOrden(env, body) {
  /**
   * body esperado desde Park Stock:
   * {
   *   proveedor_xubio_id: number,
   *   fecha: "YYYY-MM-DD",
   *   items: [{ xubio_producto_id, nombre, cantidad, precio }]
   * }
   */
  const payload = {
    proveedor: { ID: body.proveedor_xubio_id },
    fecha: body.fecha,
    transaccionProductoItems: body.items.map(i => ({
      producto: { ID: i.xubio_producto_id },
      cantidad: i.cantidad,
      precio:   i.precio || 0,
    })),
  }
  return xubioPost(env, '/ordenCompraBean', payload)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const url    = new URL(request.url)
    const path   = url.pathname

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // Solo acepta /api/xubio/*
    if (!path.startsWith('/api/xubio')) {
      return errorResponse('Not found', 404, origin)
    }

    try {
      const segment = path.replace('/api/xubio', '').replace(/^\//, '')

      // GET /api/xubio/proveedores
      if (request.method === 'GET' && segment === 'proveedores') {
        const data = await handleProveedores(env)
        return jsonResponse(data, 200, origin)
      }

      // GET /api/xubio/ordenes
      if (request.method === 'GET' && segment === 'ordenes') {
        const data = await handleOrdenes(env, url)
        return jsonResponse(data, 200, origin)
      }

      // GET /api/xubio/ordenes/:id
      if (request.method === 'GET' && segment.startsWith('ordenes/')) {
        const id = segment.split('/')[1]
        const data = await handleOrdenDetalle(env, id)
        return jsonResponse(data, 200, origin)
      }

      // POST /api/xubio/ordenes
      if (request.method === 'POST' && segment === 'ordenes') {
        const body = await request.json()
        const data = await handleCrearOrden(env, body)
        return jsonResponse(data, 201, origin)
      }

      // GET /api/xubio/productos (puede fallar según el plan)
      if (request.method === 'GET' && segment === 'productos') {
        try {
          const data = await xubioGet(env, '/productoBean')
          return jsonResponse(data, 200, origin)
        } catch {
          return errorResponse('Productos endpoint no disponible en este plan de Xubio', 503, origin)
        }
      }

      return errorResponse('Ruta no encontrada', 404, origin)

    } catch (err) {
      console.error('Worker error:', err)
      return errorResponse(err.message || 'Error interno', 500, origin)
    }
  },
}
