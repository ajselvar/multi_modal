import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ConnectMultimodalStackProps extends cdk.StackProps {
  connectInstanceId: string;
  connectContactFlowId: string;
}

export class ConnectMultimodalStack extends cdk.Stack {
  public readonly customerBucket: s3.Bucket;
  public readonly agentBucket: s3.Bucket;
  public readonly customerDistribution: cloudfront.Distribution;
  public readonly agentDistribution: cloudfront.Distribution;
  public readonly api: apigateway.RestApi;
  public readonly websocketApi: apigatewayv2.WebSocketApi;
  public readonly connectionsTable: dynamodb.Table;
  public readonly customerUrl: string;
  public readonly agentUrl: string;
  public readonly apiUrl: string;
  public readonly websocketUrl: string;

  constructor(scope: Construct, id: string, props: ConnectMultimodalStackProps) {
    super(scope, id, props);

    // S3 bucket for customer app (private)
    this.customerBucket = new s3.Bucket(this, 'CustomerBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // S3 bucket for agent app (private)
    this.agentBucket = new s3.Bucket(this, 'AgentBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Function for customer app SPA routing
    const customerUrlRewriteFunction = new cloudfront.Function(this, 'CustomerUrlRewriteFunction', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  // If requesting root or a path without extension, serve /index.html
  if (uri === '/' || !uri.match(/\\.[a-zA-Z0-9]+$/)) {
    request.uri = '/index.html';
  }
  
  return request;
}
      `),
    });

    // CloudFront Function for agent app SPA routing
    const agentUrlRewriteFunction = new cloudfront.Function(this, 'AgentUrlRewriteFunction', {
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  
  // If requesting root or a path without extension, serve /index.html
  if (uri === '/' || !uri.match(/\\.[a-zA-Z0-9]+$/)) {
    request.uri = '/index.html';
  }
  
  return request;
}
      `),
    });

    // CloudFront distribution for customer app
    this.customerDistribution = new cloudfront.Distribution(this, 'CustomerDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.customerBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          function: customerUrlRewriteFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      defaultRootObject: 'index.html',
      comment: 'CloudFront distribution for Connect Customer App',
    });

    // CloudFront distribution for agent app
    this.agentDistribution = new cloudfront.Distribution(this, 'AgentDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.agentBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{
          function: agentUrlRewriteFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      defaultRootObject: 'index.html',
      comment: 'CloudFront distribution for Connect Agent App',
    });

    // Deploy customer frontend
    new s3deploy.BucketDeployment(this, 'DeployCustomerApp', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist'))],
      destinationBucket: this.customerBucket,
      distribution: this.customerDistribution,
      distributionPaths: ['/*'],
    });

    // Deploy agent app
    new s3deploy.BucketDeployment(this, 'DeployAgentApp', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../agent-app/dist'))],
      destinationBucket: this.agentBucket,
      distribution: this.agentDistribution,
      distributionPaths: ['/*'],
    });

    // Lambda function for Connect integration
    const connectLambda = new lambda.Function(this, 'ConnectLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CONNECT_INSTANCE_ID: props.connectInstanceId,
        CONNECT_CONTACT_FLOW_ID: props.connectContactFlowId,
      },
    });

    // Grant Lambda permissions to call Connect APIs
    connectLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'connect:StartChatContact',
          'connect:StartWebRTCContact',
          'connect:StopContact',
        ],
        resources: ['*'],
      })
    );

    // API Gateway
    this.api = new apigateway.RestApi(this, 'ConnectApi', {
      restApiName: 'Connect Multimodal API',
      description: 'API for Amazon Connect multi-modal demo',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(connectLambda);

    // API endpoints
    const startChatResource = this.api.root.addResource('start-chat-contact');
    startChatResource.addMethod('POST', lambdaIntegration);

    const startVoiceResource = this.api.root.addResource('start-voice-contact');
    startVoiceResource.addMethod('POST', lambdaIntegration);

    const stopContactResource = this.api.root.addResource('stop-contact');
    stopContactResource.addMethod('POST', lambdaIntegration);

    // DynamoDB table for WebSocket connections
    this.connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: {
        name: 'connectionId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl'
    });

    // Add GSI for querying by voiceContactId (existing)
    this.connectionsTable.addGlobalSecondaryIndex({
      indexName: 'voiceContactIdIndex',
      partitionKey: {
        name: 'voiceContactId',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Add new GSI for querying by userId
    this.connectionsTable.addGlobalSecondaryIndex({
      indexName: 'userIdIndex',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Single WebSocket Lambda function to handle all routes
    const wsLambda = new lambda.Function(this, 'WebSocketLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-websocket')),
      environment: {
        CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Grant DynamoDB permissions to WebSocket Lambda
    this.connectionsTable.grantReadWriteData(wsLambda);

    // WebSocket API with separate integrations for each route to ensure proper permissions
    const connectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration(
      'ConnectIntegration',
      wsLambda
    );
    
    const disconnectIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration(
      'DisconnectIntegration',
      wsLambda
    );
    
    const defaultIntegration = new apigatewayv2Integrations.WebSocketLambdaIntegration(
      'DefaultIntegration',
      wsLambda
    );

    this.websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: 'Connect Multimodal WebSocket API',
      description: 'WebSocket API for real-time chat contact delivery',
      connectRouteOptions: { integration: connectIntegration },
      disconnectRouteOptions: { integration: disconnectIntegration },
      defaultRouteOptions: { integration: defaultIntegration }
    });

    // WebSocket API Stage - using CfnStage for compatibility
    const wsStage = new apigatewayv2.CfnStage(this, 'WebSocketStage', {
      apiId: this.websocketApi.apiId,
      stageName: 'prod',
      autoDeploy: true
    });

    // Grant WebSocket Lambda permission to post to connections
    wsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.websocketApi.apiId}/${wsStage.stageName}/*`
        ]
      })
    );

    // Contact Event Handler Lambda - handles Connect CONNECTED_TO_AGENT events
    const contactEventLambda = new lambda.Function(this, 'ContactEventLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-contact-event')),
      environment: {
        CONNECT_INSTANCE_ID: props.connectInstanceId,
        CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
        WEBSOCKET_API_ENDPOINT: `https://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}`
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Grant permissions to contact event Lambda
    this.connectionsTable.grantReadData(contactEventLambda);
    contactEventLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['connect:StartChatContact', 'connect:DescribeContact'],
        resources: ['*']
      })
    );
    contactEventLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [
          `arn:aws:execute-api:${this.region}:${this.account}:${this.websocketApi.apiId}/${wsStage.stageName}/*`
        ]
      })
    );

    // EventBridge rule for Connect CONNECTED_TO_AGENT events (VOICE)
    const voiceAgentConnectedRule = new events.Rule(this, 'VoiceAgentConnectedRule', {
      ruleName: 'connect-voice-agent-connected-rule',
      description: 'Captures Connect CONNECTED_TO_AGENT events for voice contacts',
      eventPattern: {
        source: ['aws.connect'],
        detailType: ['Amazon Connect Contact Event'],
        detail: {
          eventType: ['CONNECTED_TO_AGENT'],
          channel: ['VOICE']
        }
      }
    });

    // Add Lambda as target for voice agent connected rule
    voiceAgentConnectedRule.addTarget(new targets.LambdaFunction(contactEventLambda));

    // EventBridge rule for Connect CONNECTED_TO_AGENT events (CHAT)
    const chatAgentConnectedRule = new events.Rule(this, 'ChatAgentConnectedRule', {
      ruleName: 'connect-chat-agent-connected-rule',
      description: 'Captures Connect CONNECTED_TO_AGENT events for chat contacts',
      eventPattern: {
        source: ['aws.connect'],
        detailType: ['Amazon Connect Contact Event'],
        detail: {
          eventType: ['CONNECTED_TO_AGENT'],
          channel: ['CHAT']
        }
      }
    });

    // Add Lambda as target for chat agent connected rule
    chatAgentConnectedRule.addTarget(new targets.LambdaFunction(contactEventLambda));

    // Chat Routing Lambda - determines which queue to route chat to
    const chatRoutingLambda = new lambda.Function(this, 'ChatRoutingLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-chat-routing')),
      environment: {
        CONNECT_INSTANCE_ID: props.connectInstanceId,
        DEFAULT_QUEUE_ARN: 'arn:aws:connect:us-west-2:319849630214:instance/602d4c63-50be-4b56-ac69-6068140d5a61/queue/b3afe3a2-0fb3-45ba-ac71-32cce1fac074',
        AWS_ACCOUNT_ID: this.account
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Grant permissions to chat routing Lambda
    chatRoutingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['connect:DescribeContact'],
        resources: ['*']
      })
    );

    // Outputs
    this.customerUrl = `https://${this.customerDistribution.distributionDomainName}`;
    this.agentUrl = `https://${this.agentDistribution.distributionDomainName}`;
    this.apiUrl = this.api.url;
    this.websocketUrl = `wss://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}`;

    new cdk.CfnOutput(this, 'CustomerURL', {
      value: this.customerUrl,
      description: 'CloudFront URL of the customer app',
    });

    new cdk.CfnOutput(this, 'AgentURL', {
      value: this.agentUrl,
      description: 'CloudFront URL of the agent app',
    });

    new cdk.CfnOutput(this, 'CustomerDistributionId', {
      value: this.customerDistribution.distributionId,
      description: 'CloudFront Distribution ID for customer app',
    });

    new cdk.CfnOutput(this, 'AgentDistributionId', {
      value: this.agentDistribution.distributionId,
      description: 'CloudFront Distribution ID for agent app',
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: this.apiUrl,
      description: 'URL of the API Gateway',
    });

    new cdk.CfnOutput(this, 'CustomerBucketName', {
      value: this.customerBucket.bucketName,
      description: 'Name of the customer app S3 bucket',
    });

    new cdk.CfnOutput(this, 'AgentBucketName', {
      value: this.agentBucket.bucketName,
      description: 'Name of the agent app S3 bucket',
    });

    new cdk.CfnOutput(this, 'WebSocketURL', {
      value: this.websocketUrl,
      description: 'WebSocket API URL',
    });

    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: this.connectionsTable.tableName,
      description: 'DynamoDB table for WebSocket connections',
    });

    new cdk.CfnOutput(this, 'ChatRoutingLambdaArn', {
      value: chatRoutingLambda.functionArn,
      description: 'ARN of the chat routing Lambda function',
    });
  }
}
