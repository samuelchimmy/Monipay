/**
 * Unit Tests for Recurring Payment Parser
 * Tests all parsing scenarios from requirements and design documents
 */

import { describe, it, expect } from 'vitest';
import {
  parseAndValidateRecurring,
  parseRecurringCommand,
  normalizeTimeUnit,
  convertDurationToCount,
  validateSyntax,
  isRecurringCommand,
  inferImplicitCount,
  resolveConflictingParams,
  preprocessRecurringText,
} from './recurringParser.js';
import { detectChain, parseCommand } from '../../commands.js';

describe('recurringParser - Core Parsing', () => {
  describe('parseRecurringCommand', () => {
    it('should parse "every 1 minute 5 times" pattern', () => {
      const result = parseRecurringCommand('send $1 to @alice every 1 minute 5 times');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(60000);
      expect(result.count).toBe(5);
      expect(result.baseCommand).toBe('send $1 to @alice');
    });

    it('should parse "every day for 1 week" pattern', () => {
      const result = parseRecurringCommand('send $5 to @bob every day for 1 week');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(86400000); // 1 day in ms
      expect(result.count).toBe(7); // 1 week = 7 days
      expect(result.baseCommand).toBe('send $5 to @bob');
    });

    it('should parse "daily 5 times" alias pattern', () => {
      const result = parseRecurringCommand('send $10 to @dave daily 5 times');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(86400000); // 1 day
      expect(result.count).toBe(5);
      expect(result.baseCommand).toBe('send $10 to @dave');
    });

    it('should parse "hourly for 2 days" alias pattern', () => {
      const result = parseRecurringCommand('send $3 to @eve hourly for 2 days');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(3600000); // 1 hour
      expect(result.count).toBe(48); // 2 days / 1 hour = 48
      expect(result.baseCommand).toBe('send $3 to @eve');
    });

    it('should parse "every hour for 2 days" pattern', () => {
      const result = parseRecurringCommand('send $2 to @frank every hour for 2 days');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(3600000);
      expect(result.count).toBe(48);
    });

    it('should parse "every 2 hours 10 times" pattern', () => {
      const result = parseRecurringCommand('send $5 every 2 hours 10 times');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(7200000); // 2 hours
      expect(result.count).toBe(10);
    });

    it('should return null for non-recurring commands', () => {
      const result = parseRecurringCommand('send $10 to @alice');
      expect(result).toBeNull();
    });

    it('should throw error for day-of-week patterns', () => {
      expect(() => {
        parseRecurringCommand('send $5 to @bob every Monday 5 times');
      }).toThrow('DOW scheduling not supported in v1');
    });

    it('should handle case-insensitive input', () => {
      const result = parseRecurringCommand('SEND $1 TO @ALICE EVERY 1 MINUTE 5 TIMES');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(60000);
      expect(result.count).toBe(5);
    });
  });

  describe('normalizeTimeUnit', () => {
    it('should normalize "min" to "minute"', () => {
      expect(normalizeTimeUnit('min')).toBe('minute');
      expect(normalizeTimeUnit('mins')).toBe('minute');
      expect(normalizeTimeUnit('minutes')).toBe('minute');
    });

    it('should normalize "hr" to "hour"', () => {
      expect(normalizeTimeUnit('hr')).toBe('hour');
      expect(normalizeTimeUnit('hrs')).toBe('hour');
      expect(normalizeTimeUnit('hours')).toBe('hour');
    });

    it('should normalize "d" to "day"', () => {
      expect(normalizeTimeUnit('d')).toBe('day');
      expect(normalizeTimeUnit('days')).toBe('day');
    });

    it('should handle case-insensitive input', () => {
      expect(normalizeTimeUnit('MIN')).toBe('minute');
      expect(normalizeTimeUnit('HRS')).toBe('hour');
    });
  });

  describe('convertDurationToCount', () => {
    it('should convert 1 week with daily interval to 7', () => {
      const count = convertDurationToCount(1, 'week', 86400000);
      expect(count).toBe(7);
    });

    it('should convert 2 days with hourly interval to 48', () => {
      const count = convertDurationToCount(2, 'days', 3600000);
      expect(count).toBe(48);
    });

    it('should convert 1 hour with minute interval to 60', () => {
      const count = convertDurationToCount(1, 'hour', 60000);
      expect(count).toBe(60);
    });

    it('should throw error for invalid duration value', () => {
      expect(() => {
        convertDurationToCount(0, 'day', 60000);
      }).toThrow('Invalid duration value');
    });

    it('should throw error for unknown unit', () => {
      expect(() => {
        convertDurationToCount(1, 'fortnight', 60000);
      }).toThrow('Unknown duration unit');
    });
  });
});

describe('recurringParser - Validation', () => {
  describe('validateSyntax', () => {
    it('should pass valid parameters', () => {
      const input = { intervalMs: 60000, count: 5 };
      const result = validateSyntax(input);
      expect(result.intervalMs).toBe(60000);
      expect(result.count).toBe(5);
      expect(result.warnings).toEqual([]);
    });

    it('should upgrade sub-60-second intervals to 60 seconds', () => {
      const input = { intervalMs: 30000, count: 5 };
      const result = validateSyntax(input);
      expect(result.intervalMs).toBe(60000);
      expect(result.warnings).toContain('Blud tried to go sub-60 seconds 💀');
    });

    it('should throw error for count exceeding 100', () => {
      const input = { intervalMs: 60000, count: 101 };
      expect(() => validateSyntax(input)).toThrow(
        'Whoa there sigma! 🛑 Max 100 payments per series'
      );
    });

    it('should throw error for duration exceeding 30 days', () => {
      const input = { intervalMs: 86400000, count: 31 }; // 31 days
      expect(() => validateSyntax(input)).toThrow(
        '30-day max span, chief'
      );
    });

    it('should round decimal intervals', () => {
      const input = { intervalMs: 60000.5, count: 5 };
      const result = validateSyntax(input);
      expect(result.intervalMs).toBe(60000);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('recurringParser - Integration Tests', () => {
  describe('parseAndValidateRecurring', () => {
    it('should parse and validate "every 1 minute 5 times"', () => {
      const result = parseAndValidateRecurring('send $1 to @alice every 1 minute 5 times');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(60000);
      expect(result.count).toBe(5);
      expect(result.baseCommand).toBe('send $1 to @alice');
    });

    it('should upgrade sub-60-second intervals and warn', () => {
      const result = parseAndValidateRecurring('send $2 to @charlie every 30 seconds 3 times');
      expect(result).toBeTruthy();
      expect(result.intervalMs).toBe(60000); // Upgraded to 60s
      expect(result.count).toBe(3);
      expect(result.warnings).toContain('Blud tried to go sub-60 seconds 💀');
    });

    it('should return null for non-recurring commands', () => {
      const result = parseAndValidateRecurring('send $10 to @alice');
      expect(result).toBeNull();
    });

    it('should throw error for DOW patterns', () => {
      expect(() => {
        parseAndValidateRecurring('send $5 every Monday 5 times');
      }).toThrow('DOW scheduling not supported in v1');
    });
  });

  describe('isRecurringCommand', () => {
    it('should return true for recurring command patterns', () => {
      expect(isRecurringCommand('send $1 every minute 5 times')).toBe(true);
      expect(isRecurringCommand('send $5 daily 10 times')).toBe(true);
      expect(isRecurringCommand('send $3 hourly for 2 days')).toBe(true);
    });

    it('should return false for non-recurring commands', () => {
      expect(isRecurringCommand('send $10 to @alice')).toBe(false);
      expect(isRecurringCommand('balance')).toBe(false);
      expect(isRecurringCommand('')).toBe(false);
    });
  });
});

describe('recurringParser - Edge Cases', () => {
  describe('inferImplicitCount', () => {
    it('should infer missing "times" keyword', () => {
      const result = inferImplicitCount('every day 5');
      expect(result).toBe('every day 5 times');
    });

    it('should handle "every 2 hours 10" pattern', () => {
      const result = inferImplicitCount('every 2 hours 10');
      expect(result).toBe('every 2 hours 10 times');
    });

    it('should not modify already correct syntax', () => {
      const result = inferImplicitCount('every day 5 times');
      expect(result).toBe('every day 5 times');
    });
  });

  describe('resolveConflictingParams', () => {
    it('should prioritize count over duration when both present', () => {
      const result = resolveConflictingParams('every day 5 times for 2 weeks');
      expect(result).not.toContain('for 2 weeks');
      expect(result).toContain('5 times');
    });

    it('should not modify commands with only count', () => {
      const result = resolveConflictingParams('every day 5 times');
      expect(result).toBe('every day 5 times');
    });

    it('should not modify commands with only duration', () => {
      const result = resolveConflictingParams('every day for 1 week');
      expect(result).toBe('every day for 1 week');
    });
  });

  describe('preprocessRecurringText', () => {
    it('should apply all preprocessing steps', () => {
      const result = preprocessRecurringText('every day 5 for 1 week');
      expect(result).toBe('every day 5 times');
    });

    it('should handle null input gracefully', () => {
      const result = preprocessRecurringText(null);
      expect(result).toBeNull();
    });
  });
});

describe('recurringParser - Requirement Validations', () => {
  it('Requirement 1.1: extracts interval "60000ms" and count "5" from "every 1 minute 5 times"', () => {
    const result = parseAndValidateRecurring('send $1 to @alice every 1 minute 5 times');
    expect(result.intervalMs).toBe(60000);
    expect(result.count).toBe(5);
  });

  it('Requirement 1.2: converts "every day for 1 week" to count "7"', () => {
    const result = parseAndValidateRecurring('send $5 to @bob every day for 1 week');
    expect(result.intervalMs).toBe(86400000);
    expect(result.count).toBe(7);
  });

  it('Requirement 1.3: upgrades "every 30 seconds 3 times" to 60000ms with warning', () => {
    const result = parseAndValidateRecurring('send $2 to @charlie every 30 seconds 3 times');
    expect(result.intervalMs).toBe(60000);
    expect(result.warnings).toContain('Blud tried to go sub-60 seconds 💀');
  });

  it('Requirement 1.4: normalizes "daily 5 times" to "every 1 day 5 times"', () => {
    const result = parseAndValidateRecurring('send $10 to @dave daily 5 times');
    expect(result.intervalMs).toBe(86400000);
    expect(result.count).toBe(5);
  });

  it('Requirement 1.5: calculates "every hour for 2 days" as count "48"', () => {
    const result = parseAndValidateRecurring('send $1 every hour for 2 days');
    expect(result.intervalMs).toBe(3600000);
    expect(result.count).toBe(48);
  });

  it('Requirement 1.6: rejects "every Monday 5 times" with DOW error', () => {
    expect(() => {
      parseAndValidateRecurring('send $1 every Monday 5 times');
    }).toThrow('DOW scheduling not supported in v1');
  });
});

describe('recurringParser - Additional Patterns', () => {
  it('should parse "weekly 4 times"', () => {
    const result = parseAndValidateRecurring('send $20 weekly 4 times');
    expect(result.intervalMs).toBe(604800000); // 1 week
    expect(result.count).toBe(4);
  });

  it('should parse "every 3 days 10 times"', () => {
    const result = parseAndValidateRecurring('send $15 every 3 days 10 times');
    expect(result.intervalMs).toBe(259200000); // 3 days
    expect(result.count).toBe(10);
  });

  it('should parse "every week for 1 month"', () => {
    const result = parseAndValidateRecurring('send $50 every week for 1 month');
    expect(result.intervalMs).toBe(604800000); // 1 week
    expect(result.count).toBe(4); // ~4 weeks in a month
  });

  it('should handle very short intervals and upgrade them', () => {
    const result = parseAndValidateRecurring('send $1 every 5 seconds 10 times');
    expect(result.intervalMs).toBe(60000); // Upgraded to 60s
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('detectChain', () => {
  it('should detect celo keywords', () => {
    expect(detectChain('send $5 on celo every minute')).toBe('celo');
    expect(detectChain('send $5 with minipay daily')).toBe('celo');
  });

  it('should detect base keywords', () => {
    expect(detectChain('send $5 on base every hour')).toBe('base');
  });

  it('should return null when no chain specified', () => {
    expect(detectChain('send $5 to @alice every week')).toBeNull();
  });
});

describe('recurringParser - Advanced Scenarios', () => {
  it('should parse "for a/an <unit>" modifiers', () => {
    const result1 = parseAndValidateRecurring('send $5 to @bob every day for a week');
    expect(result1.intervalMs).toBe(86400000);
    expect(result1.count).toBe(7);
    expect(result1.baseCommand).toBe('send $5 to @bob');

    const result2 = parseAndValidateRecurring('send $5 to @bob every minute for an hour');
    expect(result2.intervalMs).toBe(60000);
    expect(result2.count).toBe(60);
    expect(result2.baseCommand).toBe('send $5 to @bob');
  });

  it('should parse optional spacing (no space between digit and unit)', () => {
    const result1 = parseAndValidateRecurring('send $5 to @bob every 30m 5 times');
    expect(result1.intervalMs).toBe(1800000);
    expect(result1.count).toBe(5);
    expect(result1.baseCommand).toBe('send $5 to @bob');

    const result2 = parseAndValidateRecurring('send $5 to @bob every 2h for 2d');
    expect(result2.intervalMs).toBe(7200000);
    expect(result2.count).toBe(24);
    expect(result2.baseCommand).toBe('send $5 to @bob');

    const result3 = parseAndValidateRecurring('send $5 to @bob every 1 minute for 5times');
    expect(result3.intervalMs).toBe(60000);
    expect(result3.count).toBe(5);

    const result4 = parseAndValidateRecurring('send $5 to @bob daily for 5days');
    expect(result4.intervalMs).toBe(86400000);
    expect(result4.count).toBe(5);
  });

  it('should parse month abbreviations mo and mos', () => {
    const result = parseRecurringCommand('send $5 to @bob every 1mo 5 times');
    expect(result.intervalMs).toBe(2592000000);
    expect(result.count).toBe(5);
  });

  it('should parse "every 1 minute for 5 times" (using for in pattern1)', () => {
    const result = parseAndValidateRecurring('send $5 to @bob every 1 minute for 5 times');
    expect(result.intervalMs).toBe(60000);
    expect(result.count).toBe(5);
  });
});

describe('commands - parseCommand Routing', () => {
  it('should route advanced every-patterns to recurring type', () => {
    const result1 = parseCommand('!monibot send $5 to @bob every day for a week');
    expect(result1).toBeTruthy();
    expect(result1.type).toBe('recurring');

    const result2 = parseCommand('!monibot send $5 to @bob every minute for an hour');
    expect(result2).toBeTruthy();
    expect(result2.type).toBe('recurring');

    const result3 = parseCommand('!monibot send $5 to @bob every 30m 5 times');
    expect(result3).toBeTruthy();
    expect(result3.type).toBe('recurring');

    const result4 = parseCommand('!monibot send $5 to @bob every 2h for 2d');
    expect(result4).toBeTruthy();
    expect(result4.type).toBe('recurring');
  });

  it('should route advanced alias-patterns to recurring type', () => {
    const result1 = parseCommand('!monibot send $5 to @bob daily for a week');
    expect(result1).toBeTruthy();
    expect(result1.type).toBe('recurring');

    const result2 = parseCommand('!monibot send $5 to @bob weekly for 5times');
    expect(result2).toBeTruthy();
    expect(result2.type).toBe('recurring');
  });

  it('should route scheduled general commands (non-payments) to recurring type', () => {
    const result1 = parseCommand('!monibot balance every minute 5 times');
    expect(result1).toBeTruthy();
    expect(result1.type).toBe('recurring');

    const result2 = parseCommand('!monibot help daily for a week');
    expect(result2).toBeTruthy();
    expect(result2.type).toBe('recurring');
  });
});
