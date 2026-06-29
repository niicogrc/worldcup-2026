# API — Predicciones — `/app/api/predictions/`

## Qué hace este endpoint

Guarda o actualiza la predicción de un usuario para un partido concreto. Es el endpoint central de la mecánica de apuestas de la fase de grupos y playoffs.

---

## Endpoint

```
POST /api/predictions
Content-Type: application/json
Body: { matchId: string, prediction: '1' | 'X' | '2', porraId: string, advanceSide?: '1' | '2' }
```

`advanceSide` es **opcional** y solo se usa en la cascada del cuadro de playoffs: indica qué lado avanza a la siguiente ronda (`'1'` local, `'2'` visitante). Cuando `prediction = 'X'` (empate a 90') es lo único que dice quién pasa en penaltis. En grupos no se envía (queda NULL). No afecta a los puntos. Ver `app/(app)/playoffs/CLAUDE.md`.

Requiere sesión activa (cookie de Supabase en la petición).

---

## Lógica paso a paso

```
1. Verifica sesión → 401 si no hay usuario
2. ensureProfile() → crea el perfil si no existía (fallback por si el trigger falló)
3. Valida que prediction sea '1', 'X' o '2' → 400 si no
4. Fetcha el partido de la DB → 404 si no existe
5. Comprueba si kickoff_at <= now() → 400 "cerradas" si está bloqueado
6. Upsert en predictions con onConflict('user_id,match_id') → actualiza si ya existía
7. Devuelve { success: true }
```

---

## Función `ensureProfile`

```typescript
async function ensureProfile(userId: string, userMeta: Record<string, string>) {
  const admin = createAdminClient()
  await admin.from('profiles').upsert(
    { id: userId, display_name: ..., avatar_url: ... },
    { onConflict: 'id', ignoreDuplicates: true }
  )
}
```

Esta función existe como **guard de seguridad**: si un usuario se registró antes de que el trigger `on_auth_user_created` estuviera en producción, puede que no tenga perfil. `ignoreDuplicates: true` hace que el upsert sea un no-op si el perfil ya existe, sin sobrescribir nada.

---

## Upsert de predicción

```typescript
supabase.from('predictions').upsert(
  { porra_id, user_id, match_id, prediction, advance_side: advanceSide ?? null, is_locked: false },
  { onConflict: 'porra_id,user_id,match_id' }
)
```

La constraint `UNIQUE (porra_id, user_id, match_id)` en la DB garantiza que solo hay una predicción por usuario por partido por porra. El upsert la actualiza si ya existe.

---

## Doble validación del bloqueo

El bloqueo se verifica **tanto en cliente como en servidor**:
- Cliente: deshabilita el botón cuando `kickoff_at <= new Date()`
- Servidor (aquí): comprueba `kickoff_at <= new Date()` independientemente

Además existe un **trigger en Postgres** (`enforce_prediction_lock`) que impide modificar predicciones bloqueadas a nivel de base de datos. Es la última línea de defensa.

---

## Respuestas posibles

| Código | Cuándo |
|---|---|
| 200 `{ success: true }` | Guardado correctamente |
| 400 `{ error: 'Invalid parameters' }` | prediction no es 1/X/2 o falta matchId |
| 400 `{ error: 'cerradas' }` | El partido ya empezó |
| 401 `{ error: 'Unauthorized' }` | Sin sesión |
| 404 `{ error: 'Match not found' }` | matchId no existe en la DB |
| 500 | Error inesperado de DB |
