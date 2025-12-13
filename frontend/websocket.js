// WebSocket client for real-time communication
import { config } from './config.js';

export class WebSocketClient {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.messageHandlers = new Map();
    this.interactionMode = null; // Store interaction mode for connection metadata
  }

  connect(interactionMode = null) {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = config.websocket.url;
        console.log('Connecting to WebSocket:', wsUrl, 'with mode:', interactionMode);

        // Store interaction mode for use in messages
        this.interactionMode = interactionMode;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;

          // Send connection metadata including interaction mode
          if (this.interactionMode) {
            this.sendConnectionMetadata();
          }

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
        this.connect(this.interactionMode).catch(error => {
          console.error('Reconnect failed:', error);
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
        });
      }
    }, this.reconnectDelay);
  }

  sendConnectionMetadata() {
    if (!this.isConnected) {
      console.error('WebSocket not connected, cannot send connection metadata');
      return;
    }

    const metadata = {
      type: 'connection',
      interactionMode: this.interactionMode,
      timestamp: new Date().toISOString()
    };

    console.log('Sending connection metadata:', metadata);
    this.send(metadata);
  }

  registerForVoiceContact(voiceContactId) {
    if (!this.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    const message = {
      action: 'register',
      voiceContactId: voiceContactId,
      interactionMode: this.interactionMode // Include mode in registration
    };

    console.log('Registering for voice contact:', voiceContactId, 'with mode:', this.interactionMode);
    this.send(message);
  }

  send(message) {
    if (!this.isConnected || !this.ws) {
      console.error('WebSocket not connected, cannot send message');
      return;
    }

    try {
      // Include interaction mode in all messages if available
      const messageWithMode = {
        ...message,
        interactionMode: this.interactionMode
      };

      this.ws.send(JSON.stringify(messageWithMode));
      console.log('WebSocket message sent:', messageWithMode);
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
      this.interactionMode = null; // Clear interaction mode on disconnect
    }
  }
}

// Global WebSocket client instance
export const wsClient = new WebSocketClient();
