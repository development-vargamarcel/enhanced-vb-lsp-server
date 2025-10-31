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
WebSocket Bridge (port 3001)
    ↕ stdio
Language Server
    ↕ file system
Visual Basic Files
```

## Configuration

### Default Behavior

The server automatically indexes `.vb`, `.vbs`, `.bas`, `.cls`, and `.frm` files in your workspace, excluding common directories like `bin`, `obj`, `node_modules`, and `.git`.

### Custom Configuration

Create a `.vbconfig.json` file in your workspace root to customize the server behavior:

```json
{
  "indexing": {
    "enabled": true,
    "includeFiles": ["**/*.vb", "**/*.vbs", "**/*.bas", "**/*.cls", "**/*.frm"],
    "excludeDirectories": ["node_modules", "bin", "obj", ".git"]
  },
  "diagnostics": {
    "enabled": true,
    "checkMissingTypes": true,
    "checkUnusedVariables": true,
    "checkMissingEndStatements": true
  }
}
```

See `.vbconfig.example.json` for a complete example.

### Diagnostic Codes

- **VB001**: Variable declared without explicit type
- **VB002**: Function without explicit return type
- **VB003**: Missing or mismatched End statement
- **VB004**: Unused variable

## Troubleshooting

### TypeScript compilation fails

Make sure you have the `src` directory with `server.ts` and `websocket-bridge.ts` files.

### WebSocket connection fails

1. Ensure the server is running (`npm run start:bridge`)
2. Check that port 3001 is not blocked
3. Verify the browser console for errors

### No code completion

1. Check the browser console for connection status
2. Ensure the language ID is set to 'vb' in Monaco
3. Verify the server logs show successful indexing

## License

MIT
