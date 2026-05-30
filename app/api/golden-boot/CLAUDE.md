# API — Bota de Oro — `/app/api/golden-boot/`

## Qué hace este endpoint

Guarda o actualiza la predicción de Bota de Oro de un usuario (el jugador que cree que será el máximo goleador). Solo permite guardar antes del inicio del torneo.

---

## Endpoint

```
POST /api/golden-boot
Content-Type: application/json
Body: { playerName: string, teamId: string | null }
```

Requiere sesión activa.

---

## Lógica paso a paso

```
1. Verifica sesión → 401 si no hay usuario
2. ensureProfile() → crea perfil si no existía
3. Fetcha el partido con kickoff más temprano de la DB
4. Si kickoff_at <= now() → 400 "El torneo ya ha comenzado"
5. Valida que playerName no esté vacío → 400
6. Busca si ya existe una predicción del usuario:
   a. Si existe → UPDATE
   b. Si no existe → INSERT
7. Devuelve { success: true }
```

---

## Diferencia con predicciones de partidos

Para las predicciones de partido se usa **upsert** directamente. Para la Bota de Oro se hace una búsqueda previa y luego insert o update por separado. Esto es porque la tabla `golden_boot_predictions` tiene una constraint de único por `user_id`, pero queremos un manejo más explícito del flujo.

---

## Cuándo se bloquea

La predicción se bloquea cuando el **primer partido del torneo** ya ha comenzado (el partido con el `kickoff_at` más temprano). Esto se verifica en el servidor haciendo:

```typescript
supabase.from('matches').select('*').order('kickoff_at').limit(1).maybeSingle()
if (kickoff <= new Date()) → 400
```

El cliente también muestra el countdown y deshabilita el formulario cuando el tiempo llega a 0.

---

## teamId (opcional)

El `teamId` es el UUID del equipo en la tabla `teams`. Se pasa cuando el usuario selecciona un jugador del dropdown (se resuelve buscando el equipo por nombre). Si el usuario escribe un nombre manual, `teamId` puede ser `null` o vacío, y en ese caso se guarda `team_id = null` en la DB.

---

## Respuestas posibles

| Código | Cuándo |
|---|---|
| 200 `{ success: true }` | Guardado correctamente |
| 400 `{ error: 'El torneo ya ha comenzado...' }` | Kickoff del primer partido ya pasó |
| 400 `{ error: 'Debes introducir el nombre...' }` | playerName vacío |
| 401 `{ error: 'Unauthorized' }` | Sin sesión |
| 500 | Error de DB |
