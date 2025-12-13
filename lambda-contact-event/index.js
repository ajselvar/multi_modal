const { ConnectClient, StartChatContactCommand } = require('@aws-sdk/client-connect');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const connectClient = new ConnectClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const INSTANCE_ID = process.env.CONNECT_INSTANCE_ID;
const TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME;
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT;

exports.handler = async (event) => {
  console.log('=== Contact Event Handler ===');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    const { detail } = event;
    const { contactId, eventType, channel, agentInfo } = detail;
    
    console.log('Processing event:', {
      contactId,
      eventType,
      channel,
      agentArn: agentInfo?.agentArn
    });
    
    // Handle CONNECTED_TO_AGENT event
    if (eventType === 'CONNECTED_TO_AGENT') {
      if (channel === 'VOICE') {
        // Voice agent connected - create chat contact
        console.log('Voice agent connected - creating chat contact');
        
        // Find WebSocket connection for this voice contact
        console.log('Looking up WebSocket connection for voice contact:', contactId);
        const connection = await findConnectionByVoiceContactId(contactId);
        
        if (!connection) {
          console.warn('No WebSocket connection found for voice contact:', contactId);
          return { statusCode: 200, body: 'No WebSocket connection found' };
        }
        
        console.log('Found WebSocket connection:', connection.connectionId);
        
        // Create chat contact with voice contactId as related contact
        console.log('Creating chat contact...');
        const chatContact = await createChatContact(contactId, connection.interactionMode || 'voice-chat');
        
        console.log('Chat contact created:', {
          contactId: chatContact.ContactId,
          participantId: chatContact.ParticipantId
        });
        
        // Send chat contact details to frontend via WebSocket
        console.log('Sending chat contact details to frontend...');
        await sendToWebSocket(connection.connectionId, {
          type: 'CHAT_CONTACT_CREATED',
          chatContactId: chatContact.ContactId,
          participantId: chatContact.ParticipantId,
          participantToken: chatContact.ParticipantToken,
          voiceContactId: contactId,
          interactionMode: connection.interactionMode || 'voice-chat'
        });
        
        console.log('Successfully processed voice CONNECTED_TO_AGENT event');
        return { statusCode: 200, body: 'Success' };
        
      } else if (channel === 'CHAT') {
        // Chat agent connected - notify frontend
        console.log('Chat agent connected - notifying frontend');
        console.log('Chat contact attributes:', JSON.stringify(detail.attributes, null, 2));
        
        // Try to find the related voice contact from attributes
        let relatedContactId = detail.attributes?.relatedContactId;
        
        // If not in attributes, try to get it from the contact using DescribeContact API
        if (!relatedContactId) {
          console.log('relatedContactId not in event attributes, fetching from DescribeContact API...');
          try {
            const { DescribeContactCommand } = require('@aws-sdk/client-connect');
            const describeCommand = new DescribeContactCommand({
              InstanceId: INSTANCE_ID,
              ContactId: contactId
            });
            const contactDetails = await connectClient.send(describeCommand);
            console.log('Contact details:', JSON.stringify(contactDetails, null, 2));
            relatedContactId = contactDetails.Contact?.Attributes?.relatedContactId;
          } catch (error) {
            console.error('Failed to describe contact:', error);
          }
        }
        
        if (!relatedContactId) {
          console.warn('No relatedContactId found in chat contact - cannot determine voice contact');
          console.warn('Event detail:', JSON.stringify(detail, null, 2));
          return { statusCode: 200, body: 'No related contact' };
        }
        
        console.log('Found relatedContactId:', relatedContactId);
        
        // Find WebSocket connection for the voice contact
        console.log('Looking up WebSocket connection for voice contact:', relatedContactId);
        const connection = await findConnectionByVoiceContactId(relatedContactId);
        
        if (!connection) {
          console.warn('No WebSocket connection found for voice contact:', relatedContactId);
          return { statusCode: 200, body: 'No WebSocket connection found' };
        }
        
        console.log('Found WebSocket connection:', connection.connectionId);
        
        // Send agent connected event to frontend
        console.log('Sending chat agent connected event to frontend...');
        await sendToWebSocket(connection.connectionId, {
          type: 'CHAT_AGENT_CONNECTED',
          chatContactId: contactId,
          voiceContactId: relatedContactId,
          interactionMode: connection.interactionMode || 'voice-chat'
        });
        
        console.log('Successfully processed chat CONNECTED_TO_AGENT event');
        return { statusCode: 200, body: 'Success' };
      }
    }
    
    console.log('Ignoring event - not a relevant CONNECTED_TO_AGENT event');
    return { statusCode: 200, body: 'Event ignored' };
    
  } catch (error) {
    console.error('=== ERROR in contact event handler ===');
    console.error('Error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function findConnectionByVoiceContactId(voiceContactId) {
  console.log('Querying DynamoDB for voiceContactId:', voiceContactId);
  
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'voiceContactIdIndex',
    KeyConditionExpression: 'voiceContactId = :voiceContactId',
    ExpressionAttributeValues: {
      ':voiceContactId': voiceContactId
    }
  });
  
  const result = await docClient.send(command);
  console.log('DynamoDB query result:', result.Items?.length || 0, 'items found');
  
  const connection = result.Items && result.Items.length > 0 ? result.Items[0] : null;
  
  // Log interaction mode information for session tracking
  if (connection) {
    console.log(`Found connection ${connection.connectionId} with interaction mode: ${connection.interactionMode || 'voice-chat'}`);
  }
  
  return connection;
}

async function createChatContact(voiceContactId, interactionMode = 'voice-chat') {
  console.log('Creating chat contact with relatedContactId:', voiceContactId, 'and interaction mode:', interactionMode);
  
  const command = new StartChatContactCommand({
    InstanceId: INSTANCE_ID,
    ContactFlowId: process.env.CONNECT_CONTACT_FLOW_ID || 'c539c831-a1fa-4b03-8438-568143a865dd',
    ParticipantDetails: {
      DisplayName: 'Customer'
    },
    Attributes: {
      relatedContactId: voiceContactId,
      interactionMode: interactionMode
    }
  });
  
  const response = await connectClient.send(command);
  console.log('Chat contact created successfully with interaction mode:', interactionMode);
  
  return {
    ContactId: response.ContactId,
    ParticipantId: response.ParticipantId,
    ParticipantToken: response.ParticipantToken
  };
}

async function sendToWebSocket(connectionId, message) {
  console.log('Sending message to WebSocket connection:', connectionId);
  console.log('Message:', JSON.stringify(message, null, 2));
  
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint: WEBSOCKET_ENDPOINT
  });
  
  try {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    });
    
    await apiGatewayClient.send(command);
    console.log('Message sent successfully');
  } catch (error) {
    if (error.statusCode === 410) {
      console.log('Connection is stale:', connectionId);
      // Connection is gone, but that's okay - user may have disconnected
    } else {
      console.error('Failed to send message to WebSocket:', error);
      throw error;
    }
  }
}
