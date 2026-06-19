// Post a plain message to the configured Discord webhook.
// Returns the Discord message ID on success (null on failure or no webhook).
export async function postToDiscord(content: string): Promise<string | null> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return null

  try {
    // ?wait=true makes Discord return the full message object (including id)
    const response = await fetch(`${url}?wait=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: content.slice(0, 2000),
        allowed_mentions: { parse: ['users'] },
      }),
    })

    if (!response.ok) {
      console.error('Discord webhook failed:', response.status, await response.text())
      return null
    }
    const msg = await response.json()
    return typeof msg?.id === 'string' ? msg.id : null
  } catch (error) {
    console.error('Discord webhook error:', error)
    return null
  }
}

// Delete a previously posted webhook message by its ID.
export async function deleteDiscordMessage(messageId: string): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return false

  try {
    const response = await fetch(`${url}/messages/${messageId}`, { method: 'DELETE' })
    if (!response.ok) {
      console.error('Discord delete failed:', response.status, await response.text())
      return false
    }
    return true
  } catch (error) {
    console.error('Discord delete error:', error)
    return false
  }
}
