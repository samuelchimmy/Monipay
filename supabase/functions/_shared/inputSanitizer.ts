// _shared/inputSanitizer.ts
// Pre-AI gate: sanitize and validate user input before it touches any prompt.

export interface SanitizeResult {
  safe: boolean;
  cleaned: string;
  threatCategory?: string;
  threatDetail?: string;
}

// ── Injection signal patterns ────────────────────────────────────────────────
// Each pattern maps to a threat category. If any match, input is REJECTED.
const INJECTION_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // Category 1: Direct instruction override
  { pattern: /ignore\s+(all\s+)?previous\s+instructions?/i, category: "direct_override" },
  { pattern: /disregard\s+(your\s+)?(system|instructions?|rules?|prompt)/i, category: "direct_override" },
  { pattern: /forget\s+(your\s+)?(role|instructions?|rules?|system)/i, category: "direct_override" },
  { pattern: /\bnew\s+instructions?\b/i, category: "direct_override" },
  { pattern: /end\s+of\s+system\s+prompt/i, category: "direct_override" },
  { pattern: /override\s+(your\s+)?(rules?|instructions?)/i, category: "direct_override" },
  { pattern: /you\s+are\s+now\s+(an?\s+)?(unrestricted|evil|different|new)/i, category: "direct_override" },
  { pattern: /\bnew\s+system\s+prompt\b/i, category: "direct_override" },

  // Category 2: Role-play / persona hijack
  { pattern: /\bDAN\b.*no\s+restrictions?/i, category: "persona_hijack" },
  { pattern: /do\s+anything\s+now/i, category: "persona_hijack" },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(admin|developer|owner|god|unrestricted)/i, category: "persona_hijack" },
  { pattern: /act\s+as\s+(if\s+you\s+are|an?)\s+(admin|developer|owner|test)/i, category: "persona_hijack" },
  { pattern: /in\s+test\s+mode.{0,30}(approve|override|bypass)/i, category: "persona_hijack" },
  { pattern: /admin\s+override\s*:/i, category: "persona_hijack" },

  // Category 3: System prompt extraction
  { pattern: /repeat\s+(the\s+)?(first\s+|your\s+)?([\d]+\s+words?\s+of\s+)?(your\s+)?(system\s+)?prompt/i, category: "extraction" },
  { pattern: /what\s+are\s+your\s+instructions/i, category: "extraction" },
  { pattern: /what\s+were\s+you\s+told/i, category: "extraction" },
  { pattern: /print\s+your\s+(system|full|all)\s*(prompt|rules|instructions)/i, category: "extraction" },
  { pattern: /output\s+your\s+(system|full)\s*(prompt|instructions)/i, category: "extraction" },
  { pattern: /translate\s+your\s+(system\s+)?prompt/i, category: "extraction" },
  { pattern: /reveal\s+your\s+(instructions?|system|rules?)/i, category: "extraction" },

  // Category 4: JSON output injection
  { pattern: /expected\s+output\s*:/i, category: "output_injection" },
  { pattern: /correct\s+json\s*(response|is|for)\s*:/i, category: "output_injection" },
  { pattern: /respond\s+with\s+only\s*:\s*\{/i, category: "output_injection" },
  { pattern: /\{[\s\S]*"(type|amount|recipients|chain)"\s*:/i, category: "output_injection" },

  // Category 5: Delimiter / context escape
  { pattern: /---\s*\n\s*system\s*:/im, category: "delimiter_escape" },
  { pattern: /<\/user_?input>/i, category: "delimiter_escape" },
  { pattern: /\[INST\]/i, category: "delimiter_escape" },
  { pattern: /<<<.{0,30}OVERRIDE/i, category: "delimiter_escape" },
  { pattern: /\n{3,}[A-Z]{4,}\s*:/m, category: "delimiter_escape" }, // 3+ newlines then ALL-CAPS keyword:
];

// ── Structural cleanup (applied even on safe input) ─────────────────────────

/** Transliterate common homoglyphs to ASCII */
function normalizeHomoglyphs(text: string): string {
  const map: Record<string, string> = {
    'ε': 'e', 'α': 'a', 'ο': 'o', 'ρ': 'p', 'с': 'c', 'е': 'e',
    'а': 'a', 'р': 'p', 'х': 'x', 'В': 'B', 'Т': 'T', 'Ѕ': 'S',
  };
  return text.split('').map(c => map[c] ?? c).join('');
}

/** Strip HTML/XML comment sequences */
function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?\w[^>]*>/g, '');
}

/** Strip suspicious multi-line JSON blobs from user text */
function stripInlineJson(text: string): string {
  // Remove standalone JSON objects that look like injected output
  return text.replace(/\n\s*\{[\s\S]{20,}\}/g, '').trim();
}

/** Collapse excessive whitespace/newlines */
function normalizeWhitespace(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').replace(/\s{3,}/g, ' ').trim();
}

// ── Public API ───────────────────────────────────────────────────────────────

export function sanitizeUserInput(raw: string): SanitizeResult {
  if (!raw || typeof raw !== 'string') {
    return { safe: false, cleaned: '', threatCategory: 'invalid', threatDetail: 'Empty or non-string input' };
  }

  // Hard length cap — legitimate payment commands are never >500 chars
  if (raw.length > 500) {
    return {
      safe: false,
      cleaned: '',
      threatCategory: 'length_exceeded',
      threatDetail: `Input length ${raw.length} exceeds 500 char cap`,
    };
  }

  // Structural cleanup (non-destructive to legitimate input)
  let cleaned = normalizeHomoglyphs(raw);
  cleaned = stripHtmlComments(cleaned);
  cleaned = stripInlineJson(cleaned);
  cleaned = normalizeWhitespace(cleaned);

  // Injection pattern scan
  for (const { pattern, category } of INJECTION_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      return {
        safe: false,
        cleaned,
        threatCategory: category,
        threatDetail: `Matched pattern: "${match[0].substring(0, 60)}"`,
      };
    }
  }

  return { safe: true, cleaned };
}
