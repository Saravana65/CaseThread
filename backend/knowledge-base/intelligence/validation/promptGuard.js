/**
 * @file promptGuard.js
 * @brief Security guard for natural language input & RAG prompt injection mitigation.
 * Neutralizes jailbreak patterns, instruction override attempts, and unauthorized data leakage probes.
 * @project CASETHREAD
 */

class PromptGuard {
  static INJECTION_PATTERNS = [
    /ignore\s+(?:all\s+)?previous\s+instructions/i,
    /bypass\s+(?:security|classification|clearance|rules)/i,
    /disclose\s+(?:confidential|secret|system\s+prompt)/i,
    /you\s+are\s+now\s+(?:DAN|unfiltered|jailbroken)/i,
    /drop\s+table/i,
    /<script[\s\S]*?>/i,
    /system\s*:\s*override/i
  ];

  /**
   * Validates and sanitizes an investigator query.
   * @param {string} rawQuery
   * @returns {{ safeQuery: string, isSanitized: boolean, flaggedPatterns: string[] }}
   */
  static inspectAndSanitize(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return { safeQuery: '', isSanitized: false, flaggedPatterns: [] };
    }

    let query = rawQuery.trim();
    if (query.length > 2000) {
      query = query.slice(0, 2000);
    }

    const flagged = [];
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(query)) {
        flagged.push(pattern.source);
        query = query.replace(pattern, '[REDACTED_SECURITY_PROBE]');
      }
    }

    // Strip unprintable control characters and dangerous delimiters
    const safe = query
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      .replace(/[<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      safeQuery: safe,
      isSanitized: flagged.length > 0,
      flaggedPatterns: flagged
    };
  }

  /**
   * Wraps retrieved context strings so LLMs or reasoning models treat them strictly as data, not instructions.
   */
  static wrapUntrustedContext(text) {
    if (!text || typeof text !== 'string') return '';
    return `<<<EVIDENCE_RECORD_DATA_START>>>\n${text.replace(/<<<|>>>/g, '')}\n<<<EVIDENCE_RECORD_DATA_END>>>`;
  }
}

module.exports = PromptGuard;
