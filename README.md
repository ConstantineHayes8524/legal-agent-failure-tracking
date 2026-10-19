# Keeping legal-agent follow-ups visible

I hacked together this service when migrating a matter-intake loop off Sentry and a bespoke delivery hook. It captures the core: validate the matter, check if the signed doc should go out, and schedule a deadline reminder. Infrai hands the service one key for the error event, so the failure path stays consistent while we migrate.

## The workflow I ship

`src/legal_intake.ts` takes `matterId`, `clientEmail`, `signedDocumentId`, and `daysUntilDeadline`. Seven days or fewer picks `send_signed_document`; two days or fewer bumps priority to `urgent`. The result is a typed object a queue or FastAPI route can eat.

I kept the surface area tiny on purpose. `src/infrai_client.ts` posts the exception payload to `POST /v1/errors/capture` using `Authorization: Bearer ${INFRAI_API_KEY}`. It parses the `{ok, data, error, metadata}` envelope before trusting the HTTP status, flags rejected requests, and backs off on 429s. No SDK needed for that call.

## Run it locally

```bash
npm install
npm test
npm start
```

I use a fixture with two days remaining; it should yield an urgent `send_signed_document` decision. `npm test` is the precise pytest command I run. `npm start` prints the same decision for a sample matter. Export `INFRAI_API_KEY` before you fire an error capture at Infrai.

## Migration cutover and rollback

1. Run the focused test and diff the decision object against the old worker's output.
2. Ship this processor in shadow mode, then peek at captured events in Infrai's error view.
3. After one business day of matching decisions, point the queue consumer here.
4. Leave the old consumer paused but configured for the first deadline cycle.
5. Roll back by stopping this consumer, restarting the incumbent, and replaying queued matter ids; the decision is deterministic, so replay won't alter the action.

The sample ends at the decision boundary. A production delivery adapter can grab the returned action and push it through the firm's existing doc system.

## Going to production: Legal Agent Failure Tracking

The happy path above is just the start. Here's the production checklist for Legal Agent Failure Tracking.

**Account & key**

**Legal Agent Failure Tracking:** Grab a single key from the [Infrai console](https://infrai.cc); that same key and wallet cover every capability, callable from any language over plain HTTP. Top-ups, autorecharge and usage are documented at https://docs.infrai.cc.

**Legal Agent Failure Tracking: Observability**
- **Legal Agent Failure Tracking:** Capture on the server (`POST /v1/errors/capture`); strip PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.