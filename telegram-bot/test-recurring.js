import {
  parseRecurringCommand,
  parseSimpleSchedule,
  validateRecurringParams,
  validateRecurringAmount,
  needsClarification,
  formatInterval,
  generateSeriesId,
  isValidSeriesId
} from './src/utils/recurringPayments.js';

console.log('🧪 Testing Advanced Recurring Payment Parser\n');

// 1. Placement & Interchangeability Test Cases
const placementTestCases = [
  'every day 5 times send $5 to @alice',
  'send every day $5 to @alice 5 times',
  'send $5 to @alice every day 5 times',
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 1: Interchangeable Placement');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

placementTestCases.forEach((testCase, index) => {
  console.log(`${index + 1}. "${testCase}"`);
  const result = parseRecurringCommand(testCase);
  if (result) {
    console.log(`   ✅ Parsed:`);
    console.log(`      Base: "${result.baseCommand}"`);
    console.log(`      Interval: ${result.intervalValue} ${result.intervalUnit} (${result.intervalMs}ms)`);
    console.log(`      Repeat: ${result.repeatCount}`);
  } else {
    console.log(`   ❌ Not detected as recurring`);
  }
  console.log('');
});

// 2. Synonyms Test Cases
const synonymTestCases = [
  'send $5 to @alice each day 3 times',
  'send $5 to @bob every other week 4 payments',
  'send $10 to @charlie biweekly 6x',
  'send $1 to @david daily lasting 7 days',
  'send $2 to @eve hourly over 24 hours',
  'send $3 to @frank once per minute x5',
  'send $4 to @grace repeat every week 5 rounds',
  'send $5 to @helen every single month for a period of 6 months',
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 2: Advanced Synonyms & Aliases');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

synonymTestCases.forEach((testCase, index) => {
  console.log(`${index + 1}. "${testCase}"`);
  const result = parseRecurringCommand(testCase);
  if (result) {
    console.log(`   ✅ Parsed:`);
    console.log(`      Base: "${result.baseCommand}"`);
    console.log(`      Interval: ${result.intervalValue} ${result.intervalUnit} (${result.intervalMs}ms)`);
    console.log(`      Repeat: ${result.repeatCount}`);
    console.log(`      Formatted: ${formatInterval(result)}`);
  } else {
    console.log(`   ❌ Not detected as recurring`);
  }
  console.log('');
});

// 3. Day of Week (DOW) Test Cases
const dowTestCases = [
  'send $5 to @alice every Monday 5 times',
  'send $5 to @bob on Fridays for 3 weeks',
  'send $5 to @charlie weekly on Tuesdays 5 times',
  'send $5 to @david each Saturday 4 payments',
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 3: Day-of-Week (DOW) Scheduling');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

dowTestCases.forEach((testCase, index) => {
  console.log(`${index + 1}. "${testCase}"`);
  const result = parseRecurringCommand(testCase);
  if (result) {
    console.log(`   ✅ Parsed:`);
    console.log(`      Base: "${result.baseCommand}"`);
    console.log(`      Interval: ${result.intervalValue} ${result.intervalUnit} (${result.intervalMs}ms)`);
    console.log(`      DOW Index: ${result.dow}`);
    console.log(`      First Run Time: ${result.firstRunTime}`);
    console.log(`      Formatted: ${formatInterval(result)}`);
  } else {
    console.log(`   ❌ Not detected as recurring`);
  }
  console.log('');
});

// 4. Start Time & Offset Test Cases
const startTimeTestCases = [
  'send $5 to @alice every day at 9am 5 times',
  'send $5 to @bob every Monday at 5:30pm 3 times',
  'send $5 to @charlie every hour starting tomorrow at 3pm for 6 hours',
  'send $5 to @david hourly starting in 2 hours for 5 times',
  'send $5 to @eve daily at 17:30 for 1 week',
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 4: Start Time & Offset Parsing');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

startTimeTestCases.forEach((testCase, index) => {
  console.log(`${index + 1}. "${testCase}"`);
  const result = parseRecurringCommand(testCase);
  if (result) {
    console.log(`   ✅ Parsed:`);
    console.log(`      Base: "${result.baseCommand}"`);
    console.log(`      Interval: ${result.intervalValue} ${result.intervalUnit} (${result.intervalMs}ms)`);
    console.log(`      First Run Time: ${result.firstRunTime}`);
    console.log(`      Repeat: ${result.repeatCount}`);
  } else {
    console.log(`   ❌ Not detected as recurring`);
  }
  console.log('');
});

// 5. Validation Test Cases
const validationTestCases = [
  'send $5 to @alice every 30 seconds 5 times', // Should fail: sub-60s
  'send $5 to @bob every day 101 times', // Should fail: count > 100
  'send $5 to @charlie every hour for 2 months', // Should fail: duration > 30 days
  'send $5 to @david every minute', // Should need clarification: missing count
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test 5: Parameters Validation');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

validationTestCases.forEach((testCase, index) => {
  console.log(`${index + 1}. "${testCase}"`);
  const parsed = parseRecurringCommand(testCase);
  if (!parsed) {
    console.log('   ❌ Parsing failed');
    console.log('');
    return;
  }
  
  const paramValidation = validateRecurringParams(parsed);
  console.log(`   Params Valid: ${paramValidation.isValid ? '✅' : '❌'} ${paramValidation.message || 'Valid'}`);
  
  const clarification = needsClarification(parsed);
  if (clarification) {
    console.log(`   ⚠️ Needs Clarification: ${clarification.type}`);
  }
  console.log('');
});

console.log('🎉 Advanced recurring tests complete!\n');
