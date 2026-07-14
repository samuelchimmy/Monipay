// src/security/inputSanitizer.js
const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions?/i, category: "direct_override" },
  { pattern: /disregard\s+(your\s+)?(system|instructions?|rules?|prompt)/i, category: "direct_override" },
  { pattern: /forget\s+(your\s+)?(role|instructions?|rules?|system)/i, category: "direct_override" },
  { pattern: /\bnew\s+instructions?\b/i, category: "direct_override" },
  { pattern: /end\s+of\s+system\s+prompt/i, category: "direct_override" },
  { pattern: /you\s+are\s+now\s+(an?\s+)?(unrestricted|evil|different|new)/i, category: "direct_override" },
  { pattern: /\bnew\s+system\s+prompt\b/i, category: "direct_override" },
  { pattern: /do\s+anything\s+now/i, category: "persona_hijack" },
  { pattern: /pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(admin|developer|owner|unrestricted)/i, category: "persona_hijack" },
  { pattern: /act\s+as\s+(if\s+you\s+are|an?)\s+(admin|developer|owner)/i, category: "persona_hijack" },
  { pattern: /admin\s+override\s*:/i, category: "persona_hijack" },
  { pattern: /repeat\s+(the\s+)?(first\s+|your\s+)?([\d]+\s+words?\s+of\s+)?(your\s+)?(system\s+)?prompt/i, category: "extraction" },
  { pattern: /what\s+are\s+your\s+instructions/i, category: "extraction" },
  { pattern: /what\s+were\s+you\s+told/i, category: "extraction" },
  { pattern: /print\s+your\s+(system|full|all)\s*(prompt|rules|instructions)/i, category: "extraction" },
  { pattern: /expected\s+output\s*:/i, category: "output_injection" },
  { pattern: /respond\s+with\s+only\s*:\s*\{/i, category: "output_injection" },
  { pattern: /\{[\s\S]*"(type|amount|recipients|chain)"\s*:/i, category: "output_injection" },
  { pattern: /---\s*\n\s*system\s*:/im, category: "delimiter_escape" },
  { pattern: /<\/user_?input>/i, category: "delimiter_escape" },
  { pattern: /\[INST\]/i, category: "delimiter_escape" },
];

export function sanitizeUserInput(raw) {
  if (!raw || typeof raw !== 'string') return { safe: false, cleaned: '' };
  if (raw.length > 500) return { safe: false, cleaned: '', threatCategory: 'length_exceeded' };

  let cleaned = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\n{3,}/g, '\n\n').trim();

  for (const { pattern, category } of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { safe: false, cleaned, threatCategory: category };
    }
  }
  return { safe: true, cleaned };
}
