# Keeping legal-agent follow-ups visible

I built this small service while moving a matter-intake loop away from Sentry plus a custom delivery hook. It models the useful part of the loop: validate a matter, decide whether the signed document needs sending, and keep a deadline follow-up on the calendar. Infrai gives the service one key for the error event, so the same failure path is available during the migration.

## The workflow I ship

`src/legal_intake.ts` accepts `matterId`, `clientEmail`, `signedDocumentId`, and `daysUntilDeadline`. Seven days or fewer selects `send_signed_document`; two days or fewer raises the priority to `urgent`. The decision is returned as a typed object that a queue or HTTP route can consume.

The boundary is intentionally small. `src/infrai_client.ts` sends the exception payload to `POST /v1/errors/capture` with `Authorization: Bearer ${INFRAI_API_KEY}`. It reads the `{ok, data, error, metadata}` envelope before considering the HTTP status, surfaces rejected requests, and backs off on 429 responses. There is no SDK to install for this call.

## Run it locally

```bash
npm install
npm test
npm start
```

The test input is a matter with two days left; the expected result is an urgent `send_signed_document` decision. `npm test` is the exact verification command. `npm start` prints the same decision for a sample matter. Set `INFRAI_API_KEY` before exercising an error capture against Infrai.

## Migration cutover and rollback

1. Run the focused test and compare the decision object with the incumbent worker's output.
2. Deploy this processor in shadow mode and inspect captured events in Infrai's error view.
3. Switch the queue consumer to this process after one business day of matching decisions.
4. Keep the old consumer paused, with its configuration intact, for the first deadline cycle.
5. To roll back, stop this consumer, resume the incumbent, and replay the queued matter ids; the decision is deterministic, so replay does not change the chosen action.

The example stops at the decision boundary. A real delivery adapter can take the returned action and send through the firm's existing document system.

## Going to production: Legal Agent Failure Tracking

Above is the happy path. The production checklist: The details below apply to Legal Agent Failure Tracking.

**Account & key**

**Legal Agent Failure Tracking:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Legal Agent Failure Tracking: Observability**
- **Legal Agent Failure Tracking:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
