# Enhanced Visual Basic Language Server

A production-ready Language Server Protocol implementation for Visual Basic with workspace indexing and IntelliSense features.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run compile

# 3. Start the WebSocket bridge
npm run start:bridge

# 4. Open client-demo.html in your browser
```

## Features

- ✅ Workspace-wide symbol indexing
- ✅ Multi-file code intelligence
- ✅ Context-aware code completion
- ✅ Rich hover information
- ✅ Go to definition
- ✅ Find all references
- ✅ Real-time diagnostics
- ✅ WebSocket bridge for browser clients

## Requirements

- Node.js 16.0.0 or higher
- npm

## Scripts

- `npm install` - Install dependencies
- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode for development
- `npm start` - Start stdio server
- `npm run start:bridge` - Start WebSocket bridge
- `npm run clean` - Remove compiled files
- `npm run rebuild` - Clean and recompile

## Architecture

```
Browser Client (Monaco Editor)
    ↕ WebSocket
WebSocket Bridge (port 3000)
    ↕ stdio
Language Server
    ↕ file system
Visual Basic Files
```

## Configuration

The server automatically indexes `.vb` and `.vbs` files in your workspace, excluding common directories like `bin`, `obj`, and `node_modules`.

## Troubleshooting

### TypeScript compilation fails

Make sure you have the `src` directory with `server.ts` and `websocket-bridge.ts` files.

### WebSocket connection fails

1. Ensure the server is running (`npm run start:bridge`)
2. Check that port 3000 is not blocked
3. Verify the browser console for errors

### No code completion

1. Check the browser console for connection status
2. Ensure the language ID is set to 'vb' in Monaco
3. Verify the server logs show successful indexing

## License

MIT
