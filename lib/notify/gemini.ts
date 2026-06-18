import type { NotifyFacts } from './facts'

// Narrate the sync facts as a short, fun Discord message using the Gemini API
// (free tier). Returns null if no key is set or the request fails, so the
// caller falls back to a deterministic template.
export async function narrate(facts: NotifyFacts): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
  const prompt = `Eres el narrador gracioso y cercano de una porra del Mundial 2026 entre un grupo de amigos.
Con los DATOS de abajo (en JSON), escribe un único mensaje para Discord, en español de España.
Reglas:
- Máximo ~120 palabras. Tono divertido pero sin pasarte; algún emoji con moderación.
- Primero comenta brevemente los resultados de los partidos.
- Luego, por cada porra, di quién ha sumado puntos y quién lidera ahora.
- NO inventes datos que no estén en el JSON (ni nombres, ni cifras, ni partidos).
- Para referirte a una persona usa EXACTAMENTE su valor "mention" tal cual aparece
  en el JSON. Si es del tipo "<@123...>" cópialo literal (es una mención de Discord);
  no lo cambies, no lo traduzcas y no le añadas otro "@".
- No uses encabezados markdown (#). Texto plano con saltos de línea está bien.

DATOS:
${JSON.stringify(facts)}`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 500 },
        }),
      },
    )

    if (!response.ok) {
      console.error('Gemini request failed:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch (error) {
    console.error('Gemini narrate error:', error)
    return null
  }
}
