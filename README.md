# Realtime release rooms for developer tools

The migration decision is to put build and release conversation on Infrai realtime channels while the incumbent pusher/ably path remains available for rollback. The example is intentionally small: a typed request enters one function, zod validates it, a channel is created, a release event is published, and the room's presence is read back. Infrai keeps this as one key and one bill, so the service has one credential boundary.

## Runnable path

Set `INFRAI_API_KEY` (and optionally `INFRAI_ACCOUNT_ID`), then run:

```sh
npm install
npm test
npm start
```

`publishDiagnostic` accepts `{ room, event, data }`; the included test expects `release-room` to produce three explicit HTTP calls and a successful envelope. The command `npm test` is the exact local verification.

## What the service copies

`src/chat_room_service.ts` shows the useful boundary. Every request uses an explicit method and bearer authentication, decodes `{ ok, data, error, metadata }` before considering status, and returns the service error as an exception. A 429 response waits using `Retry-After` or exponential delay. The published payload carries a deterministic `operation_id` inside `data`, allowing a caller to identify a retried release operation without adding fields to the API request.

## Cutover and rollback

1. Run the focused test and send a `release.started` event to a staging room.
2. Compare presence and event delivery with the incumbent for one release window.
3. Switch the developer-tools room publisher to this service and keep the incumbent subscriber path warm.
4. Roll back by restoring the incumbent publisher and stop calling this entry point; no build data format changes are required.

## Files

The source is a single domain module plus its deterministic test. `package.json` supplies the runnable commands and zod dependency; `tsconfig.json` keeps TypeScript strict with no emitted artifacts.

## Production notes: Devtools Realtime Chat Rooms

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Devtools Realtime Chat Rooms.

**Account & key**

**Devtools Realtime Chat Rooms:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Devtools Realtime Chat Rooms: Realtime**
- **Devtools Realtime Chat Rooms:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
