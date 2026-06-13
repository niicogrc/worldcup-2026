# Utilidades — `/lib/`

## Qué hay en esta carpeta

Módulos de utilidad compartidos por toda la aplicación. No contienen lógica de negocio compleja, pero son usados por múltiples páginas y componentes.

---

## Archivos

| Archivo | Qué hace |
|---|---|
| `flags.ts` | Mapa de nombre de equipo → URL de bandera |
| `players.ts` | Lista de jugadores candidatos a Bota de Oro |
| `thesportsdb/` | Cliente HTTP de TheSportsDB + lógica de sync (`client.ts` + `sync.ts`) — fuente de resultados del torneo (ver su propio CLAUDE.md) |
| `supabase/` | Clientes de Supabase + tipos (ver su propio CLAUDE.md) |

---

## `flags.ts`

Mapa estático de nombres de equipo (tal como están en la tabla `teams` de la DB, que vienen de openfootball) a códigos ISO 3166-1 alpha-2 para obtener banderas de `flagcdn.com`.

```typescript
export function getFlagUrl(teamName: string): string | null {
  const code = TEAM_FLAG_CODES[teamName]
  if (!code) return null
  return `https://flagcdn.com/w40/${code}.png`
}
```

Ejemplos:
- `'Spain'` → `'es'` → `https://flagcdn.com/w40/es.png`
- `'England'` → `'gb-eng'` (bandera de Inglaterra, no del Reino Unido)
- `'Scotland'` → `'gb-sct'`

Si un equipo no está en el mapa, devuelve `null`. Los componentes muestran el short code como fallback (ej. `ESP`).

**Importante:** Los nombres de equipo deben coincidir exactamente con los que usa openfootball (ej. `'South Korea'`, no `'Korea Republic'`).

---

## `players.ts`

Array `WORLD_CUP_2026_PLAYERS` con los principales goleadores de los 48 equipos participantes. Se usa en el buscador de la Bota de Oro.

```typescript
export interface Player {
  name: string      // Nombre completo del jugador
  teamName: string  // Debe coincidir con teams.name en la DB
}

export const WORLD_CUP_2026_PLAYERS: Player[] = [
  { name: 'Santiago Giménez', teamName: 'Mexico' },
  { name: 'Vinicius Jr.', teamName: 'Brazil' },
  // ...
]
```

El `teamName` se usa para buscar el `team_id` en la lista de equipos cuando el usuario selecciona un jugador del dropdown.

Si el jugador que busca el usuario no está en la lista, puede escribir el nombre manualmente. En ese caso, `teamId` quedará vacío y la predicción se guarda sin equipo vinculado.

---

## Cómo añadir un equipo que falta en las banderas

Editar `TEAM_FLAG_CODES` en `flags.ts`:

```typescript
const TEAM_FLAG_CODES: Record<string, string> = {
  // Añadir aquí:
  'NombreDelEquipo': 'codigo-iso',
}
```

Los códigos ISO están en: https://flagcdn.com/ (buscar el país).

## Cómo añadir jugadores al buscador

Editar el array `WORLD_CUP_2026_PLAYERS` en `players.ts`. El `teamName` debe coincidir exactamente con el campo `name` de la tabla `teams` en Supabase (que a su vez viene de openfootball).
