# Login — `/app/(auth)/login/`

## Qué hace esta página

Pantalla de acceso a la aplicación. Solo permite entrar mediante OAuth (Google o GitHub); no hay formulario de usuario y contraseña. Es una aplicación cerrada, solo para participantes invitados.

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `page.tsx` | Client Component (`"use client"`) | UI de login con botones OAuth |

Es Client Component porque necesita acceder a `window.location.origin` para construir la URL de callback.

---

## Flujo OAuth

```
1. Usuario hace click en "Continuar con Google"
2. supabase.auth.signInWithOAuth({ provider, options: { redirectTo: origin + '/auth/callback' } })
3. Supabase redirige al usuario a la pantalla de consentimiento de Google
4. Google redirige a /auth/callback con un código temporal
5. /auth/callback intercambia el código por una sesión
6a. Si el usuario NO tiene porras → redirige a /onboarding
6b. Si ya tiene porras → redirige a / (home)
```

---

## Diseño de la página

**Desktop (lg+):** Layout de dos columnas
- Columna izquierda (480px, azul): Branding con logo, headline y stats del torneo
- Columna derecha: Formulario de login con los dos botones OAuth

**Móvil:** Solo columna derecha con logo en la parte superior.

---

## Redirección post-login

El middleware (`middleware.ts`) redirige automáticamente a `/dashboard` si el usuario intenta acceder a `/login` con sesión activa:

```typescript
if (user && isAuthPage) {
  url.pathname = '/dashboard'
  return NextResponse.redirect(url)
}
```

---

## Configuración necesaria en Supabase

Para que funcione el login:
1. Ir a Supabase Dashboard → Authentication → Providers
2. Habilitar Google y/o GitHub
3. Pegar las credenciales OAuth (Client ID + Client Secret)
4. La URL de callback autorizada debe ser: `https://<project-ref>.supabase.co/auth/v1/callback`

Ver más detalle en el `CLAUDE.md` raíz del proyecto (sección "Next Steps").
