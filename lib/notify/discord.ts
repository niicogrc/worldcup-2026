// Post a plain message to the configured Discord webhook. Best-effort: never
// throws, returns false on any failure so callers can fall back silently.
export async function postToDiscord(content: string): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return false

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Discord caps message content at 2000 chars.
      // allowed_mentions: solo se pingea a usuarios mencionados con <@id>;
      // nunca @everyone/@here ni roles, aunque aparezcan en el texto.
      body: JSON.stringify({
        content: content.slice(0, 2000),
        allowed_mentions: { parse: ['users'] },
      }),
    })

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status, await response.text())
      return false
    }
    return true
  } catch (error) {
    console.error('Discord webhook error:', error)
    return false
  }
}
