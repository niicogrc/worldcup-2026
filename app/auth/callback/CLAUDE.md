# Auth Callback — `/app/auth/callback/`

## Qué hace esta ruta

Gestiona el retorno de los proveedores OAuth (Google, GitHub) después de que el usuario da su consentimiento. Intercambia el código temporal de autorización por una sesión de Supabase.

---

## Archivo

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `route.ts` | Route Handler (GET) | Intercambio de código OAuth → sesión; redirige al destino |

---

## Flujo OAuth completo

```
1. Usuario hace click en "Continuar con Google/GitHub" en /login
2. Supabase redirige a Google/GitHub con scope de autenticación
3. El usuario aprueba el acceso
4. Google/GitHub redirige a: /auth/callback?code=XXXX&next=/dashboard
5. Este handler extrae el ?code de la URL
6. supabase.auth.exchangeCodeForSession(code) → crea sesión + cookies
7. Redirige a ?next (/dashboard por defecto)
```

---

## Código del handler

```typescript
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-code-exchange-failed`)
}
```

---

## URL de callback configurada en Supabase

Esta ruta (`/auth/callback`) debe estar registrada como URI de redirección autorizada en:
- **Supabase:** Dashboard → Authentication → URL Configuration → Redirect URLs
- **Google Cloud Console:** Credenciales OAuth → URIs de redirección autorizados
- **GitHub:** Settings → Developer Settings → OAuth Apps → Authorization callback URL

El formato correcto para producción: `https://tudominio.com/auth/callback`

---

## Qué pasa tras el login exitoso

Cuando `exchangeCodeForSession` tiene éxito, Supabase crea una sesión en cookies. El middleware de Next.js (`middleware.ts`) detecta esa sesión en las siguientes peticiones y permite el acceso a las rutas protegidas.

Además, si es la primera vez que el usuario entra, el trigger `on_auth_user_created` en Postgres crea automáticamente una fila en `profiles` con su nombre y avatar de Google/GitHub.
