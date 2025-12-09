# Amazon Connect Agent Interface

Custom agent interface with auto-accept functionality for multimodal contacts. Built with Amazon Connect Streams JS and Vite.

## Features

- **Embedded CCP**: Full Amazon Connect Contact Control Panel
- **Auto-Accept Related Chats**: Automatically accepts chat contacts linked to active voice calls
- **Contact Dashboard**: View and manage all active contacts
- **Activity Log**: Real-time event logging
- **Contact Details**: View attributes, queue, and relationships

## Quick Start

### 1. Update Central Configuration

Edit the root `config.json` file with your Connect instance details:

```json
{
  "connect": {
    "instanceAlias": "your-instance-alias",
    "ccpUrl": "https://your-instance-alias.my.connect.aws/ccp-v2/",
    ...
  }
}
```

### 2. Sync Configuration

Run from the project root to generate agent-app config:

```bash
./sync-configs.sh
```

This automatically updates `agent-app/src/config.js` from the central config.

### 3. Install Dependencies

```bash
cd agent-app
npm install
```

### 4. Allowlist Domain in Connect

1. Go to Amazon Connect Console → Your Instance
2. Navigate to **Application Integration** → **Approved origins**
3. Add: `http://localhost:3001` (for development)

### 5. Start Development Server

```bash
npm run dev
```

Opens automatically at `http://localhost:3001`

### 6. Test Auto-Accept

1. Log in as agent and set status to "Available"
2. Make a voice call from customer app
3. Accept the voice call
4. Wait for chat contact to arrive
5. **Chat auto-accepts automatically!**

## How Auto-Accept Works

```
Voice Call → Agent Accepts → Voice Active
                                  ↓
                         Chat Contact Created
                         (with relatedContactId)
                                  ↓
                         Auto-Accept Chat ✓
                                  ↓
                         Both Contacts Active
```

**Logic:**
1. Agent accepts voice call → Voice contact ID tracked
2. Backend creates chat with `relatedContactId` attribute
3. Chat arrives at agent CCP
4. Interface checks if `relatedContactId` matches active voice contact
5. If match found → Auto-accepts chat
6. Agent handles both contacts simultaneously

## Project Structure

```
agent-app/
├── src/
│   ├── index.html     # Main HTML
│   ├── main.js        # Application logic
│   ├── config.js      # Auto-generated config
│   └── styles.css     # Styles
├── dist/              # Build output
├── package.json       # Dependencies
└── vite.config.js     # Vite config
```

## Build for Production

```bash
npm run build
```

Output in `dist/` directory ready for deployment.

## Troubleshooting

**CCP not loading?**
- Verify `ccpUrl` in central `config.json`
- Check domain is allowlisted in Connect
- Ensure using HTTPS (or localhost for dev)

**Auto-accept not working?**
- Check browser console and activity log
- Verify chat has `relatedContactId` attribute
- Confirm voice contact is still active
- Look for "Auto-accepting chat" message in activity log

**Configuration not updating?**
- Run `./sync-configs.sh` from project root
- Check central `config.json` has correct values
- Restart dev server after config changes

## Deployment

The agent-app can be deployed alongside the customer frontend:

1. Build: `npm run build`
2. Deploy `dist/` to S3 bucket
3. Serve via CloudFront with HTTPS
4. Add CloudFront domain to Connect approved origins

See main project README for full deployment instructions.

## Connect Streams Events

**Agent Events:** `onRefresh`, `onStateChange`, `onRoutable`, `onNotRoutable`, `onOffline`

**Contact Events:** `onRefresh`, `onIncoming`, `onAccepted`, `onConnected`, `onEnded`, `onDestroy`

## Resources

- [Amazon Connect Streams JS Documentation](https://github.com/amazon-connect/amazon-connect-streams)
- [Amazon Connect Documentation](https://docs.aws.amazon.com/connect/)
- Main project README for full system documentation
