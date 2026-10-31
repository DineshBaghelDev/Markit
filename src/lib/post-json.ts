// Client helper for the pipeline routes; throws the route's error message.
export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (HTTP ${response.status})`);
  return data as T;
}
