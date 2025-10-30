import * as http from 'http';
import * as ws from 'ws';
import * as cp from 'child_process';
import { Server } from 'ws';

const PORT = 3000;

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket LSP Bridge Server Running\n');
});

// Create WebSocket server
const wss: Server = new ws.Server({ server });

console.log(`WebSocket server starting on port ${PORT}`);

wss.on('connection', (socket: ws.WebSocket) => {
  console.log('Client connected');

  // Spawn the language server process
  const lspProcess = cp.spawn('node', ['./out/server.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  console.log('LSP server process started');

  // Forward messages from WebSocket to LSP server
  socket.on('message', (data: ws.RawData) => {
    const message = data.toString();
    console.log('→ Client to LSP:', message.substring(0, 100));
    lspProcess.stdin.write(message);
  });

  // Forward messages from LSP server to WebSocket
  lspProcess.stdout.on('data', (data: Buffer) => {
    const message = data.toString();
    console.log('← LSP to Client:', message.substring(0, 100));
    socket.send(message);
  });

  // Handle LSP server errors
  lspProcess.stderr.on('data', (data: Buffer) => {
    console.error('LSP Error:', data.toString());
  });

  // Handle LSP server exit
  lspProcess.on('exit', (code: number | null) => {
    console.log(`LSP server process exited with code ${code}`);
    socket.close();
  });

  // Handle WebSocket close
  socket.on('close', () => {
    console.log('Client disconnected');
    lspProcess.kill();
  });

  // Handle WebSocket errors
  socket.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
    lspProcess.kill();
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket bridge server listening on port ${PORT}`);
});
