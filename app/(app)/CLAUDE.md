# Layout Principal de la App — `/app/(app)/`

## Qué hace esta carpeta

Contiene el layout autenticado de la aplicación: la barra lateral de navegación (desktop), la barra inferior (móvil), el menú de usuario y el layout general que envuelve todas las páginas protegidas.

Todas las rutas dentro de `(app)/` requieren sesión activa. El paréntesis en el nombre indica que es un **Route Group** de Next.js — agrupa rutas sin añadir segmento a la URL.

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `layout.tsx` | Server Component | Layout principal: sidebar desktop + nav móvil + contenido |
| `navigation.tsx` | Client Component | Links de navegación con estado activo + cerrar sesión |
| `user-menu.tsx` | Client Component | Menú desplegable del usuario con opciones de perfil y logout |

---

## `layout.tsx` — cómo funciona

Es un **Server Component** que:
1. Verifica que hay sesión activa (si no → redirect a `/login`)
2. Fetcha el perfil del usuario para obtener `display_name`, `avatar_url` y `role`
3. Renderiza el shell de la app con sidebar (desktop) y nav inferior (móvil)
4. Pasa `{ displayName, avatarUrl, isAdmin }` como props al `UserMenu`

```typescript
const isAdmin = profile?.role === 'admin'
```

Si `role = 'admin'`, aparece el link "Admin" en la navegación.

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
