# Integration Guide

Complete guide for integrating the Enhanced Visual Basic Language Server with existing projects and production environments.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Monaco Editor Integration](#monaco-editor-integration)
3. [Workspace Configuration](#workspace-configuration)
4. [Protocol Implementation](#protocol-implementation)
5. [Production Deployment](#production-deployment)
6. [Custom Extensions](#custom-extensions)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

### System Components

The language server system consists of three main components:

```
┌─────────────────────┐
│   Monaco Editor     │  Browser-based code editor
│   (Client)          │  
└──────────┬──────────┘
           │ WebSocket
           │
┌──────────▼──────────┐
│  WebSocket Bridge   │  Node.js process managing connections
│                     │
└──────────┬──────────┘
           │ stdio
           │
┌──────────▼──────────┐
│  Language Server    │  LSP implementation analyzing VB code
│                     │
└──────────┬──────────┘
           │ file I/O
           │
┌──────────▼──────────┐
│  VB Project Files   │  Your Visual Basic source code
└─────────────────────┘
```

### Communication Flow

1. **Client → Server**: User actions trigger LSP requests (completion, hover, etc.)
2. **Server Processing**: Server analyzes code and workspace index
3. **Server → Client**: Server sends LSP responses with results
4. **Notifications**: Server pushes diagnostics and updates to client

### Data Flow

```javascript
User types → Monaco detects change → 
WebSocket sends didChange → Server updates index → 
Server validates code → Server sends diagnostics → 
Monaco displays warnings/errors
```

## Monaco Editor Integration

### Basic Setup

#### Step 1: Include Monaco Editor

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.js"></script>
</head>
<body>
    <div id="editor" style="width:100%;height:600px;"></div>
    
    <script>
        require.config({ 
            paths: { 
                vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' 
            } 
        });
        
        require(['vs/editor/editor.main'], function() {
            // Editor initialization code here
        });
    </script>
</body>
</html>
```

#### Step 2: Register Visual Basic Language

```javascript
monaco.languages.register({ 
    id: 'vb',
    extensions: ['.vb', '.vbs'],
    aliases: ['Visual Basic', 'vb']
});
```

#### Step 3: Configure Syntax Highlighting

```javascript
monaco.languages.setMonarchTokensProvider('vb', {
    defaultToken: '',
    ignoreCase: true,
    
    keywords: [
        'Dim', 'Public', 'Private', 'Function', 'Sub', 
        'Class', 'Module', 'If', 'Then', 'Else', 'End',
        'For', 'Next', 'While', 'Return', 'As', 'New'
        // ... add more keywords
    ],
    
    tokenizer: {
        root: [
            [/'.*$/, 'comment'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string'],
            [/\d+/, 'number'],
            [/[a-zA-Z_]\w*/, {
                cases: {
                    '@keywords': 'keyword',
                    '@default': 'identifier'
                }
            }]
        ],
        string: [
            [/[^\\"]+/, 'string'],
            [/"/, 'string', '@pop']
        ]
    }
});
```

#### Step 4: Create Editor Instance

```javascript
const editor = monaco.editor.create(document.getElementById('editor'), {
    value: '// Your VB code here',
    language: 'vb',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: true },
    suggest: {
        showKeywords: true,
        showSnippets: true
    }
});
```

### Advanced Integration with monaco-languageclient

For full LSP protocol support:

#### Install Dependencies

```bash
npm install monaco-languageclient vscode-ws-jsonrpc
```

#### Complete Implementation

```javascript
import { MonacoLanguageClient, CloseAction, ErrorAction } from 'monaco-languageclient';
import { listen, MessageConnection } from 'vscode-ws-jsonrpc';

// Create WebSocket connection
const webSocket = new WebSocket('ws://localhost:3000');

// Handle WebSocket connection
listen({
    webSocket,
    onConnection: (connection: MessageConnection) => {
        // Create language client
        const languageClient = new MonacoLanguageClient({
            name: 'Visual Basic Language Client',
            clientOptions: {
                documentSelector: ['vb'],
                errorHandler: {
                    error: () => ErrorAction.Continue,
                    closed: () => CloseAction.Restart
                },
                workspaceFolder: {
                    uri: 'file:///path/to/your/project',
                    name: 'My VB Project',
                    index: 0
                }
            },
            connectionProvider: {
                get: (errorHandler, closeHandler) => {
                    return Promise.resolve(connection);
                }
            }
        });

        // Start the language client
        languageClient.start();
        
        // Dispose on connection close
        connection.onClose(() => languageClient.stop());
    }
});
```

## Workspace Configuration

### Configuring Workspace Folders

Workspace folders tell the server where your Visual Basic files are located:

```javascript
// In LSP initialization
const initParams = {
    processId: null,
    rootUri: null,
    workspaceFolders: [
        {
            uri: 'file:///C:/Projects/MyVBApp',
            name: 'MyVBApp'
        },
        {
            uri: 'file:///C:/Projects/SharedLibrary',
            name: 'SharedLibrary'
        }
    ],
    capabilities: {
        // ... client capabilities
    }
};
```

### Project Configuration File

Create `.vbconfig.json` in your project root:

```json
{
  "vbLanguageServer": {
    "workspaceIndexing": {
      "enabled": true,
      "excludePatterns": [
        "**/bin/**",
        "**/obj/**",
        "**/packages/**",
        "**/.git/**",
        "**/node_modules/**"
      ],
      "includePatterns": [
        "**/*.vb",
        "**/*.vbs"
      ],
      "maxFileSizeKB": 1024
    },
    "diagnostics": {
      "enabled": true,
      "severity": {
        "missingTypeAnnotation": "warning",
        "missingReturnType": "warning",
        "unusedVariable": "hint",
        "missingEndStatement": "error"
      }
    },
    "completion": {
      "enabled": true,
      "showKeywords": true,
      "showTypes": true,
      "showUserSymbols": true
    },
    "hover": {
      "enabled": true,
      "showDocumentation": true
    }
  }
}
```

## Protocol Implementation

### Document Synchronization

#### Opening Documents

```javascript
// Send didOpen notification
connection.sendNotification('textDocument/didOpen', {
    textDocument: {
        uri: 'file:///path/to/file.vb',
        languageId: 'vb',
        version: 1,
        text: editor.getValue()
    }
});
```

#### Tracking Changes

```javascript
editor.onDidChangeModelContent((e) => {
    // Send incremental changes
    connection.sendNotification('textDocument/didChange', {
        textDocument: {
            uri: documentUri,
            version: ++documentVersion
        },
        contentChanges: [{
            text: editor.getValue()
        }]
    });
});
```

#### Closing Documents

```javascript
connection.sendNotification('textDocument/didClose', {
    textDocument: {
        uri: documentUri
    }
});
```

### Code Completion

```javascript
// Request completion
connection.sendRequest('textDocument/completion', {
    textDocument: {
        uri: documentUri
    },
    position: {
        line: 10,
        character: 5
    }
}).then((completions) => {
    // Display completions in editor
    monaco.languages.registerCompletionItemProvider('vb', {
        provideCompletionItems: () => {
            return { suggestions: completions.items };
        }
    });
});
```

### Hover Information

```javascript
monaco.languages.registerHoverProvider('vb', {
    provideHover: async (model, position) => {
        const response = await connection.sendRequest('textDocument/hover', {
            textDocument: { uri: model.uri.toString() },
            position: { 
                line: position.lineNumber - 1, 
                character: position.column - 1 
            }
        });
        
        if (response && response.contents) {
            return {
                contents: [{ value: response.contents.value }]
            };
        }
        return null;
    }
});
```

### Diagnostics Handling

```javascript
connection.onNotification('textDocument/publishDiagnostics', (params) => {
    const markers = params.diagnostics.map(diag => ({
        severity: convertSeverity(diag.severity),
        startLineNumber: diag.range.start.line + 1,
        startColumn: diag.range.start.character + 1,
        endLineNumber: diag.range.end.line + 1,
        endColumn: diag.range.end.character + 1,
        message: diag.message,
        code: diag.code
    }));
    
    monaco.editor.setModelMarkers(
        model, 
        'vb-lsp', 
        markers
    );
});

function convertSeverity(lspSeverity) {
    switch (lspSeverity) {
        case 1: return monaco.MarkerSeverity.Error;
        case 2: return monaco.MarkerSeverity.Warning;
        case 3: return monaco.MarkerSeverity.Info;
        case 4: return monaco.MarkerSeverity.Hint;
        default: return monaco.MarkerSeverity.Info;
    }
}
```

### Go to Definition

```javascript
monaco.languages.registerDefinitionProvider('vb', {
    provideDefinition: async (model, position) => {
        const response = await connection.sendRequest('textDocument/definition', {
            textDocument: { uri: model.uri.toString() },
            position: { 
                line: position.lineNumber - 1, 
                character: position.column - 1 
            }
        });
        
        if (response) {
            return {
                uri: monaco.Uri.parse(response.uri),
                range: new monaco.Range(
                    response.range.start.line + 1,
                    response.range.start.character + 1,
                    response.range.end.line + 1,
                    response.range.end.character + 1
                )
            };
        }
        return null;
    }
});
```

### Find References

```javascript
monaco.languages.registerReferenceProvider('vb', {
    provideReferences: async (model, position, context) => {
        const response = await connection.sendRequest('textDocument/references', {
            textDocument: { uri: model.uri.toString() },
            position: { 
                line: position.lineNumber - 1, 
                character: position.column - 1 
            },
            context: {
                includeDeclaration: context.includeDeclaration
            }
        });
        
        return response.map(ref => ({
            uri: monaco.Uri.parse(ref.uri),
            range: new monaco.Range(
                ref.range.start.line + 1,
                ref.range.start.character + 1,
                ref.range.end.line + 1,
                ref.range.end.character + 1
            )
        }));
    }
});
```

## Production Deployment

### Server Deployment

#### Using Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run compile

EXPOSE 3000

CMD ["npm", "run", "start:bridge"]
```

Build and run:
```bash
docker build -t vb-lsp-server .
docker run -p 3000:3000 vb-lsp-server
```

#### Using PM2 (Process Manager)

```bash
npm install -g pm2

# Start server
pm2 start npm --name "vb-lsp" -- run start:bridge

# Configure auto-restart
pm2 startup
pm2 save

# Monitor
pm2 monit

# View logs
pm2 logs vb-lsp
```

#### Environment Variables

```bash
# .env file
PORT=3000
MAX_CLIENTS=20
NODE_ENV=production
LOG_LEVEL=info
WORKSPACE_ROOT=/var/projects
```

### Load Balancing

For multiple concurrent users:

```nginx
upstream vb_lsp_servers {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://vb_lsp_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Security Best Practices

#### Authentication

```javascript
// Add authentication to WebSocket bridge
wss.on('connection', (socket, request) => {
    const token = new URL(request.url, 'http://localhost').searchParams.get('token');
    
    if (!isValidToken(token)) {
        socket.close(1008, 'Unauthorized');
        return;
    }
    
    // ... continue with connection
});
```

#### HTTPS/WSS

```javascript
import * as https from 'https';
import * as fs from 'fs';

const server = https.createServer({
    cert: fs.readFileSync('/path/to/cert.pem'),
    key: fs.readFileSync('/path/to/key.pem')
});

const wss = new ws.Server({ server });
// Client connects to wss://yourserver.com
```

#### Rate Limiting

```javascript
const rateLimits = new Map();

function checkRateLimit(clientId) {
    const now = Date.now();
    const limit = rateLimits.get(clientId) || { count: 0, resetTime: now + 60000 };
    
    if (now > limit.resetTime) {
        limit.count = 0;
        limit.resetTime = now + 60000;
    }
    
    limit.count++;
    rateLimits.set(clientId, limit);
    
    return limit.count <= 100; // 100 requests per minute
}
```

## Custom Extensions

### Adding Custom Symbols

```typescript
// In server.ts
function loadCustomProjectSymbols() {
    const customSymbols: ProjectSymbol[] = [
        {
            name: 'MyCustomClass',
            kind: CompletionItemKind.Class,
            detail: 'Custom business logic class',
            documentation: 'Handles specific business operations'
        }
    ];
    
    workspaceIndex.symbols.set('custom', customSymbols);
}
```

### Custom Diagnostics

```typescript
// Add custom validation rule
async function validateCustomRules(textDocument: TextDocument): Promise<void> {
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];
    
    // Example: Enforce naming convention
    const classMatch = text.match(/Public Class (\w+)/gi);
    if (classMatch) {
        classMatch.forEach((match, index) => {
            const className = match.split(' ')[2];
            if (!className.endsWith('Service') && !className.endsWith('Controller')) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: /* ... */,
                    message: 'Class names should end with Service or Controller',
                    code: 'CUSTOM001'
                });
            }
        });
    }
    
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
```

### Adding Code Actions

```typescript
connection.onCodeAction((params) => {
    const actions: CodeAction[] = [];
    
    // Quick fix for missing type annotation
    if (params.context.diagnostics.some(d => d.code === 'VB001')) {
        actions.push({
            title: 'Add type annotation',
            kind: 'quickfix',
            edit: {
                changes: {
                    [params.textDocument.uri]: [{
                        range: /* ... */,
                        newText: ' As String'
                    }]
                }
            }
        });
    }
    
    return actions;
});
```

## Performance Optimization

### Caching Strategies

```typescript
// Cache parsed symbols
const symbolCache = new Map<string, {symbols: ProjectSymbol[], timestamp: number}>();

function getCachedSymbols(uri: string, text: string): ProjectSymbol[] {
    const cached = symbolCache.get(uri);
    const hash = hashCode(text);
    
    if (cached && cached.timestamp === hash) {
        return cached.symbols;
    }
    
    const symbols = parseDocumentSymbols(text, uri);
    symbolCache.set(uri, { symbols, timestamp: hash });
    return symbols;
}
```

### Debouncing

```typescript
let validationTimeout: NodeJS.Timeout;

documents.onDidChangeContent(change => {
    clearTimeout(validationTimeout);
    validationTimeout = setTimeout(() => {
        validateTextDocument(change.document);
    }, 500); // Wait 500ms after typing stops
});
```

### Memory Management

```typescript
// Limit cache size
const MAX_CACHE_SIZE = 1000;

function addToCache(key: string, value: any) {
    if (cache.size >= MAX_CACHE_SIZE) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
    }
    cache.set(key, value);
}
```

## Troubleshooting

### Common Issues

#### Issue: High Memory Usage

**Symptoms**: Server process exceeds 1GB RAM

**Solutions**:
```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run start:bridge

# Or reduce cache size in configuration
{
  "performance": {
    "maxIndexedFiles": 5000,
    "completionCacheSize": 500
  }
}
```

#### Issue: Slow Completion

**Symptoms**: Completion takes >500ms

**Solutions**:
- Implement completion result caching
- Reduce symbol index size with exclusion patterns
- Use incremental completion (filter client-side)
- Profile with Node.js inspector:
```bash
node --inspect out/server.js
```

#### Issue: Missing Symbols

**Symptoms**: Symbols from other files don't appear

**Solutions**:
1. Verify workspace folders are correctly configured
2. Check server logs for indexing errors
3. Ensure files have .vb or .vbs extension
4. Confirm files aren't excluded by patterns

### Debugging

#### Enable Verbose Logging

```typescript
connection.console.log('Starting operation...');
connection.console.warn('Potential issue detected');
connection.console.error('Operation failed');
```

#### Client-Side Debugging

```javascript
// Log all LSP messages
connection.onNotification((method, params) => {
    console.log('LSP Notification:', method, params);
});

connection.onRequest((method, params) => {
    console.log('LSP Request:', method, params);
});
```

#### Performance Profiling

```bash
# Generate CPU profile
node --cpu-prof out/server.js

# Analyze with Chrome DevTools
# chrome://inspect → Open dedicated DevTools
```

---

**Last Updated**: 2024  
**Version**: 2.0.0  
**Maintainer**: Language Server Team
