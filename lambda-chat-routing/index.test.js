// Mock environment variables first
const originalEnv = process.env;
process.env = {
  ...originalEnv,
  CONNECT_INSTANCE_ID: 'test-instance-id',
  AWS_REGION: 'us-west-2',
  AWS_ACCOUNT_ID: '123456789012',
  DEFAULT_QUEUE_ARN: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/default-queue'
};

// Mock AWS SDK
const mockDescribeContact = jest.fn();
jest.mock('@aws-sdk/client-connect', () => ({
  ConnectClient: jest.fn(() => ({
    send: mockDescribeContact
  })),
  DescribeContactCommand: jest.fn((params) => params)
}));

const { handler } = require('./index');

describe('Routing Lambda - Agent Continuity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  describe('Escalated Contact Routing', () => {
    test('should route escalated voice contact to same agent handling chat', async () => {
      // Arrange
      const event = {
        Details: {
          ContactData: {
            ContactId: 'voice-contact-123',
            Channel: 'VOICE',
            Attributes: {
              relatedContactId: 'chat-contact-456'
            }
          }
        }
      };

      mockDescribeContact.mockResolvedValue({
        Contact: {
          Id: 'chat-contact-456',
          Channel: 'CHAT',
          AgentInfo: {
            Id: 'agent-789',
            Arn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/agent/agent-789'
          },
          QueueInfo: {
            Id: 'queue-123'
          }
        }
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/agent-789'
      });
      expect(mockDescribeContact).toHaveBeenCalledWith({
        InstanceId: 'test-instance-id',
        ContactId: 'chat-contact-456'
      });
    });

    test('should use default queue when no related contact ID provided', async () => {
      // Arrange
      const event = {
        Details: {
          ContactData: {
            ContactId: 'voice-contact-123',
            Channel: 'VOICE',
            Attributes: {}
          }
        }
      };

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/default-queue'
      });
      expect(mockDescribeContact).not.toHaveBeenCalled();
    });

    test('should use default queue when related contact has no agent', async () => {
      // Arrange
      const event = {
        Details: {
          ContactData: {
            ContactId: 'voice-contact-123',
            Channel: 'VOICE',
            Attributes: {
              relatedContactId: 'chat-contact-456'
            }
          }
        }
      };

      mockDescribeContact.mockResolvedValue({
        Contact: {
          Id: 'chat-contact-456',
          Channel: 'CHAT',
          QueueInfo: {
            Id: 'queue-123'
          }
          // No AgentInfo
        }
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/default-queue'
      });
    });

    test('should use default queue when related contact lookup fails', async () => {
      // Arrange
      const event = {
        Details: {
          ContactData: {
            ContactId: 'voice-contact-123',
            Channel: 'VOICE',
            Attributes: {
              relatedContactId: 'chat-contact-456'
            }
          }
        }
      };

      mockDescribeContact.mockRejectedValue(new Error('Contact not found'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/default-queue'
      });
    });

    test('should use default queue when DescribeContact returns null contact', async () => {
      // Arrange
      const event = {
        Details: {
          ContactData: {
            ContactId: 'voice-contact-123',
            Channel: 'VOICE',
            Attributes: {
              relatedContactId: 'chat-contact-456'
            }
          }
        }
      };

      mockDescribeContact.mockResolvedValue({
        // No Contact property
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/default-queue'
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle missing environment variables gracefully', async () => {
      // Arrange
      const originalRegion = process.env.AWS_REGION;
      delete process.env.AWS_REGION;

      const event = {
        Details: {
          ContactData: {
            ContactId: 'voice-contact-123',
            Channel: 'VOICE',
            Attributes: {
              relatedContactId: 'chat-contact-456'
            }
          }
        }
      };

      mockDescribeContact.mockResolvedValue({
        Contact: {
          Id: 'chat-contact-456',
          AgentInfo: {
            Id: 'agent-789'
          }
        }
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/default-queue'
      });

      // Restore environment variable
      process.env.AWS_REGION = originalRegion;
    });

    test('should handle malformed event gracefully', async () => {
      // Arrange
      const event = {
        // Missing Details property
      };

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/default-queue'
      });
    });
  });

  describe('Manual Accept Behavior', () => {
    test('should not include auto-accept flag in routing response', async () => {
      // Arrange
      const event = {
        Details: {
          ContactData: {
            ContactId: 'voice-contact-123',
            Channel: 'VOICE',
            Attributes: {
              relatedContactId: 'chat-contact-456'
            }
          }
        }
      };

      mockDescribeContact.mockResolvedValue({
        Contact: {
          Id: 'chat-contact-456',
          AgentInfo: {
            Id: 'agent-789'
          }
        }
      });

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toEqual({
        queueArn: 'arn:aws:connect:us-west-2:123456789012:instance/test-instance-id/queue/agent-789'
      });
      // Verify no auto-accept properties are included
      expect(result.autoAccept).toBeUndefined();
      expect(result.skipQueue).toBeUndefined();
    });
  });
});