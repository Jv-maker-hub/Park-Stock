# Xubio Proxy Worker

Cloudflare Worker que actúa como proxy seguro para la API de Xubio.
Guarda las credenciales como secrets (nunca en el browser).

## Setup

```bash
# 1. Instalar Wrangler
npm install -g wrangler

# 2. Login
wrangler login

# 3. Crear KV namespace
wrangler kv:namespace create "XUBIO_CACHE"
# → Copiar el ID generado y pegarlo en wrangler.toml

# 4. Configurar secrets
wrangler secret put XUBIO_CLIENT_ID
wrangler secret put XUBIO_CLIENT_SECRET

# 5. Deploy
wrangler deploy
```

## Variables de entorno en Vite

En `.env.local` del proyecto Park Stock:
```
VITE_XUBIO_WORKER_URL=https://xubio-proxy.TU_SUBDOMINIO.workers.dev
```

## Endpoints disponibles

- `GET /api/xubio/proveedores` — lista de proveedores extraídos de OCs
- `GET /api/xubio/ordenes` — todas las OCs de Xubio
- `GET /api/xubio/ordenes/:id` — detalle de una OC
- `POST /api/xubio/ordenes` — crear OC en Xubio
- `GET /api/xubio/productos` — productos (puede no estar disponible según el plan)

## Notas de seguridad

⚠️ **Importante**: Las credenciales de Xubio estuvieron expuestas en el chat.
Regeneralas en Xubio → Configuración → Integraciones → API antes de hacer deploy.
