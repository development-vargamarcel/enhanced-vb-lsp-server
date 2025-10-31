"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const ws = __importStar(require("ws"));
const cp = __importStar(require("child_process"));
const PORT = process.env.PORT || 3001;
const MAX_CLIENTS = 10;
const activeConnections = new Map();
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
const wss = new ws.Server({
    server,
    perMessageDeflate: false,
    maxPayload: 10 * 1024 * 1024
});
console.log(`[${new Date().toISOString()}] Starting WebSocket bridge on port ${PORT}`);
wss.on('connection', (socket, request) => {
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
    const connection = {
        socket,
        process: lspProcess,
        id: clientId
    };
    activeConnections.set(clientId, connection);
    socket.on('message', (data) => {
        try {
            const message = data.toString();
            if (lspProcess.stdin && !lspProcess.killed) {
                lspProcess.stdin.write(message);
            }
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error forwarding message:`, error);
        }
    });
    lspProcess.stdout.on('data', (data) => {
        try {
            const message = data.toString();
            if (socket.readyState === ws.OPEN) {
                socket.send(message);
            }
        }
        catch (error) {
            console.error(`[${new Date().toISOString()}] Error sending message:`, error);
        }
    });
    lspProcess.stderr.on('data', (data) => {
        console.error(`[${new Date().toISOString()}] LSP Error:`, data.toString());
    });
    lspProcess.on('exit', (code) => {
        console.log(`[${new Date().toISOString()}] LSP process exited (code: ${code})`);
        cleanupConnection(clientId);
    });
    lspProcess.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] LSP process error:`, error);
        cleanupConnection(clientId);
    });
    socket.on('close', () => {
        console.log(`[${new Date().toISOString()}] Client ${clientId} disconnected`);
        cleanupConnection(clientId);
    });
    socket.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] WebSocket error:`, error);
        cleanupConnection(clientId);
    });
    const pingInterval = setInterval(() => {
        if (socket.readyState === ws.OPEN) {
            socket.ping();
        }
        else {
            clearInterval(pingInterval);
        }
    }, 30000);
    socket.on('close', () => {
        clearInterval(pingInterval);
    });
});
function cleanupConnection(clientId) {
    const connection = activeConnections.get(clientId);
    if (!connection)
        return;
    console.log(`[${new Date().toISOString()}] Cleaning up connection ${clientId}`);
    try {
        if (connection.process && !connection.process.killed) {
            connection.process.kill('SIGTERM');
        }
        if (connection.socket.readyState === ws.OPEN) {
            connection.socket.close(1000, 'Cleanup');
        }
    }
    catch (error) {
        console.error(`[${new Date().toISOString()}] Cleanup error:`, error);
    }
    activeConnections.delete(clientId);
    console.log(`[${new Date().toISOString()}] Active connections: ${activeConnections.size}`);
}
function generateClientId() {
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
//# sourceMappingURL=websocket-bridge.js.map