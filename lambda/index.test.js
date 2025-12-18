// Set environment variables before requiring the module
process.env.CONNECT_INSTANCE_ID = 'test-instance-id';
process.env.CONNECT_CONTACT_FLOW_ID = 'test-contact-flow-id';
process.env.AWS_REGION = 'us-east-1';

// Mock AWS SDK
const mockConnect = {
  startChatContact: jest.fn(),
  startWebRTCContact: jest.fn(),
  describeContact: jest.fn(),
  stopContact: jest.fn()
};

jest.mock('aws-sdk', () => ({
  Connect: jest.fn(() => mockConnect)
}));

const { handler } = require('./index');

describe('API Lambda - Voice Contact Escalation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleStartVoice - Escalated Voice Contact', () => {
    test('should create escalated voice contact with relatedContactId', async () => {
      // Mock successful related contact validation
      mockConnect.describeContact.mockReturnValue({
        promise: () => Promise.resolve({
          Contact: {
            Id: 'chat-contact-123',
            Channel: 'CHAT',
            State: 'CONNECTED'
          }
        })
      });

      // Mock successful voice contact creation
      mockConnect.startWebRTCContact.mockReturnValue({
        promise: () => Promise.resolve({
          ContactId: 'voice-contact-456',
          ParticipantId: 'participant-789',
          ParticipantToken: 'token-abc',
          ConnectionData: { endpoint: 'wss://example.com' }
        })
      });

      const event = {
        path: '/start-voice-contact',
        body: JSON.stringify({
          displayName: 'Test Customer',
          relatedContactId: 'chat-contact-123'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      
      expect(responseBody.contactId).toBe('voice-contact-456');
      expect(responseBody.participantId).toBe('participant-789');
      expect(responseBody.participantToken).toBe('token-abc');
      expect(responseBody.connectionData).toEqual({ endpoint: 'wss://example.com' });
      expect(responseBody.interactionMode).toBe('escalated');

      // Verify related contact validation was called
      expect(mockConnect.describeContact).toHaveBeenCalledWith({
        InstanceId: 'test-instance-id',
        ContactId: 'chat-contact-123'
      });

      // Verify voice contact creation with correct attributes
      expect(mockConnect.startWebRTCContact).toHaveBeenCalledWith({
        InstanceId: 'test-instance-id',
        ContactFlowId: 'test-contact-flow-id',
        ParticipantDetails: {
          DisplayName: 'Test Customer'
        },
        Attributes: {
          InitiationMethod: 'Chat',
          relatedContactId: 'chat-contact-123'
        }
      });
    });

    test('should create regular voice contact without relatedContactId', async () => {
      // Mock successful voice contact creation
      mockConnect.startWebRTCContact.mockReturnValue({
        promise: () => Promise.resolve({
          ContactId: 'voice-contact-456',
          ParticipantId: 'participant-789',
          ParticipantToken: 'token-abc',
          ConnectionData: { endpoint: 'wss://example.com' }
        })
      });

      const event = {
        path: '/start-voice-contact',
        body: JSON.stringify({
          displayName: 'Test Customer'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      
      expect(responseBody.interactionMode).toBe('voice-chat');

      // Verify voice contact creation with Voice InitiationMethod
      expect(mockConnect.startWebRTCContact).toHaveBeenCalledWith({
        InstanceId: 'test-instance-id',
        ContactFlowId: 'test-contact-flow-id',
        ParticipantDetails: {
          DisplayName: 'Test Customer'
        },
        Attributes: {
          InitiationMethod: 'Voice'
        }
      });

      // Verify no related contact validation was called
      expect(mockConnect.describeContact).not.toHaveBeenCalled();
    });

    test('should return error when related contact does not exist', async () => {
      // Mock related contact not found
      mockConnect.describeContact.mockReturnValue({
        promise: () => Promise.reject({
          code: 'ResourceNotFoundException',
          message: 'Contact not found'
        })
      });

      const event = {
        path: '/start-voice-contact',
        body: JSON.stringify({
          displayName: 'Test Customer',
          relatedContactId: 'nonexistent-contact'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      
      expect(responseBody.error).toBe('Related contact not found');
      expect(responseBody.errorCode).toBe('RELATED_CONTACT_NOT_FOUND');
      expect(responseBody.message).toBe('The specified chat contact does not exist');

      // Verify voice contact creation was not called
      expect(mockConnect.startWebRTCContact).not.toHaveBeenCalled();
    });

    test('should return error when related contact is not a chat contact', async () => {
      // Mock related contact that is not a chat contact
      mockConnect.describeContact.mockReturnValue({
        promise: () => Promise.resolve({
          Contact: {
            Id: 'voice-contact-123',
            Channel: 'VOICE',
            State: 'CONNECTED'
          }
        })
      });

      const event = {
        path: '/start-voice-contact',
        body: JSON.stringify({
          displayName: 'Test Customer',
          relatedContactId: 'voice-contact-123'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      
      expect(responseBody.error).toBe('Related contact must be a chat contact');
      expect(responseBody.errorCode).toBe('INVALID_RELATED_CONTACT_TYPE');

      // Verify voice contact creation was not called
      expect(mockConnect.startWebRTCContact).not.toHaveBeenCalled();
    });

    test('should return error when related contact is not active', async () => {
      // Mock related contact that is not active
      mockConnect.describeContact.mockReturnValue({
        promise: () => Promise.resolve({
          Contact: {
            Id: 'chat-contact-123',
            Channel: 'CHAT',
            State: 'ENDED'
          }
        })
      });

      const event = {
        path: '/start-voice-contact',
        body: JSON.stringify({
          displayName: 'Test Customer',
          relatedContactId: 'chat-contact-123'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      
      expect(responseBody.error).toBe('Related contact is not active');
      expect(responseBody.errorCode).toBe('INACTIVE_RELATED_CONTACT');

      // Verify voice contact creation was not called
      expect(mockConnect.startWebRTCContact).not.toHaveBeenCalled();
    });
  });

  describe('handleStartChat - InitiationMethod Attribute', () => {
    test('should create chat contact with InitiationMethod set to Chat', async () => {
      // Mock successful chat contact creation
      mockConnect.startChatContact.mockReturnValue({
        promise: () => Promise.resolve({
          ContactId: 'chat-contact-123',
          ParticipantId: 'participant-456',
          ParticipantToken: 'token-xyz'
        })
      });

      const event = {
        path: '/start-chat-contact',
        body: JSON.stringify({
          displayName: 'Test Customer'
        })
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);

      // Verify chat contact creation with Chat InitiationMethod
      expect(mockConnect.startChatContact).toHaveBeenCalledWith({
        InstanceId: 'test-instance-id',
        ContactFlowId: 'test-contact-flow-id',
        ParticipantDetails: {
          DisplayName: 'Test Customer'
        },
        Attributes: {
          InitiationMethod: 'Chat'
        }
      });
    });
  });
});