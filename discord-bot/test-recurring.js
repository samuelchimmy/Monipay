/**
 * Test script for recurring payment feature
 */

import { parseRecurringCommand, validateSyntax, extractBaseCommand } from './src/parsers/recurringParser.js';
import { validateRecurringPayment, calculateSeriesCost } from './src/validators/recurringValidator.js';

console.log('🧪 Testing Recurring Payment Feature\n');
console.log('=' .repeat(60));

// Test cases
const testCases = [
  {
    name: 'Basic numeric interval',
    input: 'send $1 to @alice every 1 minute 5 times',
    expected: { intervalMs: 60000, count: 5 },
  },
  {
    name: 'Duration conversion',
    input: 'send $5 to @bob every day for 1 week',
    expected: { intervalMs: 86400000, count: 7 },
  },
  {
    name: 'Hourly alias',
    input: 'send $2 to @charlie hourly for 2 days',
    expected: { intervalMs: 3600000, count: 48 },
  },
  {
    name: 'Daily alias',
    input: 'send $10 to @dave daily 5 times',
    expected: { intervalMs: 86400000, count: 5 },
  },
  {
    name: 'Sub-60 second interval (should upgrade)',
    input: 'send $1 to @eve every 30 seconds 3 times',
    expected: { intervalMs: 60000, count: 3, warning: true },
  },
  {
    name: 'Multi-recipient recurring',
    input: 'send $1 each to @alice, @bob every hour 10 times',
    expected: { intervalMs: 3600000, count: 10 },
  },
];

console.log('\n📝 PARSER TESTS\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, idx) => {
  console.log(`Test ${idx + 1}: ${test.name}`);
  console.log(`Input: "${test.input}"`);
  
  const result = parseRecurringCommand(test.input);
  const validation = validateSyntax(result);
  
  if (result && validation.ok) {
    const matchesExpected = 
      result.intervalMs === test.expected.intervalMs &&
      result.count === test.expected.count;
    
    if (matchesExpected) {
      console.log('✅ PASS');
      passed++;
    } else {
      console.log('❌ FAIL - Mismatch');
      console.log('Expected:', test.expected);
      console.log('Got:', { intervalMs: result.intervalMs, count: result.count });
      failed++;
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️  Warnings:', result.warnings);
    }
  } else {
    console.log('❌ FAIL - Invalid parse or validation');
    console.log('Result:', result);
    console.log('Validation:', validation);
    failed++;
  }
  
  console.log('---\n');
});

console.log('\n🔍 VALIDATOR TESTS\n');

// Test validation
const validationTests = [
  {
    name: 'Valid series (5 payments, 1 minute interval)',
    config: { intervalMs: 60000, count: 5, amount: 1, recipients: [], chain: 'base' },
    shouldPass: true,
  },
  {
    name: 'Too many payments (150 > 100 max)',
    config: { intervalMs: 60000, count: 150, amount: 1, recipients: [], chain: 'base' },
    shouldPass: false,
  },
  {
    name: 'Interval too short (30s < 60s min)',
    config: { intervalMs: 30000, count: 5, amount: 1, recipients: [], chain: 'base' },
    shouldPass: false,
  },
  {
    name: 'Series too long (31 days > 30 days max)',
    config: { intervalMs: 86400000, count: 31, amount: 1, recipients: [], chain: 'base' },
    shouldPass: false,
  },
  {
    name: 'Multi-recipient cost calculation',
    config: { intervalMs: 60000, count: 5, amount: 10, recipients: ['alice', 'bob', 'charlie'], chain: 'base' },
    shouldPass: true,
    expectedCost: 150, // 10 * 5 * 3
  },
];

validationTests.forEach((test, idx) => {
  console.log(`Validation Test ${idx + 1}: ${test.name}`);
  
  const result = validateRecurringPayment(test.config);
  
  if (test.shouldPass && result.ok) {
    console.log('✅ PASS - Valid as expected');
    if (test.expectedCost) {
      const actualCost = calculateSeriesCost(test.config.amount, test.config.count, test.config.recipients);
      if (actualCost === test.expectedCost) {
        console.log(`✅ Cost calculation correct: $${actualCost}`);
      } else {
        console.log(`❌ Cost mismatch: expected $${test.expectedCost}, got $${actualCost}`);
        failed++;
      }
    }
    passed++;
  } else if (!test.shouldPass && !result.ok) {
    console.log('✅ PASS - Correctly rejected');
    console.log('Errors:', result.errors);
    passed++;
  } else {
    console.log('❌ FAIL');
    console.log('Expected:', test.shouldPass ? 'valid' : 'invalid');
    console.log('Got:', result);
    failed++;
  }
  
  console.log('---\n');
});

console.log('\n📊 BASE COMMAND EXTRACTION TESTS\n');

// Test base command extraction
const extractionTests = [
  {
    input: 'send $5 to @alice every day 5 times',
    expected: 'send $5 to @alice',
  },
  {
    input: 'send $1 each to @a, @b every hour for 2 days',
    expected: 'send $1 each to @a, @b',
  },
];

extractionTests.forEach((test, idx) => {
  console.log(`Extraction Test ${idx + 1}`);
  console.log(`Input: "${test.input}"`);
  
  const parsed = parseRecurringCommand(test.input);
  const extracted = extractBaseCommand(test.input, parsed);
  
  console.log(`Extracted: "${extracted}"`);
  console.log(`Expected: "${test.expected}"`);
  
  if (extracted.trim() === test.expected.trim()) {
    console.log('✅ PASS');
    passed++;
  } else {
    console.log('❌ FAIL');
    failed++;
  }
  
  console.log('---\n');
});

console.log('\n' + '='.repeat(60));
console.log(`\n📈 TEST SUMMARY\n`);
console.log(`Total Tests: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('🎉 All tests passed! Feature is ready to deploy.\n');
} else {
  console.log('⚠️  Some tests failed. Review the output above.\n');
  process.exit(1);
}
