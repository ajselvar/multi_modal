# WebSocket UserId Integration Tests

## Overview

This directory contains integration tests for the WebSocket UserId optimization feature. The tests validate the end-to-end flow of UserId-based WebSocket connections and contact routing.

## Test Approach

The integration tests use a **logic-based testing approach** that validates the business logic and data flow between components without requiring AWS infrastructure. This approach:

- ✅ Tests core business logic and integration points
- ✅ Validates data transformations and routing logic
- ✅ Runs quickly without AWS dependencies
- ✅ Can be run in CI/CD pipelines
- ✅ Provides clear documentation of expected behavior

## What is Tested

### Requirements Coverage

The tests validate all key requirements from the specification:

1. **Requirement 1.1**: WebSocket connections store UserId as primary identifier
2. **Requirement 1.2**: Registration messages use UserId
3. **Requirement 1.3**: Frontend generates unique random UserId
4. **Requirement 1.4**: Contact attributes include UserId
5. **Requirement 1.5**: Connection lookup uses UserId
6. **Requirement 2.2**: Contact events extract UserId from attributes
7. **Requirement 2.4**: Same UserId routes to same connection
8. **Requirement 3.1**: UserId generation produces unique values
9. **Requirement 3.2**: WebSocket registration uses UserId
10. **Requirement 3.3**: Session persistence maintains UserId

### Test Scenarios

1. **UserId Generation**: Validates UUID format and uniqueness
2. **Session Persistence**: Verifies UserId persists across operations
3. **Registration Messages**: Validates message format with UserId
4. **Contact Attributes**: Verifies UserId inclusion in contacts
5. **UserId Extraction**: Tests extracting UserId from contact attributes
6. **Connection Lookup**: Validates finding connections by UserId
7. **Multi-Contact Routing**: Verifies same UserId routes to same connection
8. **End-to-End Flow**: Complete simulation from generation to routing
9. **Multi-Modal Scenario**: Tests voice + chat with same UserId
10. **Error Handling**: Validates graceful handling of missing data

## Running the Tests

### Prerequisites

```bash
npm install
```

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Specific Test File

```bash
node --test tests/integration/websocket-userid-flow.test.js
```

## Test Output

The tests provide detailed output showing:
- ✅ Validation checkpoints
- 🔄 Flow simulation steps
- ✓ Individual step completion
- 📊 Test summary with pass/fail counts

Example output:
```
🧪 Running WebSocket UserId Integration Tests...

✅ UserId generation validated
✅ Session persistence validated
...

🔄 Simulating end-to-end flow...

✓ Step 1: UserId generated and persisted: c3854104-...
✓ Step 2: WebSocket connected: conn-59ad3ac3-...
...

✅ End-to-end flow completed successfully
```

## Integration with AWS Infrastructure

While these tests validate the logic without AWS, the actual Lambda functions have been deployed and tested with real AWS infrastructure:

- ✅ DynamoDB connections table with userIdIndex GSI
- ✅ WebSocket Lambda with UserId registration
- ✅ Contact Event Lambda with UserId extraction
- ✅ Frontend with UserId generation and persistence

The logic-based tests ensure that the core business logic is correct, while manual testing with AWS infrastructure validates the complete system integration.

## Future Enhancements

Potential additions to the test suite:

1. **Property-Based Tests**: Use fast-check to generate random test data
2. **Performance Tests**: Validate routing performance with many connections
3. **Concurrency Tests**: Test multiple simultaneous connections
4. **AWS Integration Tests**: Add tests that use LocalStack or AWS SDK mocks

## Related Documentation

- [Requirements Document](../../.kiro/specs/websocket-userid-optimization/requirements.md)
- [Design Document](../../.kiro/specs/websocket-userid-optimization/design.md)
- [Tasks Document](../../.kiro/specs/websocket-userid-optimization/tasks.md)
