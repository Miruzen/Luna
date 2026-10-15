// Projection policies: per capability, exactly what an executor may receive (default deny).
// Add a capability here only when LUNA can actually propose it.
import { validateEventArgs } from "../calendar/validate.ts";
import type { ProjectionPolicy } from "./projection.ts";

export const CALENDAR_CREATE_POLICY: ProjectionPolicy = {
  capability: "calendar.events.create",
  outward: true,
  objective: "Create a Google Calendar event using exactly the given inputs.",
  expectedOutput: "The created event id and link.",
  requiredInputs: ["title", "start_datetime", "end_datetime", "timezone"],
  optionalInputs: ["description", "attendees"],
  constraints: [
    "Use the inputs exactly; do not reinterpret or change dates, times or the title.",
    "Do not invite anyone not listed in inputs.attendees.",
  ],
  allowedContextKinds: [], // personal context, raw utterance and history are not needed
  findContradictions: (inputs) => {
    const v = validateEventArgs(inputs);
    return v.ok ? [] : v.errors;
  },
};

export const POLICIES: Record<string, ProjectionPolicy> = {
  [CALENDAR_CREATE_POLICY.capability]: CALENDAR_CREATE_POLICY,
};
