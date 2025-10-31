import * as http from 'http';
import * as ws from 'ws';
import * as cp from 'child_process';
import { Server } from 'ws';

const PORT = process.env.PORT || 3001;
const MAX_CLIENTS = 10;

interface ClientConnection {
  socket: ws.WebSocket;
  process: cp.ChildProcess;
  id: string;
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

  const lspProcess = cp.spawn('node', ['./out/server.js', '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLIENT_ID: clientId }
  });

  console.log(`[${new Date().toISOString()}] LSP server started for client ${clientId} (PID: ${lspProcess.pid})`);

  const connection: ClientConnection = {
    socket,
    process: lspProcess,
    id: clientId
  };

  activeConnections.set(clientId, connection);

  socket.on('message', (data: ws.RawData) => {
    try {
      const message = data.toString();
      if (lspProcess.stdin && !lspProcess.killed) {
        lspProcess.stdin.write(message);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error forwarding message:`, error);
    }
  });

  lspProcess.stdout.on('data', (data: Buffer) => {
    try {
      const message = data.toString();
      if (socket.readyState === ws.OPEN) {
        socket.send(message);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error sending message:`, error);
    }
  });

  lspProcess.stderr.on('data', (data: Buffer) => {
    console.error(`[${new Date().toISOString()}] LSP Error:`, data.toString());
  });

  lspProcess.on('exit', (code: number | null) => {
    console.log(`[${new Date().toISOString()}] LSP process exited (code: ${code})`);
    cleanupConnection(clientId);
  });

  lspProcess.on('error', (error: Error) => {
    console.error(`[${new Date().toISOString()}] LSP process error:`, error);
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
