// Main entry point for the application
import 'amazon-connect-chatjs';
import { config } from './config.js';
import { ChatWidget } from './chat.js';
import { VoiceWidget } from './voice.js';
import { wsClient } from './websocket.js';
import { displayMessage } from './app.js';
import './app.js';

// Set up WebSocket message handlers
wsClient.onMessage('chatContactCreated', (message) => {
  console.log('Chat contact created automatically:', message.data);
  const { contactId, participantId, participantToken } = message.data;

  // Automatically initialize chat with the provided details
  ChatWidget.initializeWithDetails(contactId, participantId, participantToken);
  displayMessage('✓ Chat automatically connected! You can now type messages.', 'system');
});

wsClient.onMessage('error', (message) => {
  console.error('WebSocket error message:', message);
  displayMessage('WebSocket error: ' + (message.error || 'Unknown error'), 'system');
});

// Make config, ChatWidget, VoiceWidget, and wsClient available globally for compatibility
window.APP_CONFIG = config;
window.ChatWidget = ChatWidget;
window.VoiceWidget = VoiceWidget;
window.wsClient = wsClient;
