# Requirements Document

## Introduction

The Recurring Payments feature for MoniBot Discord bot enables users to schedule multiple payments that execute automatically at specified intervals. This feature rebuilds the existing scheduled payment system using a pre-calculation approach where recurring payments are expanded upfront into independent scheduled jobs, ensuring compatibility with the existing `scheduled_jobs` table and `scheduled-executor` edge function without requiring schema changes.

## Glossary

- **System**: The MoniBot Discord Bot payment system
- **Recurring_Payment_Parser**: The command parser that interprets recurring payment syntax
- **Job_Scheduler**: The component that creates individual scheduled job records
- **Series_Manager**: The component that manages groups of related recurring payment jobs
- **Executor**: The existing scheduled-executor edge function that processes scheduled jobs
- **User**: A Discord user interacting with MoniBot
- **Series**: A group of related scheduled payment jobs created from one recurring command
- **Interval**: The time duration between recurring payments (minimum 60 seconds)
- **Count**: The total number of payments in a recurring series (maximum 100)
- **Balance_Validator**: Component that checks if user has sufficient funds for entire series
- **Command_Handler**: The main bot command processing system

## Requirements

### Requirement 1: Parse Recurring Payment Commands

**User Story:** As a Discord user, I want to use natural language to create recurring payments, so that I can schedule multiple payments without repeating commands.

#### Acceptance Criteria

1. WHEN a user submits "send $1 to @alice every 1 minute 5 times", THE Recurring_Payment_Parser SHALL extract interval "60000ms" and count "5"
2. WHEN a user submits "send $5 to @bob every day for 1 week", THE Recurring_Payment_Parser SHALL convert duration to count "7"
3. WHEN a user submits "send $2 to @charlie every 30 seconds 3 times", THE Recurring_Payment_Parser SHALL upgrade interval to "60000ms" and warn the user
4. WHEN a user submits "send $10 to @dave daily 5 times", THE Recurring_Payment_Parser SHALL normalize to "every 1 day 5 times"
5. WHERE a user provides "every hour for 2 days", THE Recurring_Payment_Parser SHALL calculate count as "48"
6. IF a user submits "every Monday 5 times", THEN THE Recurring_Payment_Parser SHALL return error "DOW scheduling not supported in v1"

### Requirement 2: Validate Recurring Payment Constraints

**User Story:** As a system administrator, I want strict limits on recurring payments, so that I can prevent abuse and resource exhaustion.

#### Acceptance Criteria

1. IF count exceeds 100, THEN THE System SHALL reject the command with error "Max 100 payments per series"
2. IF interval is less than 60000ms, THEN THE System SHALL upgrade to 60000ms and warn "Minimum interval is 60 seconds due to executor granularity"
3. IF total series duration exceeds 30 days, THEN THE System SHALL reject with error "Series cannot span more than 30 days"
4. WHEN calculating series duration, THE System SHALL use formula "intervalMs × count"
5. THE Balance_Validator SHALL check if sender balance ≥ "amount × count" before creating series
6. IF insufficient balance, THEN THE System SHALL warn user but still create series (execution-time validation)

### Requirement 3: Create Independent Scheduled Jobs

**User Story:** As a developer, I want recurring payments to become individual scheduled jobs, so that they integrate seamlessly with the existing execution system.

#### Acceptance Criteria

1. WHEN a recurring payment is validated, THE Job_Scheduler SHALL create N independent rows in scheduled_jobs table
2. FOR each job in series, THE Job_Scheduler SHALL calculate scheduled_at as "startTime + (index × intervalMs)"
3. THE Job_Scheduler SHALL assign same seriesId UUID to all jobs in the series
4. THE Job_Scheduler SHALL set seriesIndex from 1 to N for each job
5. THE Job_Scheduler SHALL populate seriesTotalCount, seriesIntervalMs, and seriesStartedAt for all jobs
6. THE Job_Scheduler SHALL use type "scheduled_p2p" for single recipients or "p2p_multi" for multiple recipients
7. THE Job_Scheduler SHALL NOT set isRecurring or recurrenceRule flags to prevent executor double-scheduling

### Requirement 4: Maintain Compatibility Contract

**User Story:** As a system maintainer, I want recurring payments to work with existing infrastructure, so that I don't need to modify the executor or database schema.

#### Acceptance Criteria

1. THE System SHALL NOT set isRecurring: true in job payload to prevent executor rescheduling
2. THE System SHALL NOT set recurrenceRule in job payload to prevent executor rescheduling
3. THE System SHALL use existing job types: "scheduled_p2p", "p2p_multi", "scheduled_giveaway"
4. THE System SHALL populate source_author_id, source_author_username, source_tweet_id exactly like existing scheduled jobs
5. THE System SHALL store series metadata in payload jsonb column using existing schema
6. THE System SHALL perform atomic insert of all series jobs in single Supabase call
7. THE System SHALL respect executor's 60-second minimum interval due to pg_cron granularity

### Requirement 5: Manage Series Lifecycle

**User Story:** As a Discord user, I want to view and cancel my recurring payment series, so that I can manage my scheduled payments effectively.

#### Acceptance Criteria

1. WHEN user requests series status, THE Series_Manager SHALL query jobs by seriesId and display progress
2. WHEN user cancels series, THE Series_Manager SHALL update all pending jobs with status "failed" and error_message "Cancelled by user"
3. THE Series_Manager SHALL NOT modify jobs with status "running" or "completed" during cancellation
4. WHEN displaying series progress, THE System SHALL show completed, pending, and failed job counts
5. THE System SHALL order series jobs by scheduled_at ascending for display
6. WHERE series contains mixed statuses, THE System SHALL show breakdown: "3 completed, 2 pending, 0 failed"

### Requirement 6: Generate User Confirmations

**User Story:** As a Discord user, I want clear confirmation when I create recurring payments, so that I understand what was scheduled.

#### Acceptance Criteria

1. WHEN recurring payment is successfully created, THE System SHALL display series summary with first and last execution times
2. THE System SHALL show total payment count and total amount for the series
3. THE System SHALL display series ID for future reference and cancellation
4. THE System SHALL use "Brainrot vocab style" in confirmation messages with sigma/rizz terminology
5. THE System SHALL include buttons for "Cancel Series" with command fallback
6. WHERE series spans multiple days, THE System SHALL show duration in human-readable format

### Requirement 7: Handle Parser Edge Cases

**User Story:** As a bot developer, I want robust parsing of recurring syntax variations, so that users can express payments naturally.

#### Acceptance Criteria

1. WHEN user says "every minute", THE System SHALL require explicit count and return error "Please specify how many times"
2. WHEN user provides conflicting specifications, THE System SHALL prioritize explicit count over duration
3. WHERE user omits "times" but provides number, THE Recurring_Payment_Parser SHALL infer count (e.g., "every day 5" → "5 times")
4. THE System SHALL normalize time units: "min" → "minute", "hr" → "hour", "daily" → "day"
5. IF user provides decimal intervals, THE System SHALL round to nearest integer and warn user
6. THE System SHALL preserve original command text in payload.originalText for debugging

### Requirement 8: Integrate with Help System

**User Story:** As a Discord user, I want to learn about recurring payments from the help system, so that I can understand available features.

#### Acceptance Criteria

1. THE System SHALL add recurring payments section to help embed with examples
2. THE System SHALL include recurring payment information in welcome message
3. THE System SHALL show recurring syntax examples: "every X minutes Y times", "every day for Z days"
4. THE System SHALL document minimum interval and maximum count limits in help
5. THE System SHALL use "sigma mode" themed language consistent with bot personality
6. WHERE user requests help for recurring payments specifically, THE System SHALL show detailed guide

### Requirement 9: Maintain Transaction Logging

**User Story:** As a system administrator, I want consistent transaction logging for recurring payments, so that I can track payment history and debug issues.

#### Acceptance Criteria

1. THE System SHALL log each recurring payment execution through existing logMonibotTransaction function
2. THE System SHALL include seriesId in transaction metadata for grouping
3. THE System SHALL log series creation event with total planned volume
4. WHEN series is cancelled, THE System SHALL log cancellation event with remaining job count
5. THE System SHALL preserve existing transaction logging format and fields
6. THE System SHALL include seriesIndex in transaction context for ordering

### Requirement 10: Support Multi-Recipient Recurring Payments

**User Story:** As a Discord user, I want to send recurring payments to multiple recipients, so that I can automate group payments.

#### Acceptance Criteria

1. WHEN user submits "send $1 each to @alice, @bob every day 5 times", THE System SHALL create series with type "p2p_multi"
2. THE System SHALL multiply total amount by recipient count for balance validation
3. THE System SHALL preserve recipient list in each job's command payload
4. THE System SHALL calculate total series cost as "amount × recipients.length × count"
5. WHERE multi-recipient command fails parsing, THE System SHALL provide clear error message
6. THE System SHALL display recipient count in confirmation message: "2 recipients × 5 payments = 10 total transactions"