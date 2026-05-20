# 🎓 JUNIOR.md — Guía de prácticas de programación

Esta guía explica las buenas prácticas y patrones de programación utilizados en este proyecto. Está pensada para desarrolladores junior que quieran entender **por qué** el código está escrito así y **qué pueden aprender** de cada decisión.

---

## 📁 1. Estructura de carpetas con Route Groups

```
app/
├── (auth)/           ← Route Group: páginas SIN autenticación
│   └── login/
├── (app)/            ← Route Group: páginas CON autenticación
│   ├── dashboard/
│   ├── grupos/
│   ├── playoffs/
│   └── bota-de-oro/
├── api/              ← API Routes (servidor)
└── auth/
    └── callback/     ← Callback de OAuth
```

### ¿Qué son los Route Groups?

Los paréntesis `(auth)` y `(app)` son **Route Groups** de Next.js. **No aparecen en la URL** (no es `/auth/login`, solo `/login`), pero nos permiten:

- **Agrupar páginas lógicamente** — las de autenticación separadas de las protegidas.
- **Compartir layouts diferentes** — `(app)/layout.tsx` tiene sidebar y navbar, pero `(auth)` no.
- **Aplicar middleware selectivamente** — todo lo que esté dentro de `(app)` requiere sesión activa.

> 💡 **Para juniors:** Los Route Groups son como "carpetas organizativas" que solo tú ves como desarrollador. El usuario nunca ve esos paréntesis en la URL del navegador.

---

## 🧩 2. Server Components vs Client Components

Este es uno de los conceptos **más importantes** de Next.js moderno.

### Server Components (por defecto)

```tsx
// app/(app)/grupos/page.tsx — NO tiene 'use client'
export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: matches } = await supabase.from('matches').select('*')

  return <GroupsClient initialMatches={matches} />
}
```

**¿Qué hacen?**
- Se ejecutan **en el servidor** (nunca en el navegador del usuario).
- Pueden hacer llamadas directas a la base de datos sin exponer credenciales.
- Son más rápidos porque envían HTML ya renderizado al navegador.

### Client Components

```tsx
// app/(app)/grupos/groups-client.tsx
'use client'  // ← Esta línea es OBLIGATORIA

export default function GroupsClient({ initialMatches }) {
  const [selectedGroup, setSelectedGroup] = useState('A')
  // ... interactividad, clicks, formularios...
}
```

**¿Cuándo usar `'use client'`?**
- Cuando necesitas **`useState`**, **`useEffect`** o cualquier hook de React.
- Cuando hay **interactividad** (clicks, formularios, animaciones).
- Cuando usas librerías del navegador (Framer Motion, etc.).

### El patrón Server → Client

```
┌─────────────────────────────────────────────────┐
│         SERVER COMPONENT (page.tsx)              │
│                                                  │
│  1. Obtiene datos de Supabase (seguro)          │
│  2. Pasa datos como props al Client Component   │
│                                                  │
│  return <GroupsClient initialMatches={data} />   │
└──────────────────────┬──────────────────────────┘
                       │ props
                       ▼
┌─────────────────────────────────────────────────┐
│        CLIENT COMPONENT (groups-client.tsx)       │
│                                                  │
│  1. Recibe datos iniciales por props            │
│  2. Maneja interactividad (useState, onClick)   │
│  3. Hace fetch al API para guardar cambios      │
└─────────────────────────────────────────────────┘
```

> 💡 **Para juniors:** Piensa en los Server Components como el "chef de cocina" que prepara los ingredientes (datos). Los Client Components son los "camareros" que los sirven al usuario e interactúan con él.

---

## 🔐 3. Autenticación con OAuth

### ¿Qué es OAuth?

En vez de inventar nuestro propio sistema de contraseñas (inseguro y complejo), dejamos que Google o GitHub se encarguen de verificar la identidad del usuario. Nosotros solo recibimos un token de confirmación.

### Flujo paso a paso

```
1. Usuario pulsa "Acceder con Google"
        │
        ▼
2. Se abre la página de Google para iniciar sesión
        │
        ▼
3. Google confirma y redirige a /auth/callback?code=abc123
        │
        ▼
4. Nuestro callback intercambia el código temporal por una sesión
   → supabase.auth.exchangeCodeForSession(code)
        │
        ▼
5. Redirigimos a /dashboard con el usuario ya autenticado
```

### Middleware: el guardia de seguridad

```tsx
// middleware.ts
const { data: { user } } = await supabase.auth.getUser()

if (!user && !isAuthPage) {
  // 🚫 No tienes sesión → te mando al login
  return NextResponse.redirect('/login')
}

if (user && isAuthPage) {
  // ✅ Ya tienes sesión → no necesitas ver el login
  return NextResponse.redirect('/dashboard')
}
```

> 💡 **Para juniors:** El middleware se ejecuta **antes** de que la página cargue. Es como el portero de un club: si no estás en la lista, no entras.

---

## ✨ 4. Optimistic Updates (Actualizaciones Optimistas)

Este es un patrón avanzado que mejora **muchísimo** la experiencia del usuario.

### Problema sin Optimistic Updates

```
1. Click en "1"
2. Spinner cargando... (200-500ms)
3. El botón finalmente se marca
```

### Con Optimistic Updates

```
1. Click en "1"
2. El botón se marca INMEDIATAMENTE ← mucho mejor UX
3. En segundo plano: se envía al servidor
4. Si falla → se revierte al estado anterior
```

### Código real del proyecto

```tsx
const handlePredict = async (matchId: string, choice: MatchResult) => {
  // 1. Guardar el estado anterior (por si hay que revertir)
  const previousPrediction = predictions[matchId]

  // 2. Actualización optimista: cambiar la UI inmediatamente
  setPredictions(prev => ({ ...prev, [matchId]: choice }))

  try {
    // 3. Enviar al servidor
    const res = await fetch('/api/predictions', { ... })
    if (!res.ok) throw new Error('Fallo')
  } catch (err) {
    // 4. Si falla, REVERTIR al estado anterior
    setPredictions(prev => ({ ...prev, [matchId]: previousPrediction }))
    setErrorMessage('Error guardando predicción')
  }
}
```

> 💡 **Para juniors:** Es como cuando envías un mensaje de WhatsApp. Aparece con un ✓ inmediatamente (optimista), y si falla la conexión, aparece un icono de error. No te quedas esperando a que el servidor confirme para ver tu propio mensaje.

---

## 🎨 5. Sistema de diseño con CSS custom

### Glassmorphism (efecto cristal)

```css
.glass-panel {
  background: rgba(15, 23, 42, 0.45);        /* Fondo semitransparente */
  backdrop-filter: blur(12px);                /* Desenfoque del fondo */
  border: 1px solid rgba(255, 255, 255, 0.06); /* Borde sutil */
}
```

Esto crea un efecto de "panel de cristal" moderno que deja entrever el fondo difuminado.

### Jerarquía tipográfica

```
Bebas Neue  → Títulos grandes, marcadores, badges deportivos
Oswald      → Nombres de equipos, etiquetas, botones
Inter       → Texto de cuerpo, datos, párrafos legibles
```

Cada fuente tiene un rol claro. Esto crea jerarquía visual sin esfuerzo:

```tsx
<h1 className="font-bebas">PORRA MUNDIAL 2026</h1>     {/* Grande, impactante */}
<span className="font-oswald">ESPAÑA VS FRANCIA</span>   {/* Deportivo, serio */}
<p className="font-sans">Elige tu predicción...</p>      {/* Legible, neutro */}
```

### Clases condicionales con `clsx`

En vez de concatenar strings de clases manualmente (propenso a errores):

```tsx
// ❌ Malo
className={`btn ${isActive ? 'bg-green-500' : ''} ${isDisabled ? 'opacity-50' : ''}`}

// ✅ Bueno — usa clsx
className={clsx(
  'btn',
  isActive && 'bg-green-500',
  isDisabled && 'opacity-50'
)}
```

`clsx` ignora valores `false`, `null` y `undefined` automáticamente.

---

## 🏗️ 6. API Routes como capa intermedia

### ¿Por qué no llamar a Supabase directamente desde el cliente?

```
❌  Browser → Supabase (expones lógica de negocio al cliente)
✅  Browser → API Route → Supabase (validación en servidor)
```

### Ejemplo: guardar una predicción

```tsx
// app/api/predictions/route.ts
export async function POST(req: NextRequest) {
  // 1. Verificar que el usuario está autenticado
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // 2. Verificar que el partido no ha empezado (seguridad del servidor)
  const kickoff = new Date(match.kickoff_at)
  if (kickoff <= new Date()) {
    return NextResponse.json({ error: 'Predicciones cerradas' }, { status: 400 })
  }

  // 3. Solo si todo es válido, guardamos en la base de datos
  await supabase.from('predictions').upsert({ ... })
}
```

> 💡 **Para juniors:** El frontend puede ser manipulado (DevTools, etc.). **NUNCA confíes solo en la validación del cliente**. La API Route es el "juez final" que valida todo antes de tocar la base de datos.

---

## 🔄 7. Supabase Realtime (actualizaciones en vivo)

### ¿Qué es?

Supabase Realtime permite que tu app **escuche cambios en la base de datos** sin refrescar la página. Cuando alguien acierta una predicción y sus puntos cambian, **todos** los usuarios ven el leaderboard actualizado al instante.

### Cómo funciona en nuestro proyecto

```tsx
// leaderboard-client.tsx
useEffect(() => {
  // Suscribirse a cambios en la tabla "scores"
  const channel = supabase
    .channel('scores-changes')
    .on('postgres_changes', {
      event: '*',               // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'scores',
    }, () => {
      // Cuando la tabla cambia → refrescar datos del servidor
      router.refresh()
    })
    .subscribe()

  // Limpiar suscripción cuando el componente se desmonte
  return () => { supabase.removeChannel(channel) }
}, [])
```

### Flujo visual

```
1. Un partido termina (API-Football reporta resultado FT)
        │
        ▼
2. Cron sync actualiza la tabla "matches" en Supabase
        │
        ▼
3. Trigger de Postgres calcula puntos → actualiza tabla "scores"
        │
        ▼
4. Supabase Realtime detecta el cambio en "scores"
        │
        ▼
5. Todos los navegadores conectados reciben el evento
        │
        ▼
6. router.refresh() recarga los datos del servidor (sin recargar la página entera)
```

> 💡 **Para juniors:** Es como un grupo de WhatsApp. No necesitas refrescar la app para ver mensajes nuevos: te llegan solos. Realtime hace lo mismo con datos de la base de datos.

---

## 🧹 8. Limpieza de useEffect (cleanup)

Cada vez que usas `useEffect` para crear suscripciones, timers o listeners, **debes limpiarlos** cuando el componente se desmonte. Si no lo haces, creates memory leaks (fugas de memoria).

```tsx
// ✅ Correcto — con cleanup
useEffect(() => {
  const timer = setInterval(doSomething, 1000)
  return () => clearInterval(timer)  // ← Esto se ejecuta al desmontar
}, [])

// ❌ Incorrecto — sin cleanup (memory leak)
useEffect(() => {
  setInterval(doSomething, 1000)  // Nunca se limpia
}, [])
```

En nuestro proyecto, lo usamos para:
- **Suscripciones Realtime** → `supabase.removeChannel(channel)`
- **Countdown timers** (Bota de Oro) → `clearInterval(timer)`

---

## 🛡️ 9. TypeScript: tipos estrictos

### ¿Por qué usar TypeScript?

```tsx
// Sin TypeScript: el error aparece cuando el usuario usa la app 💥
function calculatePoints(prediction, result) {
  return prediction === result ? 3 : 0  // ¿Y si prediction es undefined?
}

// Con TypeScript: el error aparece mientras programas ✅
function calculatePoints(prediction: MatchResult, result: MatchResult): number {
  return prediction === result ? 3 : 0  // TypeScript garantiza los tipos
}
```

### Tipos reutilizables

```tsx
// lib/supabase/types.ts — generados desde el schema de la base de datos
export type MatchResult = '1' | 'X' | '2'        // Solo estos 3 valores posibles
export type TournamentPhase = 'group' | 'round_of_16' | ...  // Todas las fases
export type MatchStatus = 'NS' | 'FT' | ...       // Todos los estados posibles
```

> 💡 **Para juniors:** TypeScript es como un corrector ortográfico para tu código. Te avisa de errores **antes** de ejecutar la app, no después.

---

## 📦 10. Variables de entorno

### Regla de oro

```
NEXT_PUBLIC_*  → Visible en el navegador (solo datos públicos/no sensibles)
Sin prefijo    → Solo accesible desde el servidor (claves secretas)
```

### Ejemplo

```env
# ✅ Seguro: la URL del proyecto es pública
NEXT_PUBLIC_SUPABASE_URL=https://miproyecto.supabase.co

# ✅ Seguro: la anon key tiene permisos limitados por RLS
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 🔒 NUNCA exponer al navegador:
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Acceso total a la DB
API_FOOTBALL_KEY=abc123             # Clave de API de pago
CRON_SECRET=xyz789                  # Token de seguridad
```

> 💡 **Para juniors:** Si una variable empieza con `NEXT_PUBLIC_`, asume que **cualquiera** puede verla abriendo DevTools en el navegador. Nunca pongas secretos ahí.

---

## 🧪 11. Patrón Upsert

Un "upsert" es una operación que combina INSERT y UPDATE:

```sql
-- Si no existe la predicción → la crea (INSERT)
-- Si ya existe → la actualiza (UPDATE)
INSERT INTO predictions (user_id, match_id, prediction)
VALUES ('user-1', 'match-1', '1')
ON CONFLICT (user_id, match_id)
DO UPDATE SET prediction = '1';
```

En código:

```tsx
await supabase.from('predictions').upsert({
  user_id: user.id,
  match_id: matchId,
  prediction: choice,
}, { onConflict: 'user_id,match_id' })
```

> 💡 **Para juniors:** En vez de comprobar "¿existe?" → "entonces update" / "si no → insert", con un upsert lo haces todo en una sola operación, más limpia y sin condiciones de carrera.

---

## 🎬 12. Animaciones con Framer Motion

### Animación de entrada

```tsx
<motion.div
  initial={{ opacity: 0, y: 30 }}    // Estado inicial: invisible y 30px abajo
  animate={{ opacity: 1, y: 0 }}     // Estado final: visible y en su posición
  transition={{ duration: 0.8 }}      // Duración: 0.8 segundos
>
  Contenido que aparece suavemente
</motion.div>
```

### AnimatePresence para elementos que aparecen/desaparecen

```tsx
<AnimatePresence>
  {showModal && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}    // ← Animación al DESAPARECER
    >
      Contenido del modal
    </motion.div>
  )}
</AnimatePresence>
```

> 💡 **Para juniors:** Sin `AnimatePresence`, los elementos simplemente desaparecen de golpe. Con él, puedes animar la salida, creando una experiencia mucho más profesional.

---

## 📐 13. Responsive Design con Tailwind

Tailwind usa un sistema **mobile-first**: primero diseñas para móvil, luego añades cambios para pantallas más grandes.

```tsx
<div className="
  grid
  grid-cols-1          // Móvil: 1 columna
  lg:grid-cols-3       // Desktop (≥1024px): 3 columnas
  gap-8
">
```

Los prefijos de tamaño:
```
sm:   ≥640px    (teléfonos grandes)
md:   ≥768px    (tablets)
lg:   ≥1024px   (portátiles)
xl:   ≥1280px   (monitores)
2xl:  ≥1536px   (monitores grandes)
```

> 💡 **Para juniors:** Siempre empieza diseñando cómo se ve en móvil. Si se ve bien en una pantalla pequeña, en una grande casi seguro que también.

---

## 🏆 Resumen de buenas prácticas

| Práctica | ¿Por qué? |
|----------|-----------|
| Server Components por defecto | Seguridad, rendimiento, SEO |
| `'use client'` solo cuando es necesario | Minimizar JavaScript enviado al navegador |
| API Routes para validación | No confiar nunca en el frontend |
| Optimistic Updates | Mejor experiencia de usuario |
| TypeScript estricto | Detectar errores antes de ejecutar |
| Variables de entorno separadas | Seguridad de credenciales |
| Cleanup en useEffect | Evitar fugas de memoria |
| `clsx` para clases condicionales | Código más limpio y legible |
| Upsert en vez de if/else | Menos código, menos bugs |
| Mobile-first responsive | Diseño que funciona en todas partes |

---

*Hecho con ❤️ para que los juniors del equipo entiendan cada decisión del proyecto. Si tienes dudas, pregunta. No hay pregunta tonta en programación.*
