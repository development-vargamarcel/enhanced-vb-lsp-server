import * as http from 'http';
import * as ws from 'ws';
import * as cp from 'child_process';
import { Server } from 'ws';

const PORT = process.env.PORT || 3000;
const MAX_CLIENTS = 10;

interface ClientConnection {
  socket: ws.WebSocket;
  process: cp.ChildProcess;
  id: string;
}

const activeConnections: Map<string, ClientConnection> = new Map();

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeConnections: activeConnections.size,
      maxConnections: MAX_CLIENTS,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Enhanced Visual Basic Language Server - WebSocket Bridge\n');
});

// Create WebSocket server
const wss: Server = new ws.Server({ 
  server,
  perMessageDeflate: false,
  maxPayload: 10 * 1024 * 1024 // 10MB
});

console.log(`[${new Date().toISOString()}] WebSocket bridge server starting on port ${PORT}`);

wss.on('connection', (socket: ws.WebSocket, request) => {
  const clientId = generateClientId();
  const clientIp = request.socket.remoteAddress;
  
  console.log(`[${new Date().toISOString()}] Client ${clientId} connected from ${clientIp}`);

  // Check connection limit
  if (activeConnections.size >= MAX_CLIENTS) {
    console.log(`[${new Date().toISOString()}] Connection limit reached, rejecting client ${clientId}`);
    socket.close(1008, 'Server capacity reached');
    return;
  }

  // Spawn the language server process
  const lspProcess = cp.spawn('node', ['./out/server.js'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLIENT_ID: clientId }
  });

  console.log(`[${new Date().toISOString()}] LSP server process started for client ${clientId} (PID: ${lspProcess.pid})`);

  const connection: ClientConnection = {
    socket,
    process: lspProcess,
    id: clientId
  };

  activeConnections.set(clientId, connection);

  // Forward messages from WebSocket to LSP server
  socket.on('message', (data: ws.RawData) => {
    try {
      const message = data.toString();
      if (lspProcess.stdin && !lspProcess.killed) {
        lspProcess.stdin.write(message);
        const preview = message.substring(0, 100).replace(/\n/g, '\\n');
        console.log(`[${new Date().toISOString()}] Client ${clientId} → LSP: ${preview}${message.length > 100 ? '...' : ''}`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error forwarding message from client ${clientId}:`, error);
    }
  });

  // Forward messages from LSP server to WebSocket
  lspProcess.stdout.on('data', (data: Buffer) => {
    try {
      const message = data.toString();
      if (socket.readyState === ws.OPEN) {
        socket.send(message);
        const preview = message.substring(0, 100).replace(/\n/g, '\\n');
        console.log(`[${new Date().toISOString()}] LSP → Client ${clientId}: ${preview}${message.length > 100 ? '...' : ''}`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error forwarding message to client ${clientId}:`, error);
    }
  });

  // Handle LSP server errors
  lspProcess.stderr.on('data', (data: Buffer) => {
    const errorMessage = data.toString();
    console.error(`[${new Date().toISOString()}] LSP Error (${clientId}):`, errorMessage);
    
    // Only close on critical errors
    if (errorMessage.toLowerCase().includes('fatal') || 
        errorMessage.toLowerCase().includes('cannot start')) {
      cleanupConnection(clientId);
    }
  });

  // Handle LSP server exit
  lspProcess.on('exit', (code: number | null, signal: string | null) => {
    console.log(`[${new Date().toISOString()}] LSP server process for client ${clientId} exited (code: ${code}, signal: ${signal})`);
    cleanupConnection(clientId);
  });

  // Handle LSP process errors
  lspProcess.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] LSP process error for client ${clientId}:`, error);
    cleanupConnection(clientId);
  });

  // Handle WebSocket close
  socket.on('close', (code: number, reason: Buffer) => {
    console.log(`[${new Date().toISOString()}] Client ${clientId} disconnected (code: ${code}, reason: ${reason.toString()})`);
    cleanupConnection(clientId);
  });

  // Handle WebSocket errors
  socket.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error for client ${clientId}:`, error);
    cleanupConnection(clientId);
  });

  // Send ping to keep connection alive
  const pingInterval = setInterval(() => {
    if (socket.readyState === ws.OPEN) {
      socket.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // 30 seconds

  socket.on('pong', () => {
    // Silent pong acknowledgment - connection is alive
  });

  // Clean up ping interval on connection close
  socket.on('close', () => {
    clearInterval(pingInterval);
  });
});

function cleanupConnection(clientId: string) {
  const connection = activeConnections.get(clientId);
  if (!connection) return;

  console.log(`[${new Date().toISOString()}] Cleaning up connection for client ${clientId}`);

  try {
    // Kill LSP process if still running
    if (connection.process && !connection.process.killed) {
      connection.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (connection.process && !connection.process.killed) {
          console.log(`[${new Date().toISOString()}] Force killing LSP process for client ${clientId}`);
          connection.process.kill('SIGKILL');
        }
      }, 5000);
    }

    // Close WebSocket if still open
    if (connection.socket.readyState === ws.OPEN || 
        connection.socket.readyState === ws.CONNECTING) {
      connection.socket.close(1000, 'Server cleanup');
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during cleanup for client ${clientId}:`, error);
  }

  activeConnections.delete(clientId);
  console.log(`[${new Date().toISOString()}] Connection ${clientId} cleaned up. Active connections: ${activeConnections.size}/${MAX_CLIENTS}`);
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully...`);
  shutdown();
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT, shutting down gracefully...`);
  shutdown();
});

function shutdown() {
  console.log(`[${new Date().toISOString()}] Closing all ${activeConnections.size} active connections...`);
  
  // Close all active connections
  activeConnections.forEach((connection, clientId) => {
    cleanupConnection(clientId);
  });

  // Close WebSocket server
  wss.close(() => {
    console.log(`[${new Date().toISOString()}] WebSocket server closed`);
  });

  // Close HTTP server
  server.close(() => {
    console.log(`[${new Date().toISOString()}] HTTP server closed`);
    process.exit(0);
  });

  // Force exit after 10 seconds if still running
  setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Forcefully shutting down after timeout`);
    process.exit(1);
  }, 10000);
}

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] =====================================`);
  console.log(`[${new Date().toISOString()}] Enhanced VB Language Server Bridge`);
  console.log(`[${new Date().toISOString()}] =====================================`);
  console.log(`[${new Date().toISOString()}] WebSocket: ws://localhost:${PORT}`);
  console.log(`[${new Date().toISOString()}] Health check: http://localhost:${PORT}/health`);
  console.log(`[${new Date().toISOString()}] Max connections: ${MAX_CLIENTS}`);
  console.log(`[${new Date().toISOString()}] Ready to accept connections`);
  console.log(`[${new Date().toISOString()}] =====================================`);
});

// Log server statistics periodically
setInterval(() => {
  if (activeConnections.size > 0) {
    console.log(`[${new Date().toISOString()}] Server statistics: ${activeConnections.size}/${MAX_CLIENTS} active connections`);
  }
}, 60000); // Every minute
