# Implementation Plan: Recurring Payments Feature Rebuild

## Overview

This plan implements the recurring payments feature rebuild using a pre-calculation approach that leverages the existing scheduled payment infrastructure. Each recurring payment is converted into multiple independent scheduled jobs created upfront with calculated execution times.

## Tasks

- [ ] 1. Set up recurring payment infrastructure and interfaces
  - Create recurring payment parser module with comprehensive regex patterns
  - Define TypeScript-style interfaces for recurring commands and validation
  - Set up series ID generation and validation utilities
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Implement core recurring pattern detection and parsing
  - [ ] 2.1 Implement comprehensive regex-based command parser
    - Create powerful regex patterns for "every [interval]", "[number] times", "for [duration]" variations
    - Implement pattern matching for complex command combinations
    - Add extraction logic for interval values, units, and repetition counts
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.2 Write property test for command parsing consistency
    - **Property 1: Command Parsing Consistency**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ] 2.3 Implement parameter validation and sanitization
    - Add validation for minimum intervals (60 seconds) and maximum limits
    - Implement conversion logic between different duration formats
    - Add error handling for invalid syntax with helpful suggestions
    - _Requirements: 1.5, 1.6, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.4 Write unit tests for parameter validation
    - Test boundary conditions and error cases
    - Test conversion logic between duration formats
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Implement series calculation and job generation
  - [ ] 3.1 Create series calculator for execution time computation
    - Implement precise timestamp calculation with interval arithmetic
    - Add timezone and daylight saving time handling
    - Create job data structure generation with series metadata
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 3.2 Write property test for series job count preservation
    - **Property 2: Series Job Count Preservation**
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 3.3 Write property test for time calculation monotonicity
    - **Property 3: Time Calculation Monotonicity**
    - **Validates: Requirements 6.1, 6.3**

  - [ ] 3.4 Implement atomic job series creation with database transactions
    - Add batch job insertion with rollback on failure
    - Implement series metadata tracking and validation
    - Add job series insertion error handling and recovery
    - _Requirements: 2.5, 8.1, 8.2_

  - [ ]* 3.5 Write property test for series atomicity
    - **Property 4: Series Atomicity**
    - **Validates: Requirements 2.5, 8.1**

- [ ] 4. Checkpoint - Ensure core parsing and calculation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement series management and lifecycle operations
  - [ ] 5.1 Create series cancellation handler with authorization
    - Implement series cancellation with user authorization checks
    - Add status updates for pending jobs in series
    - Create series cancellation confirmation and reporting
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 5.2 Write property test for authorization verification
    - **Property 7: Authorization Verification**
    - **Validates: Requirements 4.1, 4.3, 4.5**

  - [ ] 5.3 Implement series status and progress tracking
    - Add series progress calculation and status reporting
    - Create series history and completion tracking
    - Implement series information display with context
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.4 Write unit tests for series management operations
    - Test cancellation flows and authorization checks
    - Test progress tracking and status updates
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 6. Integrate with existing scheduled payment infrastructure
  - [ ] 6.1 Enhance existing schedule handler for recurring payments
    - Modify `src/handlers/schedule.js` to use new recurring parser
    - Integrate series creation with existing job creation pipeline
    - Add recurring payment confirmation and notification logic
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 6.2 Implement job execution independence and error isolation
    - Ensure individual job processing without series dependencies
    - Add series context to job notifications while maintaining independence
    - Implement isolated status updates for individual jobs
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 6.3 Write property test for job execution independence
    - **Property 5: Job Execution Independence**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 6.4 Write property test for series metadata consistency
    - **Property 8: Series Metadata Consistency**
    - **Validates: Requirements 2.4, 5.4**

- [ ] 7. Implement comprehensive error handling and recovery
  - [ ] 7.1 Add robust error handling for all failure scenarios
    - Implement transaction rollback for failed series creation
    - Add comprehensive error logging and audit trails
    - Create error recovery procedures for database issues
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 7.2 Implement validation boundary enforcement
    - Add strict validation for all parameter limits
    - Implement safety checks for abuse prevention
    - Create clear error messages for validation failures
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 7.3 Write property test for validation boundary enforcement
    - **Property 6: Validation Boundary Enforcement**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 7.4 Write property test for status update isolation
    - **Property 9: Status Update Isolation**
    - **Validates: Requirements 4.2, 5.5**

- [ ] 8. Checkpoint - Ensure integration and error handling tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Final integration and testing
  - [ ] 9.1 Wire all components together in main handler
    - Connect recurring parser to existing command processing flow
    - Integrate series management with Telegram bot responses
    - Add comprehensive logging and monitoring for recurring payments
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 9.2 Implement backward compatibility preservation
    - Ensure existing scheduled payment functionality remains unchanged
    - Maintain compatibility with current API and command formats
    - Verify no disruption to existing infrastructure
    - _Requirements: 9.5_

  - [ ]* 9.3 Write integration tests for complete recurring payment flow
    - Test end-to-end recurring payment creation and execution
    - Test series cancellation and status tracking flows
    - Test error scenarios and recovery procedures
    - _Requirements: 1.1-9.5 (comprehensive coverage)_

- [ ] 10. Final checkpoint - Ensure all tests pass and system is ready
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties from the design
- The implementation leverages existing infrastructure to minimize system changes
- All recurring payments are converted to independent scheduled jobs for reliability
- Series metadata enables tracking and management while maintaining job independence

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.4"] },
    { "id": 3, "tasks": ["2.4", "3.3", "3.5", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 5, "tasks": ["5.4", "6.2", "7.1"] },
    { "id": 6, "tasks": ["6.3", "6.4", "7.2"] },
    { "id": 7, "tasks": ["7.3", "7.4", "9.1"] },
    { "id": 8, "tasks": ["9.2"] },
    { "id": 9, "tasks": ["9.3"] }
  ]
}
```