import { decideFollowUp, intakeSchema } from "./legal_intake.js";
import { processMatter } from "./legal_intake.js";

const input = intakeSchema.parse({ matterId: "MAT-1", clientEmail: "lawyer@example.com", signedDocumentId: "DOC-1", daysUntilDeadline: 2 });
const decision = decideFollowUp(input);
if (decision.action !== "send_signed_document" || decision.priority !== "urgent") {
  throw new Error(`unexpected decision: ${JSON.stringify(decision)}`);
}
console.log("legal deadline decision passed");

process.env.INFRAI_API_KEY = "test-key";
const originalFetch = globalThis.fetch;
let captured: unknown;
globalThis.fetch = async (_url, options) => {
  captured = JSON.parse(String(options?.body));
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
try {
  await processMatter({ matterId: "MAT-1", clientEmail: "invalid", signedDocumentId: "DOC-1", daysUntilDeadline: 2 })
    .then(() => { throw new Error("invalid intake was accepted"); }, (error: unknown) => {
      if (!(error instanceof Error) || error.name !== "ZodError") throw error;
    });
  if (!captured || typeof captured !== "object" || !("exception" in captured)) {
    throw new Error("validation failure was not captured");
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log("validation failure capture passed");
