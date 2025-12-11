# Deployment Architecture Changes

## Summary

Changed from a single CloudFront distribution with path-based routing to separate CloudFront distributions for customer and agent apps.

## What Changed

### Before
- Single S3 bucket hosting both apps
- Single CloudFront distribution
- Path-based routing: `/` for customer, `/ccp/` for agent
- Complex CloudFront function for routing logic

### After
- Two separate S3 buckets (customer and agent)
- Two separate CloudFront distributions
- Clean separation of concerns
- Simpler CloudFront functions (one per app)

## Benefits

1. **No caching issues**: Each app has its own cache, no path conflicts
2. **Simpler routing**: No complex path-based logic needed
3. **Independent deployments**: Can update one app without affecting the other
4. **Cleaner architecture**: Each app is truly independent
5. **Better security**: Can apply different security policies per app

## Deployment Steps

1. **Deploy the updated stack**:
   ```bash
   ./deploy.sh
   ```

2. **Get the Agent App URL** from the deployment outputs:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name ConnectMultimodalStack \
     --query 'Stacks[0].Outputs[?OutputKey==`AgentURL`].OutputValue' \
     --output text
   ```

3. **Add Agent App URL to Connect approved origins**:
   - Go to Amazon Connect Console
   - Navigate to "Application integration" → "Approved origins"
   - Add: `https://[your-agent-cloudfront-domain].cloudfront.net`
   - No trailing slash!

## Stack Outputs

The stack now provides these outputs:

- `CustomerURL`: CloudFront URL for customer-facing app
- `AgentURL`: CloudFront URL for agent interface (add to Connect)
- `CustomerDistributionId`: CloudFront distribution ID for customer app
- `AgentDistributionId`: CloudFront distribution ID for agent app
- `CustomerBucketName`: S3 bucket for customer app
- `AgentBucketName`: S3 bucket for agent app
- `ApiURL`: API Gateway endpoint
- `WebSocketURL`: WebSocket API endpoint

## Files Modified

- `infra/lib/connect-multimodal-stack.ts`: Complete rewrite of S3/CloudFront setup
- `README.md`: Updated architecture documentation
- `deploy.sh`: No changes needed (already correct)
- `sync-configs.sh`: No changes needed (uses same output keys)

## Migration Notes

If you have an existing deployment:
- The old resources will be replaced (not updated in place)
- CloudFront distributions will get new domain names
- Update any bookmarks or saved URLs
- Update Connect approved origins with new agent URL
