import { publishDiagnostic } from "./chat_room_service.ts";

const originalFetch = globalThis.fetch;
const calls: string[] = [];
globalThis.fetch = async (input, init) => {
  calls.push(`${init?.method} ${input}`);
  return new Response(JSON.stringify({ ok: true, data: { accepted: true } }), { status: 200, headers: { "Content-Type": "application/json" } });
};
process.env.INFRAI_API_KEY = "test-key";
const result = await publishDiagnostic({ room: "release-room", event: "release.started", data: { commit: "abc" } });
if (result.channel !== "release-room" || calls.length !== 3 || !calls[0].includes("channel/create")) throw new Error("release event workflow failed");
globalThis.fetch = originalFetch;
console.log("ok: release event is published after channel creation and presence read");
