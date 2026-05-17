# Park Stock — Design Brief

## ¿Qué es?
Aplicación web interna para gestionar la distribución de materiales de limpieza en 143 instalaciones municipales del partido de Tigre, Buenos Aires. La usa el equipo de Park Service (empresa de limpieza).

## Stack
- React 18 + Vite
- Tailwind CSS (sin componentes externos, todo custom)
- Supabase (auth + base de datos)
- lucide-react para íconos
- recharts para gráficos

## Usuarios
- **Admin**: acceso total
- **Supervisor**: ve lugares, análisis, planilla modelo
- **Preparador**: ve pedidos
- **Repartidor**: ve rutas

---

## Paleta actual
- Primario: `emerald-600` (#059669) — botones, nav activa, acentos
- Fondo app: `slate-100`
- Cards/panels: `white` con `border-slate-100` y `shadow-sm`
- Sidebar: `slate-800`
- Texto principal: `slate-800`
- Texto secundario: `slate-500`
- Peligro: `red-600`
- Advertencia: `amber-500`

---

## Estructura de la app

### Layout
- Sidebar fijo izquierda (w-60, bg-slate-800) con nav links
- Header top con hamburger en mobile
- Main content con padding p-4/p-6

### Páginas existentes
| Ruta | Descripción | Estado |
|------|-------------|--------|
| `/` | Dashboard con KPIs | Básico, mejorable |
| `/lugares` | ABM de 143 instalaciones | Funcional |
| `/productos` | ABM productos + variantes + categorías | Dos solapas |
| `/importar` | Importar lugares/productos/planillas Excel | 3 solapas |
| `/analisis` | Dashboard consumos con gráficos | Funcional |
| `/supervisores` | ABM supervisores | Simple |
| `/clientes` | ABM clientes | Simple |
| `/modelo` | Planilla modelo (próximamente) | Placeholder |
| `/pedidos` | Pedidos (próximamente) | Placeholder |
| `/rutas` | Rutas (próximamente) | Placeholder |

### Componentes compartidos
- `Modal.jsx` — modal genérico con overlay
- `Sidebar.jsx` — navegación lateral
- `Header.jsx` — barra superior
- `Layout.jsx` — wrapper principal

---

## Problemas de diseño actuales
1. **Dashboard vacío** — solo muestra contadores, no tiene visualización útil ni acciones rápidas
2. **Tablas muy densas** — poca respiración visual, difícil escanear
3. **Formularios largos** — los modales en Lugares tienen muchos campos apilados
4. **Sin estados vacíos** — cuando no hay datos las páginas se ven cortadas
5. **Sin feedback visual** — carga, éxito, error podrían ser más expresivos
6. **Mobile no probado** — sidebar colapsable existe pero el contenido no está optimizado
7. **Tipografía plana** — no hay jerarquía visual clara entre secciones
8. **Análisis básico** — los gráficos de recharts son sin personalizar

---

## Lo que queremos mejorar (prioridad)

### 1. Dashboard
- Cards de KPIs más visuales (con íconos grandes, mini-chart, tendencia)
- Acciones rápidas: "Importar planilla", "Ver lugares sin mapear"
- Últimas actividades / entregas recientes
- Alertas: lugares sin supervisor, productos con stock bajo

### 2. Tablas
- Mejor hover, más espacio entre filas
- Columnas con sorting visual
- Paginación o scroll virtual para 143+ lugares
- Filtros visibles (chips/tags seleccionables)

### 3. Formularios/Modales
- Secciones con separadores claros
- Mejor validación inline (borde rojo + mensaje debajo del campo)
- Progress steps para flujos de varios pasos (como Importar)

### 4. Estados vacíos
- Ilustración o ícono grande + mensaje + CTA
- Ej: "No hay lugares cargados aún → Importar desde Excel"

### 5. Sidebar
- Grupos colapsables
- Badge con cantidad (ej: "Lugares 143")
- Indicador de qué módulos están en construcción

---

## Contexto de negocio
- Sistema PUSH: la empresa decide qué llevar a cada lugar (no hay pedidos de los lugares)
- Precio fijo por contrato municipal → objetivo es minimizar costos de distribución
- Patri (administrativa) carga las planillas Excel mensuales
- Los repartidores necesitan ver rutas optimizadas

---

## Pedido concreto
Mejorar el diseño visual manteniendo:
- Tailwind CSS únicamente (sin instalar nuevas libs de UI)
- La misma paleta emerald/slate
- Compatibilidad con el código React existente
- Sidebar de 60px de ancho fijo en desktop

Podés proponer mejoras por página o componente, arrancando por lo que más impacto visual tiene.
