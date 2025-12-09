#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ConnectMultimodalStack } from '../lib/connect-multimodal-stack';
import * as fs from 'fs';
import * as path from 'path';

const app = new cdk.App();

// Load configuration from config.json
const configPath = path.join(__dirname, '../../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

console.log('Loaded configuration:', {
  region: config.aws.region,
  instanceId: config.connect.instanceId,
  contactFlowId: config.connect.contactFlowId,
  stackName: config.deployment.stackName
});

// Allow overrides from context or environment variables
const connectInstanceId = app.node.tryGetContext('connectInstanceId') || 
  process.env.CONNECT_INSTANCE_ID || 
  config.connect.instanceId;

const connectContactFlowId = app.node.tryGetContext('connectContactFlowId') || 
  process.env.CONNECT_CONTACT_FLOW_ID || 
  config.connect.contactFlowId;

const region = app.node.tryGetContext('region') ||
  process.env.AWS_REGION ||
  config.aws.region;

new ConnectMultimodalStack(app, config.deployment.stackName, {
  connectInstanceId,
  connectContactFlowId,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || config.aws.account,
    region: region,
  },
});

app.synth();
