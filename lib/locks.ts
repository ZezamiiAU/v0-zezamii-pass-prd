export function generatePin(length = 6): string {
  const min = Math.pow(10, length - 1)
  const max = Math.pow(10, length) - 1
  return Math.floor(Math.random() * (max - min + 1) + min).toString()
}

export async function provisionLockCode(params: {
  lockId: string
  code: string
  startsAt: Date
  endsAt: Date
  timezone: string
}): Promise<{ success: boolean; error?: string }> {
  const locksApiUrl = process.env.LOCKS_API_URL
  const locksApiKey = process.env.LOCKS_API_KEY

  if (!locksApiUrl || !locksApiKey) {
    return { success: false, error: "Lock API not configured" }
  }

  try {
    const response = await fetch(`${locksApiUrl}/codes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${locksApiKey}`,
      },
      body: JSON.stringify({
        lock_id: params.lockId,
        code: params.code,
        starts_at: params.startsAt.toISOString(),
        ends_at: params.endsAt.toISOString(),
        timezone: params.timezone,
      }),
    })

    if (!response.ok) {
      return { success: false, error: `Lock API returned ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function deleteLockCodeFromApi(code: string): Promise<{ success: boolean; error?: string }> {
  const locksApiUrl = process.env.LOCKS_API_URL
  const locksApiKey = process.env.LOCKS_API_KEY

  if (!locksApiUrl || !locksApiKey) {
    return { success: false, error: "Lock API not configured" }
  }

  try {
    const response = await fetch(`${locksApiUrl}/codes/${code}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${locksApiKey}`,
      },
    })

    if (!response.ok) {
      return { success: false, error: `Lock API returned ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" }
  }
}
