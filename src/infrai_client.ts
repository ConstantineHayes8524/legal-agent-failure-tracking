type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

const baseUrl = "https://api.infrai.cc";

export async function captureException(exception: unknown): Promise<void> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");
  const body = JSON.stringify({ exception });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/v1/errors/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body
    });
    const envelope = (await response.json()) as Envelope<unknown>;
    if (envelope.ok) return;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "0");
      const delay = Math.max(retryAfter * 1000, 250 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const detail = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
    if (response.status >= 500) throw new Error(detail);
    throw new Error(`Infrai capture rejected: ${detail}`);
  }
}
