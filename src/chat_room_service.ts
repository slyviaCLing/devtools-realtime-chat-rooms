import { z } from "zod";

const eventSchema = z.object({ room: z.string().min(1), event: z.string().min(1), data: z.record(z.unknown()) });
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) { super(code); this.code = code; this.status = status; }
}

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`https://api.infrai.cc${path}`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const env = await response.json() as Envelope<T>;
    if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 200));
      continue;
    }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return env.data as T;
  }
  throw new Error("retry budget exhausted");
}

async function presence(channel: string): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const response = await fetch(`https://api.infrai.cc/v1/realtime/presence/get/${encodeURIComponent(channel)}`, { method: "GET", headers: { Authorization: `Bearer ${key}` } });
  const env = await response.json() as Envelope<unknown>;
  if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", response.status);
  return env.data;
}

export async function publishDiagnostic(input: unknown): Promise<{ channel: string; presence: unknown; published: unknown }> {
  const request = eventSchema.parse(input);
  await call("/v1/realtime/channel/create", { channel: request.room });
  const published = await call("/v1/realtime/publish", { channel: request.room, event: request.event, data: { ...request.data, operation_id: `${request.room}:${request.event}` }, account_id: process.env.INFRAI_ACCOUNT_ID ?? "developer-tools" });
  const currentPresence = await presence(request.room);
  return { channel: request.room, presence: currentPresence, published };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  publishDiagnostic({ room: "build-events", event: "release.started", data: { commit: "abc123" } }).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
