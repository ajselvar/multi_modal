// UserId management for session identification
// Implements Requirements 1.3, 3.1

/**
 * Generates a unique random UserId using cryptographically secure random generation
 * @returns {string} A unique UserId in UUID format
 */
export function generateUserId() {
  // Use crypto.randomUUID() for secure random generation
  // This is available in modern browsers and provides cryptographically strong random values
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers (though this should rarely be needed)
  // Generate a UUID v4 format manually
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Gets the current UserId from sessionStorage, or generates a new one if not present
 * Implements session persistence (Requirement 3.3)
 * @returns {string} The current session's UserId
 */
export function getUserId() {
  const SESSION_KEY = 'userId';
  
  // Try to retrieve existing UserId from sessionStorage
  let userId = sessionStorage.getItem(SESSION_KEY);
  
  // If no UserId exists, generate a new one and store it
  if (!userId) {
    userId = generateUserId();
    sessionStorage.setItem(SESSION_KEY, userId);
    console.log('Generated new UserId:', userId);
  } else {
    console.log('Retrieved existing UserId from session:', userId);
  }
  
  return userId;
}

/**
 * Clears the stored UserId from sessionStorage
 * Useful for testing or manual session reset
 */
export function clearUserId() {
  sessionStorage.removeItem('userId');
  console.log('UserId cleared from session');
}
