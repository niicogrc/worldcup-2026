# Layout Principal de la App — `/app/(app)/`

## Qué hace esta carpeta

Contiene el layout autenticado de la aplicación: la barra lateral de navegación (desktop), la barra inferior (móvil), el menú de usuario y el layout general que envuelve todas las páginas protegidas.

Todas las rutas dentro de `(app)/` requieren sesión activa. El paréntesis en el nombre indica que es un **Route Group** de Next.js — agrupa rutas sin añadir segmento a la URL.

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `layout.tsx` | Server Component | Layout principal: fetch de porras del usuario, porra activa, redirect a /onboarding si no tiene |
| `navigation.tsx` | Client Component | Links de navegación con estado activo + cerrar sesión |
| `porra-selector.tsx` | Client Component | Dropdown para cambiar de porra activa; llama al Server Action `setActivePorra` + `router.refresh()` |
| `user-menu.tsx` | Client Component | Menú desplegable del usuario con opciones de perfil y logout |

---

## `layout.tsx` — cómo funciona

Es un **Server Component** que:
1. Verifica que hay sesión activa (si no → redirect a `/login`)
2. Fetcha el perfil del usuario para obtener `display_name`, `avatar_url` y `role`
3. Fetcha las porras del usuario desde `porra_members` (join con `porras`)
4. Si no tiene porras → redirect a `/onboarding`
5. Lee la porra activa desde la cookie `active_porra_id`; si inválida, usa la primera
6. Renderiza el shell con `PorraSelector` en la cabecera del sidebar (desktop) y el mobile header

**Importante:** el layout NO escribe la cookie aunque esté vacía/incorrecta — los Server Components no pueden modificar cookies durante el render (Next.js lanza "Cookies can only be modified in a Server Action or Route Handler"). La cookie solo se escribe desde el Server Action `setActivePorra` (al cambiar de porra, crear o unirse); mientras tanto cada consumidor aplica el mismo fallback a la primera porra.

```typescript
const isAdmin = profile?.role === 'admin'
```

Si `role = 'admin'`, aparece el link "Admin" en la navegación.

## Porra activa — flujo completo

```
layout.tsx (Server Component)
  ├── porra_members + porras → lista de porras del usuario
  ├── cookie 'active_porra_id' → porra activa (o first de la lista)
  └── PorraSelector (Client Component)
       └── al cambiar: setActivePorra() (Server Action) + router.refresh()

Cada page.tsx independiente:
  └── getActivePorraId(supabase, userId) → lee cookie y valida membresía
```

La cookie `active_porra_id` es no-httpOnly para que el cliente también pueda leerla si fuera necesario. Se configura con maxAge de 1 año y sameSite: lax.

---

## Layout responsive

```
Desktop (md+):                   Móvil:
┌──────────┬──────────────────┐  ┌───────────────────┐
│ Sidebar  │  Contenido       │  │ Header (logo)     │
│ (256px)  │  (max-w-6xl)     │  ├───────────────────┤
│  Logo    │                  │  │                   │
│  Nav     │                  │  │  Contenido        │
│          │                  │  │                   │
│  User    │                  │  ├───────────────────┤
│  Menu    │                  │  │ Nav inferior      │
└──────────┴──────────────────┘  └───────────────────┘
```

---

## `navigation.tsx`

Acepta dos props:
- `isMobile: boolean` — renderiza versión compacta (icono + label corto) para la nav inferior
- `isAdmin: boolean` — muestra u oculta el link `/admin`

La ruta activa se detecta con `usePathname()`. El link activo recibe clases de resalte azul.

Links actuales:
```
/dashboard    → Leaderboard
/grupos       → Fase de Grupos
/playoffs     → Playoffs
/bota-de-oro  → Bota de Oro
/admin        → Admin (solo si isAdmin)
```

Cerrar sesión llama a `supabase.auth.signOut()` y redirige a `/login`.

---

## `user-menu.tsx`

Dropup (se abre hacia arriba) que aparece al hacer click sobre el avatar del usuario en la parte inferior del sidebar. Contiene:
- Link a `/perfil` (editar perfil)
- Botón "Cerrar sesión"

El dropdown se cierra al hacer click fuera gracias a un listener en `document.addEventListener('mousedown', handler)`.

---

## Paleta de colores del shell

| Elemento | Color |
|---|---|
| Fondo principal | `#0c0d12` |
| Sidebar / cards | `#13151c` |
| Hover / activo | `#191c26` |
| Bordes | `#1f2333` |
| Texto principal | `#e2e6f0` |
| Texto secundario | `zinc-400` / `zinc-500` |
| Acento | `blue-500` |
