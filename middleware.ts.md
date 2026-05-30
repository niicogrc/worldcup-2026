# Middleware — `middleware.ts` (raíz del proyecto)

## Qué hace

Intercepta todas las peticiones HTTP antes de que lleguen a las páginas y verifica si el usuario tiene sesión activa. Gestiona las redirecciones de autenticación.

---

## Archivo

| Archivo | Contexto |
|---|---|
| `middleware.ts` | Next.js Edge Runtime — se ejecuta en cada request |

---

## Lógica

```typescript
1. Crea un cliente Supabase que lee/escribe cookies de la request
2. Valida la sesión con supabase.auth.getUser()
   (verifica con el servidor de Supabase, no solo lee la cookie)
3. Aplica redirecciones:
   - Sin sesión + ruta protegida → redirect /login
   - Con sesión + en /login → redirect /dashboard
   - API routes y /auth/callback → pasan siempre sin comprobación
```

---

## Routes que bypasean el middleware

```typescript
if (isApiRoute || isAuthCallback) {
  return response  // pasar directo
}
```

Las rutas `/api/*` y `/auth/callback` no necesitan la comprobación de sesión del middleware — cada endpoint hace su propia autenticación internamente.

---

## Matcher de Next.js

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

Excluye archivos estáticos y assets para que el middleware no se ejecute en cada imagen o CSS. Solo se ejecuta en rutas de páginas y API.

---

## Por qué `supabase.auth.getUser()` en lugar de `getSession()`

`getSession()` solo lee la cookie sin validarla con el servidor (puede estar spoofada). `getUser()` hace una petición a Supabase Auth para validar el token JWT, lo que es más seguro para el control de acceso.

---

## Relación con el layout

El middleware redirige a `/login` si no hay sesión, pero el layout de la app (`app/(app)/layout.tsx`) también hace su propia comprobación con `supabase.auth.getUser()`. Esta doble comprobación es redundante pero no hace daño — el middleware es la primera línea, el layout es el seguro.
