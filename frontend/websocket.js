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
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = config.websocket.url;
        console.log('Connecting to WebSocket:', wsUrl);

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
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

  registerForVoiceContact(voiceContactId) {
    if (!this.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    const message = {
      action: 'register',
      voiceContactId: voiceContactId
    };

    console.log('Registering for voice contact:', voiceContactId);
    this.send(message);
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
