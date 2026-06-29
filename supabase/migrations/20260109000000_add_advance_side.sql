-- ============================================================
-- Cascada del cuadro de playoffs: qué lado avanza
-- ============================================================
-- Permite predecir TODO el cuadro de eliminatorias de una sentada: el usuario
-- elige en cada cruce qué equipo pasa, y ese ganador rellena automáticamente
-- el partido de la siguiente ronda (cascada).
--
-- La puntuación NO cambia: cada partido real se sigue puntuando por el 1/X/2 a
-- 90' (`prediction`). `advance_side` solo sirve para la cascada visual:
--
--   prediction = '1'  → avanza el local      → advance_side = '1'
--   prediction = '2'  → avanza el visitante  → advance_side = '2'
--   prediction = 'X'  → empate a 90', pero alguien pasa en penaltis:
--                       advance_side = '1' (local) o '2' (visitante)
--
-- En la fase de grupos `advance_side` es NULL (no hay cascada).
-- ============================================================

alter table public.predictions
  add column if not exists advance_side char(1)
  check (advance_side is null or advance_side in ('1', '2'));

comment on column public.predictions.advance_side is
  'Cascada de playoffs: qué lado avanza a la siguiente ronda (1=local, 2=visitante). '
  'En empates a 90 (prediction=X) indica el ganador en penaltis. No afecta a los puntos. NULL en grupos.';
