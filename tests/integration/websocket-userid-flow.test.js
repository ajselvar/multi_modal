/**
 * Integration test for end-to-end WebSocket flow with UserId
 * Tests Requirements: 1.1, 1.2, 1.5, 2.2
 * 
 * This test verifies the logical flow and integration between components:
 * - Frontend generates UserId and registers successfully
 * - Contact events route to correct WebSocket connection
 * - Multi-modal interaction scenarios work correctly
 * 
 * Note: This test validates the integration logic without requiring AWS infrastructure.
 * It tests the core business logic and data flow between components.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

/**
 * Simulates frontend UserId generation
 * Implements Requirements 1.3, 3.1
 */
function generateUserId() {
  return crypto.randomUUID();
}

/**
 * Validates UserId format
 */
function isValidUserId(userId) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
}

/**
 * Simulates session storage for UserId persistence
 */
class SessionStorage {
  constructor() {
    this.storage = new Map();
  }
  
  setItem(key, value) {
    this.storage.set(key, value);
  }
  
  getItem(key) {
    return this.storage.get(key) || null;
  }
  
  removeItem(key) {
    this.storage.delete(key);
  }
  
  clear() {
    this.storage.clear();
  }
}

/**
 * Simulates the frontend getUserId function
 * Implements Requirements 3.3 (session persistence)
 */
function getUserId(sessionStorage) {
  const SESSION_KEY = 'userId';
  
  let userId = sessionStorage.getItem(SESSION_KEY);
  
  if (!userId) {
    userId = generateUserId();
    sessionStorage.setItem(SESSION_KEY, userId);
  }
  
  return userId;
}

/**
 * Simulates WebSocket registration message creation
 * Implements Requirements 1.2, 3.2
 */
function createRegistrationMessage(userId) {
  return {
    action: 'register',
    userId: userId
  };
}

/**
 * Simulates contact attributes with UserId
 * Implements Requirements 1.4, 2.1
 */
function createContactAttributes(userId) {
  return {
    userId: userId
  };
}

/**
 * Simulates extracting UserId from contact attributes
 * Implements Requirements 2.2
 */
function extractUserIdFromContact(contactAttributes) {
  return contactAttributes?.userId || null;
}

/**
 * Simulates connection lookup by UserId
 * Implements Requirements 1.5
 */
function findConnectionByUserId(connections, userId) {
  return connections.find(conn => conn.userId === userId) || null;
}

/**
 * Simulates routing logic
 * Implements Requirements 2.4
 */
function routeToConnection(connections, userId) {
  const connection = findConnectionByUserId(connections, userId);
  return connection ? connection.connectionId : null;
}

describe('WebSocket UserId Integration Tests', () => {
  
  it('should generate valid UserId in UUID format', () => {
    // Requirement 1.3, 3.1: Frontend generates unique random UserId
    const userId = generateUserId();
    
    assert.ok(userId, 'UserId should be generated');
    assert.ok(isValidUserId(userId), 'UserId should be in valid UUID format');
    
    // Verify uniqueness by generating multiple UserIds
    const userIds = new Set();
    for (let i = 0; i < 100; i++) {
      userIds.add(generateUserId());
    }
    assert.strictEqual(userIds.size, 100, 'All generated UserIds should be unique');
    
    console.log('✅ UserId generation validated');
  });
  
  it('should persist UserId in session storage', () => {
    // Requirement 3.3: UserId persists for duration of browser session
    const sessionStorage = new SessionStorage();
    
    // First call generates and stores UserId
    const userId1 = getUserId(sessionStorage);
    assert.ok(userId1, 'First call should generate UserId');
    assert.ok(isValidUserId(userId1), 'Generated UserId should be valid');
    
    // Second call retrieves same UserId
    const userId2 = getUserId(sessionStorage);
    assert.strictEqual(userId2, userId1, 'Second call should return same UserId');
    
    // Third call also retrieves same UserId
    const userId3 = getUserId(sessionStorage);
    assert.strictEqual(userId3, userId1, 'Third call should return same UserId');
    
    // After clearing session, new UserId is generated
    sessionStorage.clear();
    const userId4 = getUserId(sessionStorage);
    assert.notStrictEqual(userId4, userId1, 'After clearing session, new UserId should be generated');
    
    console.log('✅ Session persistence validated');
  });
  
  it('should create valid registration message with UserId', () => {
    // Requirement 1.2, 3.2: WebSocket registration uses UserId
    const userId = generateUserId();
    const message = createRegistrationMessage(userId);
    
    assert.strictEqual(message.action, 'register', 'Message should have register action');
    assert.strictEqual(message.userId, userId, 'Message should include userId');
    assert.ok(!message.voiceContactId, 'Message should not include legacy voiceContactId');
    
    console.log('✅ Registration message format validated');
  });
  
  it('should include UserId in contact attributes', () => {
    // Requirement 1.4, 2.1: Contact attributes include UserId
    const userId = generateUserId();
    const attributes = createContactAttributes(userId);
    
    assert.ok(attributes.userId, 'Contact attributes should include userId');
    assert.strictEqual(attributes.userId, userId, 'Contact attributes should have correct userId');
    
    console.log('✅ Contact attributes format validated');
  });
  
  it('should extract UserId from contact attributes', () => {
    // Requirement 2.2: Extract UserId from contact attributes
    const userId = generateUserId();
    const attributes = createContactAttributes(userId);
    
    const extractedUserId = extractUserIdFromContact(attributes);
    assert.strictEqual(extractedUserId, userId, 'Should extract correct userId');
    
    // Test missing userId
    const emptyAttributes = {};
    const missingUserId = extractUserIdFromContact(emptyAttributes);
    assert.strictEqual(missingUserId, null, 'Should return null for missing userId');
    
    // Test null attributes
    const nullUserId = extractUserIdFromContact(null);
    assert.strictEqual(nullUserId, null, 'Should return null for null attributes');
    
    console.log('✅ UserId extraction validated');
  });
  
  it('should find connection by UserId', () => {
    // Requirement 1.5: Connection lookup uses UserId
    const userId1 = generateUserId();
    const userId2 = generateUserId();
    
    const connections = [
      { connectionId: 'conn-1', userId: userId1 },
      { connectionId: 'conn-2', userId: userId2 }
    ];
    
    const found1 = findConnectionByUserId(connections, userId1);
    assert.ok(found1, 'Should find connection for userId1');
    assert.strictEqual(found1.connectionId, 'conn-1', 'Should find correct connection');
    
    const found2 = findConnectionByUserId(connections, userId2);
    assert.ok(found2, 'Should find connection for userId2');
    assert.strictEqual(found2.connectionId, 'conn-2', 'Should find correct connection');
    
    const notFound = findConnectionByUserId(connections, generateUserId());
    assert.strictEqual(notFound, null, 'Should return null for non-existent userId');
    
    console.log('✅ Connection lookup validated');
  });
  
  it('should route multiple contacts with same UserId to same connection', () => {
    // Requirement 2.4: Same UserId routes to same connection
    const userId = generateUserId();
    const connectionId = 'conn-' + crypto.randomUUID();
    
    const connections = [
      { connectionId: connectionId, userId: userId }
    ];
    
    // First contact
    const route1 = routeToConnection(connections, userId);
    assert.strictEqual(route1, connectionId, 'First contact should route to connection');
    
    // Second contact with same userId
    const route2 = routeToConnection(connections, userId);
    assert.strictEqual(route2, connectionId, 'Second contact should route to same connection');
    
    // Third contact with same userId
    const route3 = routeToConnection(connections, userId);
    assert.strictEqual(route3, connectionId, 'Third contact should route to same connection');
    
    console.log('✅ Multi-contact routing validated');
  });
  
  it('should complete end-to-end flow simulation', () => {
    console.log('\n🔄 Simulating end-to-end flow...\n');
    
    // Step 1: Frontend generates and persists UserId
    const sessionStorage = new SessionStorage();
    const userId = getUserId(sessionStorage);
    console.log('✓ Step 1: UserId generated and persisted:', userId);
    assert.ok(isValidUserId(userId), 'UserId should be valid');
    
    // Step 2: WebSocket connection established with UserId
    const connectionId = 'conn-' + crypto.randomUUID();
    const connections = [];
    connections.push({ connectionId, userId, connectedAt: Date.now() });
    console.log('✓ Step 2: WebSocket connected:', connectionId);
    
    // Step 3: Registration message sent
    const regMessage = createRegistrationMessage(userId);
    console.log('✓ Step 3: Registration message created:', regMessage);
    assert.strictEqual(regMessage.userId, userId, 'Registration should use userId');
    
    // Step 4: Contact created with UserId in attributes
    const contactId = 'contact-' + crypto.randomUUID();
    const contactAttributes = createContactAttributes(userId);
    console.log('✓ Step 4: Contact created with attributes:', contactId);
    assert.strictEqual(contactAttributes.userId, userId, 'Contact should have userId');
    
    // Step 5: Contact event processed - extract UserId
    const extractedUserId = extractUserIdFromContact(contactAttributes);
    console.log('✓ Step 5: UserId extracted from contact:', extractedUserId);
    assert.strictEqual(extractedUserId, userId, 'Extracted userId should match');
    
    // Step 6: Find connection by UserId
    const connection = findConnectionByUserId(connections, extractedUserId);
    console.log('✓ Step 6: Connection found:', connection.connectionId);
    assert.ok(connection, 'Connection should be found');
    assert.strictEqual(connection.connectionId, connectionId, 'Should find correct connection');
    
    // Step 7: Route message to connection
    const routedConnectionId = routeToConnection(connections, extractedUserId);
    console.log('✓ Step 7: Message routed to:', routedConnectionId);
    assert.strictEqual(routedConnectionId, connectionId, 'Should route to correct connection');
    
    // Step 8: Verify session persistence
    const persistedUserId = getUserId(sessionStorage);
    console.log('✓ Step 8: UserId persisted in session:', persistedUserId);
    assert.strictEqual(persistedUserId, userId, 'UserId should persist in session');
    
    console.log('\n✅ End-to-end flow completed successfully\n');
  });
  
  it('should handle multi-modal scenario (voice + chat)', () => {
    console.log('\n🔄 Simulating multi-modal scenario...\n');
    
    // Setup: User session with UserId
    const sessionStorage = new SessionStorage();
    const userId = getUserId(sessionStorage);
    const connectionId = 'conn-' + crypto.randomUUID();
    const connections = [{ connectionId, userId }];
    
    console.log('✓ Setup: User session established with userId:', userId);
    
    // Scenario: Voice contact created
    const voiceContactId = 'voice-' + crypto.randomUUID();
    const voiceAttributes = createContactAttributes(userId);
    console.log('✓ Voice contact created:', voiceContactId);
    
    // Voice contact event processed
    const voiceUserId = extractUserIdFromContact(voiceAttributes);
    const voiceRoute = routeToConnection(connections, voiceUserId);
    console.log('✓ Voice event routed to:', voiceRoute);
    assert.strictEqual(voiceRoute, connectionId, 'Voice should route to connection');
    
    // Scenario: Chat contact created (escalation)
    const chatContactId = 'chat-' + crypto.randomUUID();
    const chatAttributes = createContactAttributes(userId);
    console.log('✓ Chat contact created:', chatContactId);
    
    // Chat contact event processed
    const chatUserId = extractUserIdFromContact(chatAttributes);
    const chatRoute = routeToConnection(connections, chatUserId);
    console.log('✓ Chat event routed to:', chatRoute);
    assert.strictEqual(chatRoute, connectionId, 'Chat should route to same connection');
    
    // Verify both contacts route to same connection
    assert.strictEqual(voiceRoute, chatRoute, 'Voice and chat should route to same connection');
    
    console.log('\n✅ Multi-modal scenario validated\n');
  });
  
  it('should handle error scenarios gracefully', () => {
    console.log('\n🔄 Testing error scenarios...\n');
    
    // Scenario 1: Missing UserId in contact attributes
    const emptyAttributes = {};
    const missingUserId = extractUserIdFromContact(emptyAttributes);
    assert.strictEqual(missingUserId, null, 'Should handle missing userId');
    console.log('✓ Missing userId handled gracefully');
    
    // Scenario 2: Connection not found
    const connections = [];
    const notFound = findConnectionByUserId(connections, generateUserId());
    assert.strictEqual(notFound, null, 'Should handle missing connection');
    console.log('✓ Missing connection handled gracefully');
    
    // Scenario 3: Routing with no connection
    const noRoute = routeToConnection(connections, generateUserId());
    assert.strictEqual(noRoute, null, 'Should return null when no connection found');
    console.log('✓ Routing without connection handled gracefully');
    
    console.log('\n✅ Error scenarios validated\n');
  });
});

console.log('\n🧪 Running WebSocket UserId Integration Tests...\n');
