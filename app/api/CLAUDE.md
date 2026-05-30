# API Routes — `/app/api/`

## Visión general

Todas las API Routes del proyecto. Son endpoints HTTP server-side de Next.js — se ejecutan en Node.js, tienen acceso a las env vars secretas y nunca se envían al navegador.

---

## Endpoints

| Ruta | Método | Quién la llama | Qué hace |
|---|---|---|---|
| `/api/predictions` | `POST` | Cliente (grupos, playoffs) | Guarda/actualiza predicción 1-X-2 |
| `/api/golden-boot` | `POST` | Cliente (bota-de-oro) | Guarda/actualiza predicción Bota de Oro |
| `/api/profile` | `PATCH` | Cliente (perfil) | Actualiza nombre y avatar URL del perfil |
| `/api/profile/avatar` | `POST` | Cliente (perfil) | Sube imagen a Supabase Storage |
| `/api/seed` | `POST` | Manual (curl) | Carga los 48 equipos y 104 partidos en la DB |
| `/api/sync-matches` | `POST` | Cron de Vercel | Sincroniza resultados desde API-Football |

Cada subcarpeta tiene su propio `CLAUDE.md` con el detalle completo.

---

## Autenticación en las API Routes

### Endpoints de usuario (predicciones, perfil)

Verifican la sesión del usuario mediante cookies de Supabase:

```typescript
const supabase = await createClient()  // cliente con cookies del usuario
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

### Endpoints de sistema (seed, sync)

Protegidos con un token secreto que solo conoce el servidor:

```typescript
const authHeader = req.headers.get('Authorization')
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Clientes de Supabase: anon vs admin

Las API Routes pueden necesitar ambos:

- `createClient()` → anon key, respeta RLS, para verificar la sesión del usuario
- `createAdminClient()` → service role key, bypasea RLS, para operaciones del sistema

Importar de `@/lib/supabase/server`:
```typescript
import { createClient, createAdminClient } from '@/lib/supabase/server'
```

---

## Estructura de respuestas

```typescript
// Éxito
NextResponse.json({ success: true }, { status: 200 })
NextResponse.json({ url: 'https://...', ...data }, { status: 200 })

// Error del cliente (input inválido, no autenticado)
NextResponse.json({ error: 'Mensaje legible' }, { status: 400 | 401 | 404 })

// Error del servidor
NextResponse.json({ error: error.message }, { status: 500 })
```

---

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Clave pública (safe para exponer)
SUPABASE_SERVICE_ROLE_KEY=        # Clave privada — solo server-side
API_FOOTBALL_KEY=                 # API key de api-sports.io
CRON_SECRET=                      # Token para proteger /api/seed y /api/sync-matches
```
