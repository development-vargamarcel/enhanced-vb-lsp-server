# Quick Start Guide

Get the Enhanced Visual Basic Language Server running in 5 minutes.

## Step 1: Install Dependencies

```bash
npm install
```

This installs all required packages including the language server libraries and WebSocket support.

## Step 2: Compile TypeScript

```bash
npm run compile
```

This compiles the TypeScript source code into executable JavaScript files in the `out/` directory.

## Step 3: Start the Server

```bash
npm run start:bridge
```

You should see output like:

```
[2024-...] =====================================
[2024-...] Enhanced VB Language Server Bridge
[2024-...] =====================================
[2024-...] WebSocket: ws://localhost:3000
[2024-...] Health check: http://localhost:3000/health
[2024-...] Max connections: 10
[2024-...] Ready to accept connections
[2024-...] =====================================
```

## Step 4: Open the Demo

Open `client-demo.html` in your web browser. You should see:

- ✅ Green connection indicator
- ✅ "Connected to enhanced language server" message
- ✅ Active feature badges (Code Completion, Hover, etc.)
- ✅ "150+ symbols indexed"

## Step 5: Test Features

### Code Completion
1. Position cursor after a space or dot
2. Press `Ctrl+Space` (or `Cmd+Space` on Mac)
3. See intelligent suggestions appear

### Hover Information
1. Hover your mouse over any keyword or symbol
2. See detailed information in a popup

### Go to Definition
1. Click on a class name (like "Calculator")
2. Press `F12`
3. Jump to its definition

### Find References
1. Click on a function name (like "Add")
2. Press `Shift+F12`
3. See all places it's used

## Troubleshooting

### "Connection Failed"

**Problem**: Browser can't connect to server

**Solutions**:
- Ensure server is running (`npm run start:bridge`)
- Check port 3000 is not blocked by firewall
- Verify no other process is using port 3000
- Try `http://localhost:3000/health` in browser

### "No Completions Appearing"

**Problem**: Code completion not working

**Solutions**:
- Press `Ctrl+Space` to manually trigger
- Check browser console for errors (F12 → Console tab)
- Verify green connection indicator is showing
- Try refreshing the browser page

### "Command Not Found: tsc"

**Problem**: TypeScript compiler not installed

**Solutions**:
```bash
npm install
# OR globally:
npm install -g typescript
```

### "Port Already in Use"

**Problem**: Port 3000 is occupied

**Solutions**:
```bash
# Use different port
PORT=3001 npm run start:bridge

# Then update client to: ws://localhost:3001
```

## Next Steps

### Use with Your VB Project

1. Modify WebSocket initialization in your app
2. Point workspace folders to your project directory
3. See `INTEGRATION_GUIDE.md` for details

### Customize Configuration

1. Copy `.vbconfig.example.json` to `.vbconfig.json`
2. Modify settings for your project
3. Restart server to apply changes

### Extend Features

1. Add custom diagnostic rules in `src/server.ts`
2. Implement additional symbol types
3. Integrate with your build system

## Development Mode

For development with auto-recompilation:

**Terminal 1 - Watch mode:**
```bash
npm run watch
```

**Terminal 2 - Run server:**
```bash
npm run start:bridge
```

Changes to `.ts` files automatically recompile. Restart server to load changes.

## Verification Checklist

- [ ] Node.js version 16+ installed (`node --version`)
- [ ] Dependencies installed (`node_modules/` exists)
- [ ] TypeScript compiled (`out/` directory exists)
- [ ] Server starts without errors
- [ ] Health endpoint responds: `http://localhost:3000/health`
- [ ] Demo client connects (green indicator)
- [ ] Code completion works (`Ctrl+Space`)
- [ ] Hover information displays
- [ ] F12 navigation works

## Common Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Start WebSocket bridge
npm run start:bridge

# Start stdio server
npm start

# Watch for changes
npm run watch

# Clean build artifacts
npm run clean

# Full rebuild
npm run rebuild

# Check health
curl http://localhost:3000/health
```

## Performance Tips

- Exclude large directories in `.vbconfig.json`
- Limit workspace to source directories only
- Use SSD for better file I/O performance
- Increase Node.js memory if needed:
  ```bash
  NODE_OPTIONS=--max-old-space-size=4096 npm run start:bridge
  ```

## Success Indicators

✅ Server logs show "Ready to accept connections"  
✅ Client shows green connection status  
✅ Features badges are activated (green)  
✅ Symbol count shows "150+" or higher  
✅ Code completion responds in <100ms  
✅ No errors in browser console  

## Getting Help

- **Documentation**: See `README.md` for comprehensive docs
- **Integration**: See `INTEGRATION_GUIDE.md` for Monaco setup
- **Configuration**: See `.vbconfig.example.json` for all options
- **Issues**: Check server console logs for error messages
- **Browser**: Check DevTools console (F12) for client errors

---

**Time to Complete**: ~5 minutes  
**Difficulty**: Beginner  
**Platform**: Windows, Mac, Linux
