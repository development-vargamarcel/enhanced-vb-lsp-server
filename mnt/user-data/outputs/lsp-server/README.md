# Simple Visual Basic Language Server

A basic Language Server Protocol (LSP) implementation for Visual Basic that provides IntelliSense capabilities including code completion, hover information, and diagnostics.

## Features

This language server provides the following capabilities:

- **Code Completion**: Suggests Visual Basic keywords, types, and symbols defined in your code
- **Hover Information**: Shows details about keywords and types when hovering over them
- **Diagnostics**: Provides warnings for common issues like missing type declarations
- **Symbol Detection**: Automatically detects functions, subroutines, variables, and classes in your code

## Installation

1. Install Node.js (version 16 or higher)

2. Install dependencies:
```bash
npm install
```

3. Compile the TypeScript code:
```bash
npm run compile
```

## Running the Server

### Stdio Mode (Default)

The server runs in stdio mode by default, which is suitable for integration with editors:

```bash
npm start
```

### Development Mode with Watch

For development, you can run the compiler in watch mode:

```bash
npm run watch
```

Then in another terminal:
```bash
npm start
```

## Integrating with Monaco Editor

To use this language server with Monaco Editor, you will need to set up a communication channel. The most common approaches are:

### Option 1: WebSocket Bridge

You can create a WebSocket server that bridges between the LSP server and Monaco Editor:

1. Install additional dependencies:
```bash
npm install ws express
```

2. Create a WebSocket bridge server that spawns the LSP server and forwards messages

3. Use `monaco-languageclient` in your browser to connect to the WebSocket server

### Option 2: Browser Extension

For local development, you can create a browser extension that runs the language server in the background and communicates with Monaco Editor through the extension's messaging system.

### Option 3: Server Integration

If you have a backend server, you can integrate the LSP server there and expose it through HTTP or WebSocket endpoints.

## Language Server Capabilities

The server implements the following LSP features:

### Completion Provider
Provides code completion suggestions triggered by typing or pressing Ctrl+Space. The completion includes Visual Basic keywords, built-in types, and symbols defined in the current document.

### Hover Provider
Shows documentation and type information when hovering over identifiers. This includes details about Visual Basic keywords and type definitions.

### Diagnostic Provider
Analyzes code in real-time and provides warnings for potential issues such as variables declared without type specifications or functions without return types.

## Extending the Server

The server is designed to be easily extensible. You can enhance it by:

### Adding More Symbols
Edit the `loadVisualBasicSymbols()` function in `src/server.ts` to add more keywords, types, or framework classes.

### Improving Parsing
The `parseDocumentSymbols()` function uses simple regex patterns. You can enhance this with a proper Visual Basic parser for more accurate symbol detection.

### Adding Project Context
To make the server project-aware, you can implement workspace scanning to load symbols from all files in the project, not just the current document.

### Implementing More LSP Features
The server can be extended to support additional LSP capabilities such as:
- Go to Definition
- Find References
- Rename Symbol
- Document Formatting
- Code Actions (quick fixes)

## Architecture

The language server uses the official `vscode-languageserver` package, which provides the LSP protocol implementation. The server maintains:

- A document manager that tracks open text documents
- A symbol table with Visual Basic keywords and types
- Document-specific symbols parsed from the code

When clients request completions or hover information, the server analyzes the document content and returns appropriate results based on the cursor position and surrounding context.

## Troubleshooting

### Server Not Responding
Ensure the server is running and check the console output for any error messages. The server logs initialization and completion requests.

### No Completions Appearing
Verify that Monaco Editor is properly configured to use the Visual Basic language ID and that the language client is connected to the server.

### Type Errors During Compilation
Make sure you have installed all dependencies with `npm install` and that you are using a compatible Node.js version.

## Development Roadmap

Future enhancements could include:

- Full Visual Basic syntax parser using Roslyn APIs
- Multi-file project analysis
- IntelliSense for .NET Framework classes
- Integration with Visual Basic compiler for accurate type checking
- Support for debugging integration
- Performance optimizations for large projects

## License

This is a demonstration project intended for educational purposes.
