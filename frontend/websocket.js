// WebSocket client for real-time communication
import { config } from './config.js';
import { getUserId } from './userId.js';

export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.messageHandlers = new Map();
    this.userId = null; // Store userId for this session
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = config.websocket.url;
        console.log('Connecting to WebSocket:', wsUrl);
        
        // Get or generate UserId for this session
        this.userId = getUserId();
        console.log('Using UserId for WebSocket connection:', this.userId);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;

          // Register with UserId immediately after connection
          this.registerWithUserId();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.isConnected = false;

          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect().catch(error => {
          console.error('Reconnect failed:', error);
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
        });
      }
    }, this.reconnectDelay);
  }

  /**
   * Register WebSocket connection with UserId
   * Implements Requirements 1.2, 3.2
   */
  registerWithUserId() {
    if (!this.isConnected) {
      console.error('WebSocket not connected, cannot register');
      return;
    }

    const message = {
      action: 'register',
      userId: this.userId
    };

    console.log('Registering WebSocket with UserId:', this.userId);
    this.send(message);
  }

  /**
   * @deprecated Use registerWithUserId() instead
   * Kept for backward compatibility during migration
   */
  registerForVoiceContact(voiceContactId) {
    console.warn('registerForVoiceContact is deprecated, using UserId registration instead');
    // Just call the new registration method
    this.registerWithUserId();
  }

  send(message) {
    if (!this.isConnected || !this.ws) {
      console.error('WebSocket not connected, cannot send message');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log('WebSocket message sent:', message);
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  handleMessage(message) {
    const { type } = message;

    if (this.messageHandlers.has(type)) {
      const handler = this.messageHandlers.get(type);
      try {
        handler(message);
      } catch (error) {
        console.error(`Error handling message type ${type}:`, error);
      }
    } else {
      console.warn('No handler for message type:', type);
    }
  }

  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  sendTypingIndicator(isTyping, sessionId = null) {
    if (!this.isConnected) {
      console.error('WebSocket not connected, cannot send typing indicator');
      return;
    }

    const message = {
      type: 'typing',
      isTyping: isTyping,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    };

    console.log('Sending typing indicator:', message);
    this.send(message);
  }

  sendChatMessage(content, sessionId = null) {
    if (!this.isConnected) {
      console.error('WebSocket not connected, cannot send chat message');
      return;
    }

    const message = {
      type: 'message',
      content: content,
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    };

    console.log('Sending chat message via WebSocket:', message);
    this.send(message);
  }

  disconnect() {
    if (this.ws) {
      console.log('Disconnecting WebSocket');
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
      this.isConnected = false;
    }
  }
}

// Global WebSocket client instance
export const wsClient = new WebSocketClient();
