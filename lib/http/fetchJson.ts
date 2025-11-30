export async function fetchJson<T>(input: RequestInfo, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {})
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  if (!headers.has("x-requested-with")) headers.set("x-requested-with", "XMLHttpRequest")
  if (!headers.has("x-request-id")) {
    const rid =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
    headers.set("x-request-id", rid)
  }
  const res = await fetch(input, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  // @ts-ignore
  if (!res.ok) throw new Error(data?.error ?? res.statusText)
  return data as T
}
