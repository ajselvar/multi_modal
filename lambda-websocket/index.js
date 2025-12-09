const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME;

if (!TABLE_NAME) {
  throw new Error('CONNECTIONS_TABLE_NAME environment variable is required');
}

exports.handler = async (event) => {
  console.log('=== WebSocket Handler Invoked ===');
  console.log('Full event:', JSON.stringify(event, null, 2));
  console.log('Environment variables:', {
    TABLE_NAME,
    AWS_REGION: process.env.AWS_REGION
  });
  
  const { routeKey, connectionId, domainName, stage } = event.requestContext;
  
  console.log('Extracted values:', {
    routeKey,
    connectionId,
    domainName,
    stage,
    body: event.body
  });
  
  try {
    console.log(`Processing route: ${routeKey}`);
    
    switch (routeKey) {
      case '$connect':
        console.log('Handling $connect route');
        return await handleConnect(connectionId);
      
      case '$disconnect':
        console.log('Handling $disconnect route');
        return await handleDisconnect(connectionId);
      
      case '$default':
        console.log('Handling $default route');
        return await handleMessage(connectionId, event.body, domainName, stage);
      
      default:
        console.warn('Unknown route:', routeKey);
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('=== ERROR in handler ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return { statusCode: 500, body: 'Internal server error' };
  }
};

async function handleConnect(connectionId) {
  console.log('=== handleConnect START ===');
  console.log('Client connected:', connectionId);
  console.log('Table name:', TABLE_NAME);
  
  try {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        connectionId,
        connectedAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400 // 24 hours TTL
      }
    });
    
    console.log('Sending PutCommand to DynamoDB');
    await docClient.send(command);
    console.log(`Connection ${connectionId} stored successfully`);
    console.log('=== handleConnect END ===');
    
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('=== ERROR in handleConnect ===');
    console.error('Error:', error);
    throw error;
  }
}

async function handleDisconnect(connectionId) {
  console.log('Client disconnected:', connectionId);
  
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { connectionId }
  });
  
  await docClient.send(command);
  console.log(`Connection ${connectionId} removed successfully`);
  
  return { statusCode: 200, body: 'Disconnected' };
}

async function handleMessage(connectionId, body, domainName, stage) {
  console.log('=== handleMessage START ===');
  console.log('connectionId:', connectionId);
  console.log('body:', body);
  console.log('domainName:', domainName);
  console.log('stage:', stage);
  
  if (!body) {
    console.warn('No message body provided');
    return { statusCode: 400, body: 'Message body required' };
  }
  
  let message;
  try {
    console.log('Parsing JSON body');
    message = JSON.parse(body);
    console.log('Parsed message:', message);
  } catch (error) {
    console.error('Invalid JSON:', error);
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  
  console.log('Message received:', message);
  
  const { action, voiceContactId } = message;
  console.log('Action:', action);
  console.log('voiceContactId:', voiceContactId);
  
  try {
    switch (action) {
      case 'register':
        console.log('Calling handleRegister');
        return await handleRegister(connectionId, voiceContactId);
      
      case 'ping':
        console.log('Calling sendToConnection for ping');
        return await sendToConnection(connectionId, domainName, stage, { type: 'pong' });
      
      default:
        console.warn('Unknown action:', action);
        return { statusCode: 400, body: 'Unknown action' };
    }
  } catch (error) {
    console.error('=== ERROR in handleMessage ===');
    console.error('Error:', error);
    throw error;
  } finally {
    console.log('=== handleMessage END ===');
  }
}

async function handleRegister(connectionId, voiceContactId) {
  console.log('=== handleRegister START ===');
  console.log('connectionId:', connectionId);
  console.log('voiceContactId:', voiceContactId);
  
  if (!voiceContactId) {
    console.warn('No voiceContactId provided');
    return { statusCode: 400, body: 'voiceContactId required' };
  }
  
  console.log(`Registering connection ${connectionId} for voice contact ${voiceContactId}`);
  console.log('Table name:', TABLE_NAME);
  
  try {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { connectionId },
      UpdateExpression: 'SET voiceContactId = :voiceContactId, registeredAt = :registeredAt',
      ExpressionAttributeValues: {
        ':voiceContactId': voiceContactId,
        ':registeredAt': Date.now()
      }
    });
    
    console.log('Sending UpdateCommand to DynamoDB');
    await docClient.send(command);
    console.log(`Connection ${connectionId} registered for voice contact ${voiceContactId}`);
    console.log('=== handleRegister END ===');
    
    return { statusCode: 200, body: 'Registered' };
  } catch (error) {
    console.error('=== ERROR in handleRegister ===');
    console.error('Error:', error);
    throw error;
  }
}

async function sendToConnection(connectionId, domainName, stage, data) {
  console.log('=== sendToConnection START ===');
  console.log('connectionId:', connectionId);
  console.log('domainName:', domainName);
  console.log('stage:', stage);
  console.log('data:', data);
  
  const endpoint = `https://${domainName}/${stage}`;
  console.log('API Gateway endpoint:', endpoint);
  
  const apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint
  });
  
  try {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data)
    });
    
    console.log('Sending PostToConnectionCommand');
    await apiGatewayClient.send(command);
    console.log(`Message sent to connection ${connectionId}`);
    console.log('=== sendToConnection END ===');
    return { statusCode: 200, body: 'Message sent' };
  } catch (error) {
    console.error('=== ERROR in sendToConnection ===');
    console.error('Error:', error);
    
    if (error.statusCode === 410) {
      console.log(`Connection ${connectionId} is stale, removing from database`);
      const deleteCommand = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { connectionId }
      });
      await docClient.send(deleteCommand);
    } else {
      console.error(`Failed to send message to ${connectionId}:`, error);
      throw error;
    }
    return { statusCode: 500, body: 'Failed to send message' };
  }
}

// Export helper functions for use by other Lambda functions (e.g., EventBridge handler)
exports.findConnectionByVoiceContactId = async function(voiceContactId) {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'voiceContactIdIndex',
    KeyConditionExpression: 'voiceContactId = :voiceContactId',
    ExpressionAttributeValues: {
      ':voiceContactId': voiceContactId
    }
  });
  
  const result = await docClient.send(command);
  return result.Items && result.Items.length > 0 ? result.Items[0] : null;
};

exports.sendMessageToConnection = async function(connectionId, domainName, stage, message) {
  return await sendToConnection(connectionId, domainName, stage, message);
};
