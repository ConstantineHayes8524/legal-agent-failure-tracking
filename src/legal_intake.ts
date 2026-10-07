import { z } from "zod";
import { captureException } from "./infrai_client.js";

export const intakeSchema = z.object({
  matterId: z.string().min(1),
  clientEmail: z.string().email(),
  signedDocumentId: z.string().min(1),
  daysUntilDeadline: z.number().int().nonnegative()
});

export type Intake = z.infer<typeof intakeSchema>;

export type FollowUp = { matterId: string; action: "send_signed_document" | "schedule_deadline_follow_up"; priority: "normal" | "urgent" };

export function decideFollowUp(input: Intake): FollowUp {
  const priority = input.daysUntilDeadline <= 2 ? "urgent" : "normal";
  const action = input.daysUntilDeadline <= 7 ? "send_signed_document" : "schedule_deadline_follow_up";
  return { matterId: input.matterId, action, priority };
}

export async function processMatter(raw: unknown): Promise<FollowUp> {
  try {
    const input = intakeSchema.parse(raw);
    return decideFollowUp(input);
  } catch (error) {
    await captureException({ name: "matter_follow_up_failed", input: raw, error });
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { matterId: "MAT-104", clientEmail: "counsel@example.com", signedDocumentId: "DOC-88", daysUntilDeadline: 3 };
  processMatter(sample).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error); process.exitCode = 1; });
}
