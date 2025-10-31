import * as http from 'http';
import * as ws from 'ws';
import * as cp from 'child_process';
import { Server } from 'ws';

const PORT = process.env.PORT || 3001;
const MAX_CLIENTS = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
const SPAWN_TIMEOUT = 5000; // 5 seconds timeout for spawning LSP process

interface ClientConnection {
  socket: ws.WebSocket;
  process: cp.ChildProcess;
  id: string;
  messageCount: number;
  windowStart: number;
  messageBuffer: string;
}

const activeConnections: Map<string, ClientConnection> = new Map();

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeConnections: activeConnections.size,
      maxConnections: MAX_CLIENTS
    }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Enhanced Visual Basic Language Server - WebSocket Bridge\n');
});

const wss: Server = new ws.Server({
  server,
  perMessageDeflate: false,
  maxPayload: 10 * 1024 * 1024
});

console.log(`[${new Date().toISOString()}] Starting WebSocket bridge on port ${PORT}`);

wss.on('connection', (socket: ws.WebSocket, request) => {
  const clientId = generateClientId();
  const clientIp = request.socket.remoteAddress;

  console.log(`[${new Date().toISOString()}] Client ${clientId} connected from ${clientIp}`);

  if (activeConnections.size >= MAX_CLIENTS) {
    console.log(`[${new Date().toISOString()}] Connection limit reached`);
    socket.close(1008, 'Server capacity reached');
    return;
  }

  let spawnTimeout: NodeJS.Timeout | null = null;

  try {
    const lspProcess = cp.spawn('node', ['./out/server.js', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLIENT_ID: clientId }
    });

    // Set timeout for spawn
    spawnTimeout = setTimeout(() => {
      if (!lspProcess.pid) {
        console.error(`[${new Date().toISOString()}] LSP process spawn timeout for client ${clientId}`);
        socket.close(1011, 'Server initialization timeout');
        cleanupConnection(clientId);
      }
    }, SPAWN_TIMEOUT);

    lspProcess.on('spawn', () => {
      if (spawnTimeout) {
        clearTimeout(spawnTimeout);
        spawnTimeout = null;
      }
      console.log(`[${new Date().toISOString()}] LSP server started for client ${clientId} (PID: ${lspProcess.pid})`);
    });

    const connection: ClientConnection = {
      socket,
      process: lspProcess,
      id: clientId,
      messageCount: 0,
      windowStart: Date.now(),
      messageBuffer: ''
    };

    activeConnections.set(clientId, connection);

  socket.on('message', (data: ws.RawData) => {
    try {
      const connection = activeConnections.get(clientId);
      if (!connection) return;

      // Rate limiting
      const now = Date.now();
      if (now - connection.windowStart > RATE_LIMIT_WINDOW) {
        connection.messageCount = 0;
        connection.windowStart = now;
      }

      connection.messageCount++;
      if (connection.messageCount > RATE_LIMIT_MAX_REQUESTS) {
        console.warn(`[${new Date().toISOString()}] Rate limit exceeded for client ${clientId}`);
        socket.close(1008, 'Rate limit exceeded');
        return;
      }

      const message = data.toString();

      // Validate JSON-RPC message
      try {
        const parsed = JSON.parse(message);
        if (!parsed.jsonrpc || !parsed.method) {
          console.warn(`[${new Date().toISOString()}] Invalid LSP message from client ${clientId}`);
          return;
        }
      } catch (e) {
        console.warn(`[${new Date().toISOString()}] Invalid JSON from client ${clientId}`);
        return;
      }

      if (lspProcess.stdin && !lspProcess.killed) {
        // Add Content-Length header for LSP protocol
        const contentLength = Buffer.byteLength(message, 'utf8');
        const header = `Content-Length: ${contentLength}\r\n\r\n`;
        lspProcess.stdin.write(header + message);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error forwarding message:`, error);
    }
  });

  lspProcess.stdout.on('data', (data: Buffer) => {
    try {
      const connection = activeConnections.get(clientId);
      if (!connection) return;

      // Append to buffer
      connection.messageBuffer += data.toString();

      // Process complete LSP messages (Content-Length format)
      while (true) {
        const headerMatch = connection.messageBuffer.match(/Content-Length: (\d+)\r\n\r\n/);
        if (!headerMatch) break;

        const contentLength = parseInt(headerMatch[1], 10);
        const headerLength = headerMatch[0].length;
        const messageStart = headerMatch.index! + headerLength;
        const messageEnd = messageStart + contentLength;

        if (connection.messageBuffer.length < messageEnd) {
          // Wait for more data
          break;
        }

        const message = connection.messageBuffer.substring(messageStart, messageEnd);
        connection.messageBuffer = connection.messageBuffer.substring(messageEnd);

        if (socket.readyState === ws.OPEN) {
          socket.send(message);
        }
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error sending message:`, error);
    }
  });

  lspProcess.stderr.on('data', (data: Buffer) => {
    console.error(`[${new Date().toISOString()}] LSP Error:`, data.toString());
  });

  lspProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
    console.log(`[${new Date().toISOString()}] LSP process exited (code: ${code}, signal: ${signal})`);
    if (socket.readyState === ws.OPEN) {
      socket.close(1011, `Server process exited: ${code || signal}`);
    }
    cleanupConnection(clientId);
  });

  lspProcess.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] LSP process error for client ${clientId}:`, error);
    if (socket.readyState === ws.OPEN) {
      socket.close(1011, 'Server process error');
    }
    cleanupConnection(clientId);
  });

  socket.on('close', () => {
    console.log(`[${new Date().toISOString()}] Client ${clientId} disconnected`);
    cleanupConnection(clientId);
  });

  socket.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error:`, error);
    cleanupConnection(clientId);
  });

  const pingInterval = setInterval(() => {
    if (socket.readyState === ws.OPEN) {
      socket.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);

  socket.on('close', () => {
    clearInterval(pingInterval);
  });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error setting up connection for ${clientId}:`, error);
    if (spawnTimeout) clearTimeout(spawnTimeout);
    socket.close(1011, 'Server error');
    cleanupConnection(clientId);
  }
});

function cleanupConnection(clientId: string) {
  const connection = activeConnections.get(clientId);
  if (!connection) return;

  console.log(`[${new Date().toISOString()}] Cleaning up connection ${clientId}`);

  try {
    if (connection.process && !connection.process.killed) {
      connection.process.kill('SIGTERM');
    }

    if (connection.socket.readyState === ws.OPEN) {
      connection.socket.close(1000, 'Cleanup');
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Cleanup error:`, error);
  }

  activeConnections.delete(clientId);
  console.log(`[${new Date().toISOString()}] Active connections: ${activeConnections.size}`);
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log(`[${new Date().toISOString()}] Shutting down...`);

  activeConnections.forEach((connection, clientId) => {
    cleanupConnection(clientId);
  });

  wss.close(() => {
    console.log(`[${new Date().toISOString()}] WebSocket server closed`);
  });

  server.close(() => {
    console.log(`[${new Date().toISOString()}] HTTP server closed`);
    process.exit(0);
  });
}

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] =====================================`);
  console.log(`[${new Date().toISOString()}] Enhanced VB Language Server`);
  console.log(`[${new Date().toISOString()}] =====================================`);
  console.log(`[${new Date().toISOString()}] WebSocket: ws://localhost:${PORT}`);
  console.log(`[${new Date().toISOString()}] Health: http://localhost:${PORT}/health`);
  console.log(`[${new Date().toISOString()}] Ready to accept connections`);
  console.log(`[${new Date().toISOString()}] =====================================`);
});
