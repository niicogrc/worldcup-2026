# Perfil de Usuario — `/app/(app)/perfil/`

## Qué hace esta pantalla

Permite al usuario editar su nombre de perfil (el que aparece en el leaderboard) y cambiar su foto de perfil. Hay tres opciones de avatar: foto del proveedor OAuth (Google/GitHub), upload de imagen desde el PC, o un avatar prediseñado de DiceBear.

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `page.tsx` | Server Component | Fetcha perfil y datos OAuth del usuario; pasa props al cliente |
| `profile-client.tsx` | Client Component (`"use client"`) | Formulario completo con preview de avatar, upload y guardado |

---

## Flujo de datos

```
page.tsx (servidor)
  └── supabase.from('profiles').select('*').eq('id', user.id)
        → display_name, avatar_url

  user.user_metadata.avatar_url  → foto del proveedor OAuth (Google/GitHub)
  user.app_metadata.provider     → 'google' | 'github'

  → Props a ProfileClient:
      initialName, initialAvatarUrl, email, oauthAvatarUrl, oauthProvider
```

---

## Tres opciones de avatar

### 1. Foto OAuth
El botón "Usar foto de Google/GitHub" aparece solo si el proveedor proveyó una URL de avatar. Al hacer click, `avatarUrl` se actualiza al URL del proveedor; no sube nada a Storage.

### 2. Upload desde PC
1. El usuario selecciona una imagen (JPG, PNG, WebP, GIF, máx. 2 MB)
2. Se genera un preview local con `URL.createObjectURL(file)`
3. Al guardar, primero se sube a Supabase Storage (`POST /api/profile/avatar`)
4. La respuesta devuelve el URL público con timestamp para evitar caché: `?t=1234567890`
5. Con ese URL, se guarda el perfil (`PATCH /api/profile`)

### 3. Avatares prediseñados (DiceBear)
12 opciones generadas con la API de DiceBear (`thumbs` style). Al seleccionar uno, `avatarUrl` se actualiza con esa URL externa; tampoco se sube nada.

```typescript
const PRESET_AVATARS = ['mbappe', 'haaland', 'messi', ...].map(seed =>
  `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=1e2135&radius=50`
)
```

---

## Guardar cambios

El formulario llama a dos endpoints en secuencia:

```
1. Si hay fichero pendiente:
   POST /api/profile/avatar  (FormData con el fichero)
   → devuelve { url }

2. Siempre:
   PATCH /api/profile
   Body: { displayName, avatarUrl }
```

Si el upload falla, no se llama al PATCH (evita guardar un perfil con URL rota).

Tras guardar, `router.refresh()` actualiza el Server Component del layout para que el nombre y avatar en la barra lateral se refresquen inmediatamente.

---

## Validaciones

| Campo | Validación | Dónde |
|---|---|---|
| Display name | minLength=2, maxLength=40 | HTML nativo + servidor |
| Archivo | Máx. 2 MB | Cliente (antes del upload) + servidor |
| Archivo | Solo image/jpeg, image/png, image/webp, image/gif | HTML `accept` attribute |

---

## Endpoints implicados

- `PATCH /api/profile` → actualiza `display_name` y `avatar_url` en `profiles`
- `POST /api/profile/avatar` → sube imagen al bucket `avatars` de Supabase Storage
