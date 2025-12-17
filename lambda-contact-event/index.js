const { ConnectClient, StartChatContactCommand, DescribeContactCommand } = require('@aws-sdk/client-connect');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const connectClient = new ConnectClient({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const INSTANCE_ID = process.env.CONNECT_INSTANCE_ID;
const TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME;
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT;

// Helper function to extract UserId from contact attributes
async function getUserIdFromContact(contactId) {
  console.log('Fetching contact attributes from DescribeContact API...');
  try {
    const describeCommand = new DescribeContactCommand({
      InstanceId: INSTANCE_ID,
      ContactId: contactId
    });
    const contactDetails = await connectClient.send(describeCommand);
    console.log('Contact details from DescribeContact:', JSON.stringify(contactDetails.Contact?.Attributes, null, 2));
    const userId = contactDetails.Contact?.Attributes?.userId;
    console.log('Extracted UserId from DescribeContact:', userId);
    return userId;
  } catch (error) {
    console.error('Failed to describe contact:', error);
    return null;
  }
}

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
        
        // Extract UserId from contact attributes
        const userId = await getUserIdFromContact(contactId);
        
        if (!userId) {
          console.warn('=== MISSING USERID ERROR ===');
          console.warn('No UserId found in contact attributes for voice contact:', contactId);
          console.warn('This may indicate that the frontend did not properly set the UserId in contact attributes');
          console.warn('Skipping WebSocket notification for this contact');
          return { statusCode: 200, body: 'No UserId found in contact attributes - skipping notification' };
        }
        
        // Find WebSocket connection using UserId
        console.log('Looking up WebSocket connection for UserId:', userId);
        const connection = await findConnectionByUserId(userId);
        
        if (!connection) {
          console.warn('=== CONNECTION NOT FOUND (VOICE) ===');
          console.warn('No WebSocket connection found for UserId:', userId);
          console.warn('This may indicate that the user disconnected or the connection was not properly registered');
          console.warn('Skipping WebSocket notification for this voice contact');
          return { statusCode: 200, body: 'No WebSocket connection found - user may have disconnected' };
        }
        
        console.log('Found WebSocket connection:', connection.connectionId);
        
        // Create chat contact with voice contactId as related contact
        console.log('Creating chat contact...');
        const chatContact = await createChatContact(contactId);
        
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
          userId: userId
        });
        
        console.log('Successfully processed voice CONNECTED_TO_AGENT event');
        return { statusCode: 200, body: 'Success' };
        
      } else if (channel === 'CHAT') {
        // Chat agent connected - notify frontend
        console.log('Chat agent connected - notifying frontend');
        
        // Extract UserId from contact attributes
        const userId = await getUserIdFromContact(contactId);
        
        if (!userId) {
          console.warn('=== MISSING USERID ERROR ===');
          console.warn('No UserId found in chat contact attributes');
          console.warn('Contact ID:', contactId);
          console.warn('This may indicate that the chat contact was not created with proper UserId attributes');
          console.warn('Skipping WebSocket notification for this contact');
          return { statusCode: 200, body: 'No UserId found in contact attributes - skipping notification' };
        }
        
        console.log('Found UserId:', userId);
        
        // Find WebSocket connection using UserId
        console.log('Looking up WebSocket connection for UserId:', userId);
        const connection = await findConnectionByUserId(userId);
        
        if (!connection) {
          console.warn('=== CONNECTION NOT FOUND (CHAT) ===');
          console.warn('No WebSocket connection found for UserId:', userId);
          console.warn('This may indicate that the user disconnected or the connection was not properly registered');
          console.warn('Skipping WebSocket notification for this chat contact');
          return { statusCode: 200, body: 'No WebSocket connection found - user may have disconnected' };
        }
        
        console.log('Found WebSocket connection:', connection.connectionId);
        
        // Send agent connected event to frontend
        console.log('Sending chat agent connected event to frontend...');
        await sendToWebSocket(connection.connectionId, {
          type: 'CHAT_AGENT_CONNECTED',
          chatContactId: contactId,
          userId: userId
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

async function findConnectionByUserId(userId) {
  console.log(`Looking up connection by userId: ${userId}`);
  
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'userIdIndex',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });
  
  const result = await docClient.send(command);
  const connection = result.Items && result.Items.length > 0 ? result.Items[0] : null;
  
  if (connection) {
    console.log(`Found connection ${connection.connectionId}`);
  } else {
    console.log(`No connection found for userId: ${userId}`);
  }
  
  return connection;
}

async function createChatContact(voiceContactId) {
  console.log('Creating chat contact with relatedContactId:', voiceContactId);
  
  // First get the UserId from the voice contact to pass it to the chat contact
  const userId = await getUserIdFromContact(voiceContactId);
  console.log('Using UserId for chat contact:', userId);
  
  const attributes = {
    relatedContactId: voiceContactId
  };
  
  // Add UserId to chat contact attributes if available
  if (userId) {
    attributes.userId = userId;
    console.log('Adding UserId to chat contact attributes:', userId);
  } else {
    console.warn('No UserId available to add to chat contact attributes');
  }
  
  const command = new StartChatContactCommand({
    InstanceId: INSTANCE_ID,
    ContactFlowId: process.env.CONNECT_CONTACT_FLOW_ID || 'c539c831-a1fa-4b03-8438-568143a865dd',
    ParticipantDetails: {
      DisplayName: 'Customer'
    },
    Attributes: attributes
  });
  
  const response = await connectClient.send(command);
  console.log('Chat contact created successfully with attributes:', attributes);
  
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