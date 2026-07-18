# Recurring Payments Feature

## Overview

The recurring payments feature enables users to schedule multiple payments that execute automatically at regular intervals. This implementation uses a **pre-calculation approach** that leverages the existing scheduled payment infrastructure.

### Key Philosophy

> "Since our scheduled payment already works perfectly, why not treat every recurring payment as an advanced scheduled payment by simply building a calculation logic that calculates the timing of each payment as a separate scheduled payment."

Each recurring payment is converted into multiple independent scheduled jobs created upfront with calculated execution times.

## Features

✅ **Comprehensive Regex-Based Parsing** - Detects ALL possible recurring payment command variations
✅ **Flexible Interval Support** - seconds, minutes, hours, days, weeks
✅ **Multiple Count Formats** - "5 times" or "for 2 hours"
✅ **Intelligent Clarification** - Asks users for details when commands are ambiguous
✅ **Validation & Limits** - Prevents abuse with configurable limits
✅ **Series Management** - Cancel, check status, and list recurring payments
✅ **Independent Execution** - Each payment executes independently for reliability
✅ **Atomic Transactions** - All jobs created or none (no partial series)

## Usage Examples

### Create Recurring Payments

```
send $5 to @alice every 1 minute 5 times
send $10 to @bob every hour for 24 hours
tip $2 to @charlie every day for 7 days
send $1 to @dave every 2 minutes 30 times
send $3 to @eve every week 4 times
```

### Manage Recurring Payments

```
/my_series - List all your recurring payment series
/series_status <series_id> - Check status of a specific series
/cancel_series <series_id> - Cancel a recurring payment series
```

### Natural Language Management

```
"show my recurring payments"
"cancel series a1b2c3d4-..."
"check status of series a1b2c3d4-..."
```

## Architecture

### Components

1. **recurringPayments.js** - Core parsing and validation
   - Comprehensive regex patterns for command detection
   - Parameter validation with configurable limits
   - Series ID generation and validation
   - Clarification detection

2. **seriesCalculator.js** - Time calculation and job generation
   - Precise timestamp calculation with interval arithmetic
   - Timezone and DST handling (placeholder for future)
   - Job series creation with metadata
   - Series consistency verification

3. **seriesManager.js** - Lifecycle management
   - Atomic series creation with database transactions
   - Series cancellation with authorization
   - Status and progress tracking
   - User series history

4. **schedule.js** (updated) - Integration handler
   - Detects recurring vs one-time schedules
   - Routes to appropriate handler
   - Maintains backward compatibility

5. **recurring.js** - Management command handlers
   - `/cancel_series` command
   - `/series_status` command
   - `/my_series` command
   - Natural language management support

## Command Parsing

### Regex Patterns

The parser uses a master regex pattern that detects:

- **Interval with count**: `every 1 minute 5 times`
- **Interval with duration**: `every 1 hour for 3 hours`
- **Default interval (1)**: `every minute 10 times`
- **All time units**: seconds, minutes, hours, days, weeks

### Supported Variations

```regex
every [number] unit [count] times
every [number] unit for [duration]
every unit [count] times (number defaults to 1)
```

Examples that work:
- `every 1 minute 5 times`
- `every minute 5 times`
- `every 2 hours for 6 hours`
- `every day for 7 days`
- `every week 4 times`

## Validation & Limits

### System Limits (Configurable)

```javascript
const VALIDATION_LIMITS = {
  MIN_INTERVAL_MS: 60000,        // 60 seconds (pg_cron minimum)
  MAX_JOB_COUNT: 100,            // Maximum jobs per series
  MAX_DURATION_MS: 2592000000,   // 30 days
  MAX_TOTAL_AMOUNT: 10000        // $10,000 per job maximum
};
```

### Validation Checks

1. **Minimum Interval**: 60 seconds (pg_cron limitation)
2. **Maximum Job Count**: 100 payments per series
3. **Maximum Duration**: 30 days total
4. **Amount Validation**: Reasonable per-job limits
5. **Balance Warning**: Warns if insufficient balance for total amount
6. **Allowance Check**: Verifies spending allowance before creation

## Database Schema

### Job Payload Structure

```javascript
{
  // Existing fields
  platform: 'telegram',
  chatId: '...',
  senderId: '...',
  senderPlatformId: '...',
  command: {...},
  
  // New recurring series fields
  seriesId: 'uuid-v4',           // Links all jobs in series
  seriesIndex: 1,                // Position (1, 2, 3...)
  seriesTotalCount: 5,           // Total jobs in series
  seriesInterval: '1m',          // Interval string
  seriesFirstRun: 'ISO-8601',    // First execution time
  seriesLastRun: 'ISO-8601'      // Last execution time
}
```

## Workflow

### 1. Command Received

```
User: "send $5 to @alice every 1 minute 5 times"
```

### 2. Parse Recurring Pattern

```javascript
{
  baseCommand: "send $5 to @alice",
  interval: "1m",
  intervalValue: 1,
  intervalUnit: "m",
  intervalMs: 60000,
  repeatCount: 5,
  totalDuration: 300000
}
```

### 3. Validate Parameters

- Check interval >= 60 seconds ✅
- Check count <= 100 ✅
- Check duration <= 30 days ✅
- Validate amount ✅

### 4. Generate Job Series

```javascript
{
  seriesId: "a1b2c3d4-...",
  jobs: [
    { scheduled_at: "2024-01-01T00:01:00Z", seriesIndex: 1 },
    { scheduled_at: "2024-01-01T00:02:00Z", seriesIndex: 2 },
    { scheduled_at: "2024-01-01T00:03:00Z", seriesIndex: 3 },
    { scheduled_at: "2024-01-01T00:04:00Z", seriesIndex: 4 },
    { scheduled_at: "2024-01-01T00:05:00Z", seriesIndex: 5 }
  ]
}
```

### 5. Insert Atomically

All jobs inserted in single transaction - either all succeed or all fail.

### 6. Confirm to User

```
⏰ Recurring Payment Scheduled! 🔄

📋 Command: send $5 to @alice
🚀 Start Time: Mon, 01 Jan 2024 00:01:00 UTC
🔄 Interval: every 1 minute
⏳ Last Payment: Mon, 01 Jan 2024 00:05:00 UTC
🔢 Total Payments: 5
💰 Amount Each: $5.00
💵 Total Amount: $25.00
⛓️ Chain: BASE

✅ Status: Queued
Series ID: a1b2c3d4-...
```

## Error Handling

### Validation Errors

- **Interval too short**: Clear message with minimum requirement
- **Too many jobs**: Explains maximum limit
- **Duration too long**: Shows maximum allowed duration
- **Missing repeat count**: Asks for clarification

### Runtime Errors

- **Database failure**: Transaction rollback, no partial series
- **Insufficient balance**: Warning shown, but series created
- **Invalid command**: Helpful error with examples
- **Authorization failure**: Clear permission denial

### User Experience

```
❌ Interval too short. Minimum interval is 60 seconds (1 minute).

Try: `every 1 minute` or longer.
```

```
⚠️ Low balance warning: Your current BASE balance is $10.00 but the total recurring amount is $25.00.
You're short $15.00. Top up before the payments start or some will fail.
```

## Testing

### Run Tests

```bash
node test-recurring.js
```

### Test Coverage

- ✅ Command parsing (all variations)
- ✅ Parameter validation (boundaries)
- ✅ Amount validation
- ✅ Series ID generation
- ✅ Simple schedule detection
- ✅ Clarification detection

### Manual Testing

1. **Create recurring payment**:
   ```
   send $1 to @testuser every 1 minute 3 times
   ```

2. **Check your series**:
   ```
   /my_series
   ```

3. **Check status**:
   ```
   /series_status <series_id>
   ```

4. **Cancel series**:
   ```
   /cancel_series <series_id>
   ```

## Integration Points

### Existing Systems Used

- ✅ `scheduled_jobs` table (no schema changes)
- ✅ pg_cron executor (existing pipeline)
- ✅ Payment execution pipeline (unchanged)
- ✅ Command parsing infrastructure (extended)

### New Endpoints

- `/cancel_series <id>` - Cancel recurring series
- `/series_status <id>` - Check series status
- `/my_series` - List user's series

### Modified Files

- `src/handlers/schedule.js` - Added recurring payment handler
- `src/handlers/chat.js` - Added recurring management detection
- `src/handlers/help.js` - Updated with recurring commands
- `src/index.js` - Added command routes

### New Files

- `src/utils/recurringPayments.js` - Core parsing and validation
- `src/utils/seriesCalculator.js` - Time calculation and job generation
- `src/utils/seriesManager.js` - Lifecycle management
- `src/handlers/recurring.js` - Management command handlers

## Backward Compatibility

✅ **Existing scheduled payments work unchanged**
✅ **No breaking changes to current API**
✅ **All existing commands still work**
✅ **Database schema unchanged** (uses existing payload JSONB field)

## Future Enhancements

### Planned Features

1. **Timezone Support** - Proper timezone-aware scheduling
2. **Smart Retry** - Automatic retry on transient failures
3. **Pause/Resume** - Temporarily pause a series
4. **Edit Series** - Modify amount or interval mid-series
5. **Recurring Templates** - Save and reuse common patterns
6. **Series Groups** - Group related series for bulk management
7. **Notification Preferences** - Customize completion notifications

### Performance Optimizations

1. **Batch Insertion** - Already implemented ✅
2. **Index Optimization** - Add index on `payload->>'seriesId'`
3. **Query Caching** - Cache series metadata
4. **Parallel Creation** - Create multiple series concurrently

## Security Considerations

### Abuse Prevention

- ✅ Hard limit of 100 jobs per series
- ✅ Rate limiting on recurring command creation
- ✅ Total amount validation
- ✅ Minimum interval enforcement (60 seconds)

### Authorization

- ✅ Series cancellation requires original creator verification
- ✅ Platform-specific user ID validation
- ✅ Series ID enumeration protection (UUID format)

### Data Integrity

- ✅ Atomic transactions prevent partial series
- ✅ Series metadata validation before creation
- ✅ Input sanitization for all parameters

## Monitoring & Logging

### Log Events

```javascript
[RecurringParser] Parsing: "send $5 to @alice every 1 minute 5 times"
[RecurringParser] Matched pattern 0: [...]
[RecurringParser] Parsed successfully: {...}

[RecurringPayment] Processing recurring payment request
[RecurringPayment] Successfully created series a1b2c3d4 with 5 jobs

[SeriesManager] Creating series a1b2c3d4 with 5 jobs
[SeriesManager] Successfully created 5 jobs for series a1b2c3d4

[SeriesManager] Cancelling series a1b2c3d4 for user 123456
[SeriesManager] Successfully cancelled 3 jobs for series a1b2c3d4
```

### Metrics to Track

- Series creation rate
- Average jobs per series
- Cancellation rate
- Execution success rate per series
- Average series completion time

## Support & Troubleshooting

### Common Issues

**Issue**: "Interval too short"
**Solution**: Use minimum 60 seconds (e.g., `every 1 minute`)

**Issue**: "No pending payments found"
**Solution**: Series may be completed or you're not authorized

**Issue**: "Invalid series ID format"
**Solution**: Copy the full UUID from `/my_series` command

**Issue**: "Maximum 100 recurring payments allowed"
**Solution**: Reduce count or increase interval

### Debug Mode

Enable detailed logging:
```javascript
console.log(`[RecurringParser] Parsing: "${text}"`);
```

## Credits

Built with ❤️ for MoniBot Telegram Bot

- **Architecture**: Pre-calculation approach (no complex rescheduling)
- **Design**: Leverages existing scheduled payment infrastructure
- **Philosophy**: Multiple independent jobs > single recurring job
- **Reliability**: Atomic transactions, independent execution

## License

Part of monibot-telegram project.
