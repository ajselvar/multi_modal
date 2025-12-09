// Chat Widget using amazon-connect-chatjs
import { config } from './config.js';
import { updateStatus, displayMessage, displayError, callAPI, enableChatInput } from './app.js';

export const ChatWidget = {
    session: null,
    contactId: null,

    async start() {
        console.log('--- ChatWidget.start() called ---');
        updateStatus('Connecting to chat...');

        try {
            // Call Lambda to get contact details
            const contactData = await callAPI('/start-chat-contact', {});
            console.log('Chat contact data received:', contactData);

            // Store contact ID for later use
            this.contactId = contactData.contactId;

            // Initialize amazon-connect-chatjs
            const chatSession = connect.ChatSession.create({
                chatDetails: {
                    contactId: contactData.contactId,
                    participantId: contactData.participantId,
                    participantToken: contactData.participantToken
                },
                type: connect.ChatSession.SessionTypes.CUSTOMER,
                options: {
                    region: config.aws.region
                }
            });

            this.session = chatSession;

            // Set up event handlers
            this.session.onMessage(this.handleMessage.bind(this));
            this.session.onConnectionEstablished(this.handleConnected.bind(this));
            this.session.onConnectionBroken(this.handleDisconnected.bind(this));
            this.session.onEnded(this.handleEnded.bind(this));

            // Connect
            await this.session.connect();

            console.log('Chat session connected successfully');
        } catch (error) {
            console.error('Failed to start chat:', error);
            updateStatus('Chat connection failed');
            displayError('Failed to start chat: ' + error.message);
        }
    },

    handleConnected() {
        console.log('Chat connection established');
        updateStatus('Chat connected');
        
        displayMessage('✓ Connected to agent. You can start chatting!', 'system');

        // Enable chat input
        enableChatInput(true);
    },

    handleMessage(event) {
        console.log('Message received:', event);

        const data = event.data;
        const participantRole = data.ParticipantRole;
        const content = data.Content;
        
        // Skip messages without content
        if (!content || content === 'undefined') {
            console.log('Skipping message without content');
            return;
        }
        
        // Skip system messages
        if (participantRole === 'SYSTEM') {
            console.log('Skipping system message:', content);
            return;
        }
        
        // Skip our own messages (we already displayed them when sending)
        if (participantRole === 'CUSTOMER') {
            console.log('Skipping own message (already displayed)');
            return;
        }
        
        // Display agent messages
        const displayName = data.DisplayName || 'Agent';
        displayMessage(content, 'agent', displayName);
    },

    handleDisconnected() {
        console.log('Chat connection broken');
        updateStatus('Chat disconnected');
        displayError('Chat connection lost');
    },

    handleEnded() {
        console.log('Chat session ended');
        updateStatus('Chat ended');

        // Disable chat input
        enableChatInput(false);

        // Clear contact ID
        this.contactId = null;
    },

    async end() {
        console.log('--- ChatWidget.end() called ---');
        
        if (!this.contactId) {
            console.error('No active contact to end');
            displayError('No active chat session');
            return;
        }

        try {
            updateStatus('Ending chat...');
            
            // Call Lambda to stop the contact
            await callAPI('/stop-contact', { contactId: this.contactId });
            console.log('Contact stopped successfully');
            
            // Disconnect the chat session
            if (this.session) {
                this.session.disconnectParticipant();
            }
            
            displayMessage('Chat ended by customer', 'system');
            
        } catch (error) {
            console.error('Failed to end chat:', error);
            displayError('Failed to end chat: ' + error.message);
        }
    },

    sendMessage(text) {
        if (!this.session) {
            console.error('No active chat session');
            return;
        }

        if (!text || text.trim() === '') {
            console.warn('Empty message, not sending');
            return;
        }

        console.log('Sending message:', text);

        this.session.sendMessage({
            contentType: 'text/plain',
            message: text
        });

        // Display own message
        displayMessage(text, 'customer');
    },

    // Initialize chat with provided contact details (for automatic chat creation via WebSocket)
    async initializeWithDetails(contactId, participantId, participantToken) {
        console.log('--- ChatWidget.initializeWithDetails() called ---');
        console.log('Contact details:', { contactId, participantId, participantToken });

        try {
            // Store contact ID
            this.contactId = contactId;

            // Initialize amazon-connect-chatjs with provided details
            const chatSession = connect.ChatSession.create({
                chatDetails: {
                    contactId: contactId,
                    participantId: participantId,
                    participantToken: participantToken
                },
                type: connect.ChatSession.SessionTypes.CUSTOMER,
                options: {
                    region: config.aws.region
                }
            });

            this.session = chatSession;

            // Set up event handlers
            this.session.onMessage(this.handleMessage.bind(this));
            this.session.onConnectionEstablished(this.handleConnected.bind(this));
            this.session.onConnectionBroken(this.handleDisconnected.bind(this));
            this.session.onEnded(this.handleEnded.bind(this));

            // Connect
            await this.session.connect();

            console.log('Chat session initialized with provided details');
        } catch (error) {
            console.error('Failed to initialize chat with details:', error);
            updateStatus('Chat initialization failed');
            displayError('Failed to initialize chat: ' + error.message);
        }
    }
};
