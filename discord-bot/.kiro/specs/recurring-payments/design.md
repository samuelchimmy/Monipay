# Design Document

## Architecture Overview

The Recurring Payments feature uses a **pre-calculation expansion approach** where recurring payment commands are immediately converted into N independent scheduled jobs. This design ensures full compatibility with the existing `scheduled_jobs` table and `scheduled-executor` edge function without requiring schema changes or executor modifications.

### Core Design Principles

1. **Expansion Over Rescheduling**: Convert recurring commands into individual jobs upfront rather than dynamic rescheduling
2. **Compatibility First**: Work within existing infrastructure constraints and compatibility contract
3. **Atomic Operations**: All series jobs created in single database transaction
4. **Independent Execution**: Each job executes independently with no interdependencies
5. **Brainrot UX**: Maintain sigma/rizz themed user experience throughout

## Component Architecture

```
Discord Message
       ↓
Command Router (index.js)
       ↓
Message Handler (detects recurring syntax)
       ↓
Recurring Payment Handler (new component)
       ↓
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Parser Module   │    │ Validation Module│    │ Job Creator     │
│ - Parse syntax  │ →  │ - Check limits   │ →  │ - Create series │
│ - Extract params│    │ - Validate funds │    │ - Atomic insert │
└─────────────────┘    └──────────────────┘    └─────────────────┘
       ↓
┌─────────────────┐    ┌──────────────────┐
│ Confirmation    │    │ Series Manager   │
│ - Embed builder │    │ - Cancel series  │
│ - Brainrot style│    │ - View progress  │
└─────────────────┘    └──────────────────┘
       ↓
Existing Scheduled Executor (no changes)
```

## File Structure

```
src/handlers/
├── recurringHandler.js        (new) - Main recurring payment logic
├── scheduleHandler.js         (modify) - Integration with existing scheduler
└── helpHandler.js            (modify) - Add recurring payment help

src/parsers/
└── recurringParser.js        (new) - Command parsing logic

src/validators/
└── recurringValidator.js     (new) - Validation and safety checks

src/embeds/
└── recurringEmbeds.js        (new) - Confirmation and status embeds

commands.js                   (modify) - Add recurring command detection
```

## Core Components

### 1. Recurring Payment Handler (`src/handlers/recurringHandler.js`)

**Purpose**: Main orchestrator for recurring payment workflow

**Key Functions**:
- `handleRecurringPayment(message, recurringParams, baseCommand)`
- `createRecurringSeries(seriesConfig)`
- `cancelRecurringSeries(message, seriesId)`
- `viewSeriesStatus(message, seriesId)`

**Flow**:
1. Receive parsed recurring parameters and base payment command
2. Validate constraints (limits, balance, permissions)
3. Generate series metadata (UUID, timestamps, counts)
4. Create N scheduled job records atomically
5. Send confirmation embed with series details
6. Handle any errors with appropriate user messaging

### 2. Recurring Parser (`src/parsers/recurringParser.js`)

**Purpose**: Parse natural language recurring payment syntax

**Key Functions**:
- `parseRecurringCommand(text)` → `{ intervalMs, count, baseCommand }`
- `normalizeTimeUnit(unit)` → standardized unit strings
- `convertDurationToCount(value, unit, intervalMs)` → count number
- `validateSyntax(parsed)` → boolean with error details

**Supported Patterns**:
```javascript
// Numeric intervals
"every 1 minute 5 times" → { intervalMs: 60000, count: 5 }
"every 2 hours 10 times" → { intervalMs: 7200000, count: 10 }

// Duration conversion  
"every day for 1 week" → { intervalMs: 86400000, count: 7 }
"every hour for 2 days" → { intervalMs: 3600000, count: 48 }

// Aliases
"daily 5 times" → { intervalMs: 86400000, count: 5 }
"hourly for 1 day" → { intervalMs: 3600000, count: 24 }
```

**Edge Cases**:
- Minimum 60s interval enforcement with user warning
- Maximum 100 count enforcement with clear error
- Conflicting parameters resolution (count beats duration)
- Invalid syntax graceful error handling

### 3. Recurring Validator (`src/validators/recurringValidator.js`)

**Purpose**: Validate recurring payment constraints and safety checks

**Key Functions**:
- `validateRecurringLimits(intervalMs, count)` → validation result
- `validateSeriesDuration(intervalMs, count)` → duration check (30 day max)
- `validateUserBalance(senderProfile, amount, count, recipients, chain)` → balance check
- `calculateSeriesCost(amount, count, recipients)` → total cost calculation

**Validation Rules**:
```javascript
// Hard limits (reject if exceeded)
MAX_JOBS_PER_SERIES = 100;
MIN_INTERVAL_MS = 60000; // 60 seconds (pg_cron granularity)
MAX_SERIES_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Balance validation
totalCost = amount × count × recipients.length;
requiredBalance = totalCost; // Warn if insufficient, don't block
```

### 4. Job Creator (`src/handlers/recurringHandler.js` - internal)

**Purpose**: Create series of independent scheduled jobs

**Key Functions**:
- `generateSeriesJobs(config)` → array of job objects
- `insertJobsSeries(jobs)` → atomic database insert
- `buildJobPayload(basePayload, seriesMetadata, index)` → individual job payload

**Job Generation Logic**:
```javascript
const seriesId = crypto.randomUUID();
const startTime = Date.now();

const jobs = Array.from({ length: count }, (_, i) => ({
  type: baseCommand.type === 'p2p_multi' ? 'p2p_multi' : 'scheduled_p2p',
  status: 'pending',
  scheduled_at: new Date(startTime + (i + 1) * intervalMs).toISOString(),
  source_author_id: message.author.id,
  source_author_username: message.author.tag,
  source_tweet_id: message.id,
  max_attempts: 3,
  attempts: 0,
  payload: {
    ...basePayload,
    seriesId,
    seriesIndex: i + 1,
    seriesTotalCount: count,
    seriesIntervalMs: intervalMs,
    seriesStartedAt: new Date(startTime).toISOString(),
    // CRITICAL: No isRecurring or recurrenceRule to prevent double-scheduling
  }
}));
```

### 5. Series Manager (`src/handlers/recurringHandler.js` - internal)

**Purpose**: Manage series lifecycle operations

**Key Functions**:
- `getSeriesProgress(seriesId)` → status breakdown
- `cancelPendingSeries(seriesId, userId)` → cancellation logic
- `formatSeriesStatus(jobs)` → user-friendly status display

**Cancellation Logic**:
```javascript
// Only cancel pending jobs, leave running/completed alone
await supabase
  .from('scheduled_jobs')
  .update({ 
    status: 'failed', 
    error_message: 'Cancelled by user' 
  })
  .eq('status', 'pending')
  .filter('payload->>seriesId', 'eq', seriesId);
```

### 6. Confirmation Embeds (`src/embeds/recurringEmbeds.js`)

**Purpose**: Generate brainrot-style confirmation and status messages

**Key Functions**:
- `buildRecurringConfirmation(seriesData)` → confirmation embed
- `buildSeriesStatus(jobs)` → progress status embed
- `buildCancellationConfirmation(cancelledCount)` → cancellation embed

**Brainrot Style Examples**:
```javascript
// Confirmation
"⏰ Recurring Payment Scheduled! 🔄 Sigma Energy Activated 🗿"
"🚀 First Payment: <timestamp> UTC (No Cap 🧢)"
"🏁 Final Payment: <timestamp> UTC (W Aura Incoming 📈)"
"💰 Each Payment: $5 USDC (Certified Bussin ⚡)"
"💵 Total Volume: $25 USDC (Big Rizz Move 🤫🧏‍♂️)"

// Status
"🔄 Series Progress Update 📊"
"✅ Completed: 3/5 payments (W Streak 🏆)"
"⏳ Pending: 2 payments (Still Cooking 🔥)"
"❌ Failed: 0 payments (No L's Here 💯)"
```

## Integration Points

### 1. Command Router Integration (`commands.js`)

**Modification**: Add recurring pattern detection before existing parsing

```javascript
// Add to parseCommand function
const RECURRING_PATTERN = /\bevery\s+(?:(\d+)\s+)?(minute|hour|day|week)s?\s+(?:(\d+)\s+times?|for\s+(\d+)\s+(\w+))/i;

export function parseCommand(text) {
  const cleaned = text.replace(/^!monibot\s*/i, '').trim();
  
  // Check for recurring pattern first
  const recurringMatch = cleaned.match(RECURRING_PATTERN);
  if (recurringMatch) {
    return {
      type: 'recurring',
      recurringParams: parseRecurringParams(recurringMatch),
      baseCommand: parseBaseCommand(cleaned.replace(RECURRING_PATTERN, '').trim()),
      raw: cleaned
    };
  }
  
  // Existing parsing logic...
}
```

### 2. Message Handler Integration (`index.js`)

**Modification**: Route recurring commands to new handler

```javascript
// Add to message handling logic
if (parsed?.type === 'recurring') {
  await handleRecurringPayment(message, parsed.recurringParams, parsed.baseCommand);
  return;
}
```

### 3. Schedule Handler Integration (`src/handlers/scheduleHandler.js`)

**Modification**: Update to work with recurring handler for scheduled recurring payments

```javascript
// Modify handleScheduledCommand to detect and route recurring scheduled payments
if (scheduleResult.isRecurring) {
  // Route to recurring handler with schedule timing
  await handleRecurringPayment(message, {
    ...scheduleResult,
    startTime: new Date(scheduleResult.scheduledAt)
  }, cmd);
  return;
}
```

### 4. Help System Integration (`src/handlers/helpHandler.js`)

**Addition**: New help section for recurring payments

```javascript
// Add to getHelpContent() fields array
{
  name: '🔄 Recurring Payments (Sigma AutoPay)',
  value: [
    '`!monibot send $1 to @alice every minute 5 times` — Rapid fire rizz ⚡',
    '`!monibot send $5 to @bob every day for 1 week` — Weekly W distribution 📈',
    '`!monibot send $2 each to @a, @b every hour 10 times` — Group automation 🤫',
    '**Min interval**: 60 seconds | **Max series**: 100 payments | **Max duration**: 30 days',
    'Cancel anytime: `!monibot cancel series <ID>` (Stay in control 🗿)',
  ].join('\n'),
}
```

### 5. Welcome Message Integration (`src/handlers/welcomeHandler.js`)

**Addition**: Mention recurring payments as a key feature

```javascript
// Add to feature list
'• **Recurring Payments** — Set it and forget it autopay 🔄',
```

## Database Schema Usage

### Existing `scheduled_jobs` Table Structure
```sql
-- No schema changes required
scheduled_jobs (
  id uuid PRIMARY KEY,
  type text NOT NULL,           -- 'scheduled_p2p' or 'p2p_multi'
  status text DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  scheduled_at timestamptz NOT NULL,
  payload jsonb NOT NULL,       -- Series metadata stored here
  source_author_id text,        -- Discord user ID
  source_author_username text,  -- Discord username
  source_tweet_id text,         -- Discord message ID
  max_attempts integer DEFAULT 3,
  attempts integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);
```

### Series Metadata in `payload` JSONB
```javascript
{
  // Existing fields
  "platform": "discord",
  "channelId": "123456789",
  "guildId": "987654321",
  "senderId": "<profile-uuid>",
  "senderDiscordId": "<discord-id>",
  "senderPayTag": "alice",
  "senderSource": "profile",
  "senderWallet": "0x...",
  "command": { /* parsed p2p command */ },
  "originalText": "send $1 to @bob every minute 5 times",
  
  // NEW: Series metadata
  "seriesId": "uuid-v4",
  "seriesIndex": 1,              // 1-based index
  "seriesTotalCount": 5,
  "seriesIntervalMs": 60000,
  "seriesStartedAt": "2026-06-10T09:58:00Z",
  
  // CRITICAL: These MUST be omitted or false
  "isRecurring": false,          // Prevent executor rescheduling
  "recurrenceRule": null         // Prevent executor rescheduling
}
```

## Error Handling Strategy

### User-Facing Errors (Brainrot Style)
```javascript
const ERROR_MESSAGES = {
  MAX_COUNT_EXCEEDED: "Whoa there sigma! 🛑 Max 100 payments per series. That's already mad rizz! 🤫",
  MIN_INTERVAL_TOO_LOW: "Blud tried to go sub-60 seconds 💀 Upgraded to 1 minute (executor limits, no cap 🧢)",
  MAX_DURATION_EXCEEDED: "30-day max span, chief. That's already generational wealth behavior 📈",
  INSUFFICIENT_BALANCE: "Heads up! 💰 Total series costs $X but you've got $Y. Series queued but might fail at execution time 📉",
  INVALID_SYNTAX: "That syntax is giving Ohio energy 🌽 Try: 'send $5 to @alice every day 5 times'",
  SERIES_NOT_FOUND: "Series ID not found or not yours, blud 👻",
  PARSING_FAILED: "Command parsing failed. Stop being delulu with that syntax 🤡"
};
```

### Technical Error Handling
```javascript
// Graceful degradation patterns
try {
  const jobs = await createJobsSeries(seriesConfig);
  await sendConfirmation(message, jobs);
} catch (error) {
  if (error.code === 'SUPABASE_INSERT_ERROR') {
    await message.reply("Database insertion failed. Series not created. Try again.");
  } else if (error.code === 'VALIDATION_ERROR') {
    await message.reply(error.userMessage);
  } else {
    logger.error('Unexpected recurring payment error:', error);
    await message.reply("Unexpected error. Sigma dev team has been notified 🗿");
  }
}
```

## Performance Considerations

### Database Optimization
- **Atomic Batch Insert**: Single `supabase.from('scheduled_jobs').insert(jobsArray)` call
- **Index Usage**: Leverage existing indexes on `scheduled_at`, `status`, `source_author_id`
- **Payload Queries**: Use `payload->>'seriesId'` for series lookups (indexed JSONB operations)

### Memory Management
- **Streaming Generation**: For large series (50+ jobs), generate jobs in chunks
- **Lazy Loading**: Only load full series details when requested by user
- **Cleanup**: Remove completed series metadata after 30 days (separate cleanup job)

### Rate Limiting Integration
```javascript
// Inherit existing rate limiting
if (await rateLimiter.isLimited(message.author.id, 'recurring_payment')) {
  await message.reply("Sigma rate limit activated 🛑 Chill for a moment 🧊");
  return;
}

await rateLimiter.recordUsage(message.author.id, 'recurring_payment');
```

## Testing Strategy

### Unit Tests
- Parser validation with edge cases
- Job generation algorithms
- Series metadata construction
- Error message generation

### Integration Tests  
- End-to-end recurring payment creation
- Series cancellation workflows
- Database transaction atomicity
- Executor compatibility (no double-scheduling)

### Load Tests
- 100-job series creation performance
- Concurrent series creation handling
- Database query performance with large series

## Migration Strategy

### Phase 1: Core Implementation
1. Implement parser and validator modules
2. Create recurring handler with basic functionality
3. Add command routing and integration points
4. Implement confirmation embeds

### Phase 2: Series Management
1. Add series status viewing functionality  
2. Implement series cancellation
3. Integrate with help system
4. Add welcome message mentions

### Phase 3: Polish & Optimization
1. Add comprehensive error handling
2. Optimize database queries and indexes
3. Add logging and monitoring
4. Performance testing and tuning

### Rollback Plan
- Feature flag controlled rollout
- Disable recurring pattern matching to fallback to existing behavior
- No database schema changes means instant rollback capability
- Existing scheduled jobs continue working normally

## Security Considerations

### Permission Validation
- Verify user owns series before cancellation
- Validate Discord permissions for server commands
- Respect existing allowance and balance checks

### Input Sanitization  
- Sanitize all user inputs in parser
- Validate numeric ranges and limits
- Prevent injection via command text

### Rate Limiting
- Inherit existing rate limiting per user
- Additional limits for series creation (max 5 series per hour per user)
- Prevent spam series creation attacks

This design maintains full backward compatibility while adding powerful recurring payment functionality that integrates seamlessly with MoniBot's existing sigma-themed personality and infrastructure.