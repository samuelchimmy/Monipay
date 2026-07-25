import {
  isRecurringCommand,
  parseRecurringCommand,
  validateSyntax,
  isRecurringManagementCommand,
  preprocessRecurringText,
  isOneTimeScheduleCommand,
  parseOneTimeScheduleCommand
} from './recurring.js';

console.log('🧪 Starting Recurring Payments Twitter Bot Tests...');

const testCases = [
  {
    input: '@monibot send $1 to @alice every minute 5 times',
    expectedRecurring: true,
    expectedCount: 5,
    expectedIntervalMs: 60000,
  },
  {
    input: '@monibot pay @bob $5 every day for 1 week',
    expectedRecurring: true,
    expectedCount: 7,
    expectedIntervalMs: 86400000,
  },
  {
    input: '@monibot tip $2 to @charlie daily 5 times',
    expectedRecurring: true,
    expectedCount: 5,
    expectedIntervalMs: 86400000,
  },
  {
    input: '@monibot slide $10 to @dave hourly for 2 days',
    expectedRecurring: true,
    expectedCount: 48,
    expectedIntervalMs: 3600000,
  },
  {
    input: '@monibot send $5 to @alice',
    expectedRecurring: false,
  }
];

let success = true;

for (const tc of testCases) {
  const isRec = isRecurringCommand(tc.input);
  if (isRec !== tc.expectedRecurring) {
    console.error(`❌ Test failed for: "${tc.input}"`);
    console.error(`   Expected isRecurringCommand to be ${tc.expectedRecurring}, got ${isRec}`);
    success = false;
    continue;
  }

  if (tc.expectedRecurring) {
    try {
      const parsed = parseRecurringCommand(tc.input);
      const validated = validateSyntax(parsed);
      if (validated.count !== tc.expectedCount) {
        console.error(`❌ Test failed for: "${tc.input}" (count mismatch)`);
        console.error(`   Expected count: ${tc.expectedCount}, got ${validated.count}`);
        success = false;
      }
      if (validated.intervalMs !== tc.expectedIntervalMs) {
        console.error(`❌ Test failed for: "${tc.input}" (intervalMs mismatch)`);
        console.error(`   Expected intervalMs: ${tc.expectedIntervalMs}, got ${validated.intervalMs}`);
        success = false;
      }
    } catch (e) {
      console.error(`❌ Validation failed for: "${tc.input}" with error: ${e.message}`);
      success = false;
    }
  }
}

// Test Management commands detection
const mgmtTests = [
  { input: '@monibot cancel series abc-123', expected: true },
  { input: '@monibot series status 12345', expected: true },
  { input: '@monibot my series', expected: true },
  { input: '@monibot send $5 to @alice', expected: false },
];

for (const tc of mgmtTests) {
  const isMgmt = isRecurringManagementCommand(tc.input);
  if (isMgmt !== tc.expected) {
    console.error(`❌ Management test failed for: "${tc.input}"`);
    console.error(`   Expected isRecurringManagementCommand to be ${tc.expected}, got ${isMgmt}`);
    success = false;
  }
}

// Test One-time Schedule commands detection
const scheduleTests = [
  { input: '@monibot send $5 to @alice in 5 minutes', expected: true, expectedMs: 300000 },
  { input: '@monibot send $10 to @bob in one hour', expected: true, expectedMs: 3600000 },
  { input: '@monibot send $1 to @charlie in 2 days', expected: true, expectedMs: 172800000 },
  { input: '@monibot send $5 to @alice', expected: false }
];

for (const tc of scheduleTests) {
  const isSched = isOneTimeScheduleCommand(tc.input);
  if (isSched !== tc.expected) {
    console.error(`❌ One-time schedule detection failed for: "${tc.input}"`);
    console.error(`   Expected isOneTimeScheduleCommand to be ${tc.expected}, got ${isSched}`);
    success = false;
  }

  if (tc.expected) {
    const parsed = parseOneTimeScheduleCommand(tc.input);
    if (!parsed || parsed.ms !== tc.expectedMs) {
      console.error(`❌ One-time schedule parsing failed for: "${tc.input}"`);
      console.error(`   Expected ms: ${tc.expectedMs}, got: ${parsed?.ms}`);
      success = false;
    }
  }
}

if (success) {
  console.log('✅ All tests passed successfully!');
} else {
  console.error('❌ Some tests failed.');
  process.exit(1);
}
