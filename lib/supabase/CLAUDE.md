# Supabase Clients — `/lib/supabase/`

## Qué hace esta carpeta

Exporta los clientes de Supabase correctamente configurados para cada contexto de Next.js. Hay tres archivos: dos clientes (servidor y cliente) y los tipos generados de la DB.

---

## Archivos

| Archivo | Uso | Contexto |
|---|---|---|
| `server.ts` | Server Components, API routes, middleware | Solo servidor |
| `client.ts` | Client Components (`"use client"`) | Solo navegador |
| `types.ts` | Tipos TypeScript generados de la DB | Ambos |

---

## `server.ts` — Cliente de servidor

### `createClient()` — cliente normal (anon key)

```typescript
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(URL, ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) { /* actualiza cookies de sesión */ }
    }
  })
}
```

- Usa la **anon key** (pública) — respeta RLS
- Lee y escribe cookies de sesión del usuario actual
- Devuelve `Promise<SupabaseClient>` → hay que hacer `await createClient()`
- Usar en Server Components y API routes cuando se necesita el contexto del usuario

### `createAdminClient()` — cliente admin (service role)

```typescript
export function createAdminClient() {
  return createServerClient<Database>(URL, SERVICE_ROLE_KEY, {
    cookies: { getAll() { return [] }, setAll() {} }
  })
}
```

- Usa la **service role key** (secreta) — bypasea RLS completamente
- No maneja cookies de sesión (el admin no "es" ningún usuario)
- Síncrono (no necesita `await`)
- Usar en API routes y funciones del servidor cuando se necesitan permisos totales (sync, seed, upsert de perfil, upload de avatar)

**Importante:** La service role key NUNCA debe enviarse al cliente. Solo usar `createAdminClient` en código server-side.

---

## `client.ts` — Cliente de navegador

```typescript
export function createClient() {
  return createBrowserClient<Database>(URL, ANON_KEY)
}
```

- Usa la **anon key** — respeta RLS
- Persiste la sesión en `localStorage` / cookies del navegador
- Usar en Client Components (`"use client"`) para interacciones, Realtime, signOut, etc.

---

## `types.ts` — Tipos de la DB

Generado con el CLI de Supabase:
```bash
npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
```

Exporta el tipo `Database` que tipifica todas las tablas, vistas, funciones y enums de Postgres. También exporta aliases útiles:

```typescript
export type MatchResult = Database['public']['Enums']['match_result']     // '1' | 'X' | '2'
export type MatchStatus = Database['public']['Enums']['match_status']     // 'NS' | 'FT' | ...
export type TournamentPhase = Database['public']['Enums']['tournament_phase']
```

---

## Placeholder URLs para el build

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
```

Durante `next build`, Next.js prerenderiza páginas estáticas sin las env vars. Sin estos fallbacks, el build falla con error fatal. Ver Learnings en el CLAUDE.md raíz.

---

## Dónde importar cada cliente

```typescript
// ✅ En un Server Component o API route:
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// ✅ En un API route que necesita admin:
import { createAdminClient } from '@/lib/supabase/server'
const admin = createAdminClient()

// ✅ En un Client Component:
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// ❌ Nunca:
import { createAdminClient } from '@/lib/supabase/server'  // en un Client Component
```
