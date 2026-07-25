// _shared/outputValidator.ts
// Post-AI schema enforcement. Prevent hallucinated or injected AI outputs
// from ever reaching the payment relay or scheduler.

export interface ParsedCommand {
  type: string | null;
  amount: number | null;
  recipients: string[];
  chain: string;
  maxParticipants: number | null;
  _rejected?: string;
}

const ALLOWED_TYPES = new Set([
  "p2p", "p2p_multi", "giveaway", "balance", "help", "link", "chat", null,
]);

const ALLOWED_CHAINS = new Set([
  "base", "bsc", "celo", "ink", "solana", "tempo",
]);

const FORBIDDEN_RECIPIENTS = new Set([
  "monibot", "monipay", "everyone", "here", "bot", "admin",
]);

// Hard limits — if AI hallucinates beyond these, reject.
const MAX_AMOUNT = 10_000;
const MAX_RECIPIENTS = 50;
const MAX_PARTICIPANTS = 500;

export interface ValidationResult {
  valid: boolean;
  command?: ParsedCommand;
  reason?: string;
}

export function validateParsedCommand(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, reason: "Non-object AI output" };
  }

  const r = raw as Record<string, unknown>;

  // Check for injection detection flag set by the AI itself
  if (r._rejected) {
    return { valid: false, reason: `AI self-flagged: ${r._rejected}` };
  }

  // Type validation
  const type = r.type as string | null;
  if (!ALLOWED_TYPES.has(type)) {
    return { valid: false, reason: `Invalid type: "${type}"` };
  }

  // Chain validation
  const chain = (r.chain as string ?? "base").toLowerCase();
  if (!ALLOWED_CHAINS.has(chain)) {
    return { valid: false, reason: `Invalid chain: "${chain}"` };
  }

  // Amount validation
  const amount = r.amount as number | null;
  if (amount !== null) {
    if (typeof amount !== "number" || isNaN(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return { valid: false, reason: `Invalid amount: ${amount}` };
    }
  }

  // Recipients validation
  const recipients = (r.recipients as string[] | null) ?? [];
  if (!Array.isArray(recipients)) {
    return { valid: false, reason: "recipients must be an array" };
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return { valid: false, reason: `Too many recipients: ${recipients.length}` };
  }

  // Sanitize recipient names — must be alphanumeric/underscore/hyphen only
  const cleanedRecipients = recipients
    .filter((rec) => typeof rec === "string")
    .map((rec) => rec.toLowerCase().replace(/[^a-z0-9_-]/g, "").substring(0, 50))
    .filter((rec) => rec.length > 0 && !FORBIDDEN_RECIPIENTS.has(rec));

  // Participants
  const maxParticipants = r.maxParticipants as number | null;
  if (maxParticipants !== null) {
    if (typeof maxParticipants !== "number" || maxParticipants <= 0 || maxParticipants > MAX_PARTICIPANTS) {
      return { valid: false, reason: `Invalid maxParticipants: ${maxParticipants}` };
    }
  }

  // Business logic coherence checks
  if ((type === "p2p" || type === "p2p_multi") && amount === null) {
    return { valid: false, reason: "P2P command missing amount" };
  }
  if ((type === "p2p" || type === "p2p_multi") && cleanedRecipients.length === 0) {
    return { valid: false, reason: "P2P command missing recipients" };
  }
  if (type === "giveaway" && (amount === null || maxParticipants === null)) {
    return { valid: false, reason: "Giveaway missing amount or maxParticipants" };
  }

  return {
    valid: true,
    command: {
      type,
      amount,
      recipients: cleanedRecipients,
      chain: chain as any,
      maxParticipants,
    },
  };
}

export function validateScheduleOutput(raw: unknown): { valid: boolean; reason?: string } {
  if (!raw || typeof raw !== "object") return { valid: false, reason: "Non-object" };
  const r = raw as Record<string, unknown>;

  if (r._rejected) return { valid: false, reason: `AI self-flagged: ${r._rejected}` };

  if (r.hasSchedule === true) {
    const ts = r.scheduledAt as string;
    if (!ts || typeof ts !== "string") return { valid: false, reason: "Missing scheduledAt" };
    const d = new Date(ts);
    if (isNaN(d.getTime())) return { valid: false, reason: "Invalid ISO timestamp" };
    const delta = d.getTime() - Date.now();
    if (delta < 60_000) return { valid: false, reason: "scheduledAt too soon (<60s)" };
    if (delta > 30 * 86_400_000) return { valid: false, reason: "scheduledAt too far (>30 days)" };
  }

  const allowedRules = new Set([
    "minute","hour","day","week","month",
    "monday","tuesday","wednesday","thursday","friday","saturday","sunday",
  ]);
  if (r.recurrenceRule && !allowedRules.has(r.recurrenceRule as string)) {
    return { valid: false, reason: `Invalid recurrenceRule: "${r.recurrenceRule}"` };
  }

  return { valid: true };
}
