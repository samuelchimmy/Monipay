# Recurring Payments Design Document

## Vision Statement

*"Since our scheduled payment already works perfectly, why not treat every recurring payment as an advanced scheduled payment by simply building a calculation logic that calculates the timing of each payment as a separate scheduled payment."*

## Core Concept

Instead of complex rescheduling logic, recurring payments are **pre-created as multiple individual scheduled jobs** with calculated execution times.

### Example

**User Command:** `send $1 to @jadetest every 1 minute 5 times`

**Traditional Approach (Complex & Broken):**
1. Create 1 job with recurring metadata
2. After execution, calculate next run time
3. Create new job for next execution
4. Repeat until count exhausted
5. **Problem:** If rescheduling fails, series breaks

**Our Approach (Simple & Reliable):**
1. Calculate all execution times upfront
2. Create 5 separate scheduled jobs immediately:
   - Job 1: `scheduled_at = now + 1 minute`
   - Job 2: `scheduled_at = now + 2 minutes` 
   - Job 3: `scheduled_at = now + 3 minutes`
   - Job 4: `scheduled_at = now + 4 minutes`
   - Job 5: `scheduled_at = now + 5 minutes`
3. Each job executes independently using existing working system

## Key Principles

### 1. **Leverage What Works**
- Scheduled payments already work perfectly
- Don't reinvent the wheel
- Build on proven foundation

### 2. **Simplicity Over Complexity**
- Pre-calculation is simpler than dynamic rescheduling
- Fewer moving parts = fewer failure points
- Easier to debug and maintain

### 3. **Transparency**
- All future payments visible in database immediately
- Users can see exact timing of each payment
- No hidden state or complex metadata

### 4. **Reliability**
- If one payment fails, others continue
- No cascading failures
- No dependency on executor rescheduling logic

## Technical Implementation

### Mathematical Formula

For command: `every [INTERVAL] [UNIT] [COUNT] times`

```javascript
for (let i = 0; i < COUNT; i++) {
  const executionTime = startTime + (i * intervalMs);
  createScheduledJob({
    scheduled_at: executionTime,
    payload: { /* standard payment data */ },
    seriesId: uniqueId,
    seriesIndex: i + 1,
    seriesTotalCount: COUNT
  });
}
```

### Data Structure

Each job in a recurring series contains:
- `seriesId`: Unique identifier linking all jobs in the series
- `seriesIndex`: Position in series (1, 2, 3, 4, 5)  
- `seriesTotalCount`: Total jobs in series (5)
- Standard payment payload (recipient, amount, etc.)

### Execution Flow

1. **Parse Command**
   - Extract interval, unit, count
   - Validate parameters
   - Calculate total duration and amount

2. **Create Jobs**
   - Generate unique `seriesId`
   - Calculate execution time for each job
   - Insert all jobs in single database transaction
   - Return confirmation with series details

3. **Execution**
   - Existing scheduler picks up jobs at scheduled times
   - Each job executes independently
   - No inter-job dependencies

4. **Management**
   - Cancel series: Delete all pending jobs with same `seriesId`
   - Status tracking: Query jobs by `seriesId`

## Supported Syntax Patterns

### Numeric Intervals
- `every 1 minute 5 times`
- `every 2 hours 10 times`
- `every 30 seconds 3 times`
- `every 1 day 7 times`

### Natural Language
- `every day for 5 days`
- `every hour for 2 days`
- `every minute for 10 minutes`
- `every week for 1 month`

### Flexible Formats
- `every minute` (defaults to `every 1 minute`)
- `daily 5 times` (aliases for common patterns)
- `hourly for 1 day`

## Advantages Over Traditional Approach

| Aspect | Traditional Recurring | Our Pre-Creation Approach |
|--------|----------------------|---------------------------|
| **Complexity** | High (rescheduling logic) | Low (simple calculation) |
| **Reliability** | Fragile (chain breaks if one fails) | Robust (independent jobs) |
| **Visibility** | Hidden (only current job visible) | Transparent (all jobs visible) |
| **Debugging** | Hard (complex state tracking) | Easy (query by seriesId) |
| **Cancellation** | Complex (stop rescheduling) | Simple (delete pending jobs) |
| **Database Load** | Low initially, grows over time | Higher initially, stable |
| **Failure Recovery** | Requires complex retry logic | Uses existing retry mechanisms |

## Safety Mechanisms

### 1. **Abuse Prevention**
- Maximum 100 jobs per recurring series
- Prevents resource exhaustion attacks
- Clear error message for excessive requests

### 2. **Balance Validation**
- Check total amount (not just single payment)
- Warn if insufficient balance for entire series
- Calculate total cost upfront

### 3. **Time Validation**
- Minimum 60-second intervals (executor limitation)
- Maximum 30-day total duration
- Reasonable execution time bounds

### 4. **Error Handling**
- Atomic job creation (all or nothing)
- Rollback on partial failures  
- Clear error messages for users

## User Experience

### Confirmation Message
```
⏰ Recurring Payment Scheduled! 🔄

📋 Command: send $1 to @jadetest
🚀 First Payment: Jun 10, 2026 09:58:00 UTC
⏱️ Last Payment: Jun 10, 2026 10:02:00 UTC
🔄 Interval: Every 1 minute
🔢 Total Payments: 5
💰 Amount Each: $1.00
💵 Total Amount: $5.00

✅ Status: 5 jobs queued
Series ID: abc123-def456

[🚫 Cancel All]
```

### Progress Tracking
Users can see:
- All future payment times
- Which payments have executed
- Which payments failed
- Total series progress

## Edge Cases Handled

### 1. **Duration vs Count**
- `every day for 5 days` → automatically calculates 5 payments
- `every hour for 2 days` → automatically calculates 48 payments
- Smart conversion between duration and count formats

### 2. **Minimum Intervals**
- `every 30 seconds` → upgraded to `every 60 seconds`
- Clear warning about minimum executor limitations
- Prevents user confusion about timing

### 3. **Large Series**
- `every minute for 1 week` → 10,080 jobs (rejected)
- `every hour for 1 month` → ~720 jobs (rejected) 
- Reasonable limits with helpful error messages

### 4. **Partial Failures**
- If job creation fails partway through
- Rollback all created jobs
- Return clear error message
- No orphaned jobs left behind

## Implementation Status

### ✅ Completed
- [x] Basic recurring pattern parsing
- [x] Job pre-creation logic
- [x] Series ID tracking
- [x] Cancel series functionality
- [x] Natural language syntax support
- [x] Safety limits and validation

### 🔄 In Progress  
- [ ] Fix chat handler routing to use new logic
- [ ] Update all parsing entry points
- [ ] Comprehensive pattern testing

### 📋 Future Enhancements
- [ ] Weekly/monthly scheduling (`every Monday`, `every 1st of month`)
- [ ] Timezone support for scheduled times
- [ ] Series modification (change remaining payments)
- [ ] Batch operations (pause/resume series)

## Conclusion

This approach transforms a complex recurring payment problem into a simple batch scheduling problem. By leveraging existing, proven scheduled payment infrastructure and pre-calculating all execution times, we achieve:

- **Maximum reliability** through independent job execution
- **Minimal complexity** by avoiding dynamic rescheduling  
- **Full transparency** with all payments visible upfront
- **Easy management** through standard database operations

The design philosophy of "use what works" leads to a more maintainable, debuggable, and user-friendly solution than traditional recurring payment approaches.