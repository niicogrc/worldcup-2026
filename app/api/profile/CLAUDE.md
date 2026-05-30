# API — Perfil — `/app/api/profile/`

## Qué hace esta carpeta

Dos endpoints para gestionar el perfil del usuario: actualizar datos textuales y subir la foto de perfil.

---

## Endpoints

### `PATCH /api/profile`
Actualiza el nombre y/o avatar URL del perfil.

```
Body: { displayName: string, avatarUrl: string | null }
```

### `POST /api/profile/avatar`
Sube una imagen al bucket `avatars` de Supabase Storage.

```
Body: FormData con campo 'file' (File)
Respuesta: { url: string }  → URL pública con timestamp (?t=...)
```

---

## Archivos

| Archivo | Endpoint | Responsabilidad |
|---|---|---|
| `route.ts` | `PATCH /api/profile` | Valida y actualiza `profiles` en la DB |
| `avatar/route.ts` | `POST /api/profile/avatar` | Sube imagen a Supabase Storage |

---

## Cómo funciona `PATCH /api/profile`

1. Verifica sesión
2. Valida `displayName` (min 2 chars)
3. Usa `createAdminClient()` (service role) para actualizar la tabla `profiles`:
   ```
   UPDATE profiles SET display_name, avatar_url, updated_at WHERE id = user.id
   ```

Se usa el **admin client** (service role key) para saltarse las políticas RLS. Esto es seguro porque el endpoint ya autenticó al usuario y solo actualiza su propio perfil.

---

## Cómo funciona `POST /api/profile/avatar`

1. Verifica sesión
2. Valida tamaño del archivo (máx. 2 MB)
3. Determina la extensión: `jpeg → jpg`
4. Sube el fichero al bucket `avatars` con path `{user.id}/avatar.{ext}`:
   ```typescript
   admin.storage.from('avatars').upload(path, buffer, { upsert: true })
   ```
   `upsert: true` sobreescribe si ya había una foto anterior.
5. Obtiene la URL pública y añade `?t={timestamp}` para que el navegador no use la versión en caché:
   ```typescript
   const url = `${publicUrl}?t=${Date.now()}`
   ```
6. Devuelve `{ url }` — el cliente llama después a `PATCH /api/profile` con esta URL.

---

## Bucket de Supabase Storage

- **Nombre:** `avatars`
- **Path por usuario:** `{user.id}/avatar.{ext}` (ej: `abc123/avatar.jpg`)
- **Acceso:** público (el URL no requiere autenticación)
- Hay que crear el bucket manualmente en el Dashboard de Supabase si no existe

---

## Por qué se usa `createAdminClient` en lugar de `createClient`

El cliente normal (anon key) está sujeto a las políticas RLS de la tabla `profiles`. Para actualizar un perfil desde una API route server-side es más seguro y directo usar el service role key, que bypasea RLS, combinado con la validación de sesión previa en el mismo endpoint.
