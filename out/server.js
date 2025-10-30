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
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Create connection based on environment or fallback to stdio
const connection = process.argv.includes('--stdio')
    ? (0, node_1.createConnection)(process.stdin, process.stdout)
    : (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
const workspaceIndex = {
    symbols: new Map(),
    fileSymbols: new Map(),
    references: new Map()
};
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let workspaceFolders = [];
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    if (params.workspaceFolders) {
        workspaceFolders = params.workspaceFolders;
    }
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ' ']
            },
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    connection.console.log('Enhanced Visual Basic Language Server initialized');
    if (hasConfigurationCapability) {
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    loadVisualBasicSymbols();
    indexWorkspace();
});
function loadVisualBasicSymbols() {
    const vbKeywords = [
        { name: 'Dim', kind: node_1.CompletionItemKind.Keyword, detail: 'Variable declaration', documentation: 'Declares variables and allocates storage space.' },
        { name: 'Public', kind: node_1.CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares public accessibility.' },
        { name: 'Private', kind: node_1.CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares private accessibility.' },
        { name: 'Function', kind: node_1.CompletionItemKind.Keyword, detail: 'Function declaration', documentation: 'Declares a function that returns a value.' },
        { name: 'Sub', kind: node_1.CompletionItemKind.Keyword, detail: 'Subroutine declaration', documentation: 'Declares a subroutine.' },
        { name: 'Class', kind: node_1.CompletionItemKind.Keyword, detail: 'Class declaration', documentation: 'Declares a class.' },
        { name: 'Module', kind: node_1.CompletionItemKind.Keyword, detail: 'Module declaration', documentation: 'Declares a module.' },
        { name: 'If', kind: node_1.CompletionItemKind.Keyword, detail: 'Conditional statement', documentation: 'Conditional execution.' },
        { name: 'Then', kind: node_1.CompletionItemKind.Keyword, detail: 'Conditional clause', documentation: 'Part of If statement.' },
        { name: 'Else', kind: node_1.CompletionItemKind.Keyword, detail: 'Alternative clause', documentation: 'Alternative branch.' },
        { name: 'End', kind: node_1.CompletionItemKind.Keyword, detail: 'Block terminator', documentation: 'Terminates a block.' },
        { name: 'For', kind: node_1.CompletionItemKind.Keyword, detail: 'Loop statement', documentation: 'For loop.' },
        { name: 'Next', kind: node_1.CompletionItemKind.Keyword, detail: 'Loop terminator', documentation: 'Ends For loop.' },
        { name: 'While', kind: node_1.CompletionItemKind.Keyword, detail: 'Loop statement', documentation: 'While loop.' },
        { name: 'Return', kind: node_1.CompletionItemKind.Keyword, detail: 'Return statement', documentation: 'Returns from function.' },
        { name: 'As', kind: node_1.CompletionItemKind.Keyword, detail: 'Type declaration', documentation: 'Specifies type.' },
        { name: 'New', kind: node_1.CompletionItemKind.Keyword, detail: 'Object instantiation', documentation: 'Creates new instance.' }
    ];
    const vbTypes = [
        { name: 'String', kind: node_1.CompletionItemKind.Class, detail: 'System.String', documentation: 'Text string type.' },
        { name: 'Integer', kind: node_1.CompletionItemKind.Class, detail: 'System.Int32', documentation: '32-bit integer.' },
        { name: 'Long', kind: node_1.CompletionItemKind.Class, detail: 'System.Int64', documentation: '64-bit integer.' },
        { name: 'Double', kind: node_1.CompletionItemKind.Class, detail: 'System.Double', documentation: 'Double precision float.' },
        { name: 'Boolean', kind: node_1.CompletionItemKind.Class, detail: 'System.Boolean', documentation: 'True or False.' },
        { name: 'Date', kind: node_1.CompletionItemKind.Class, detail: 'System.DateTime', documentation: 'Date and time.' },
        { name: 'Object', kind: node_1.CompletionItemKind.Class, detail: 'System.Object', documentation: 'Base object type.' }
    ];
    workspaceIndex.symbols.set('keywords', vbKeywords);
    workspaceIndex.symbols.set('types', vbTypes);
    connection.console.log('Loaded built-in Visual Basic symbols');
}
async function indexWorkspace() {
    connection.console.log('Starting workspace indexing...');
    for (const folder of workspaceFolders) {
        const folderPath = decodeURIComponent(folder.uri.replace('file://', ''));
        await indexDirectory(folderPath);
    }
    const totalSymbols = Array.from(workspaceIndex.fileSymbols.values())
        .reduce((sum, symbols) => sum + symbols.length, 0);
    connection.console.log(`Workspace indexing complete. Indexed ${workspaceIndex.fileSymbols.size} files with ${totalSymbols} symbols.`);
}
async function indexDirectory(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            return;
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') &&
                    entry.name !== 'node_modules' &&
                    entry.name !== 'bin' &&
                    entry.name !== 'obj') {
                    await indexDirectory(fullPath);
                }
            }
            else if (entry.isFile() && (entry.name.endsWith('.vb') || entry.name.endsWith('.vbs'))) {
                await indexFile(fullPath);
            }
        }
    }
    catch (error) {
        connection.console.error(`Error indexing directory ${dirPath}: ${error}`);
    }
}
async function indexFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const uri = 'file://' + filePath;
        const symbols = parseDocumentSymbols(content, uri);
        workspaceIndex.fileSymbols.set(uri, symbols);
        connection.console.log(`Indexed ${symbols.length} symbols from ${path.basename(filePath)}`);
    }
    catch (error) {
        connection.console.error(`Error indexing file ${filePath}: ${error}`);
    }
}
function parseDocumentSymbols(text, uri) {
    const symbols = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const classMatch = line.match(/^\s*(Public|Private)?\s*Class\s+(\w+)/i);
        if (classMatch) {
            symbols.push({
                name: classMatch[2],
                kind: node_1.CompletionItemKind.Class,
                detail: 'Class',
                accessibility: classMatch[1] || 'Public',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        const funcMatch = line.match(/^\s*(Public|Private)?\s*Function\s+(\w+)\s*\(([^)]*)\)(?:\s+As\s+(\w+))?/i);
        if (funcMatch) {
            const params = funcMatch[3] ? funcMatch[3].split(',').map(p => p.trim()).filter(p => p) : [];
            symbols.push({
                name: funcMatch[2],
                kind: node_1.CompletionItemKind.Function,
                detail: 'Function',
                accessibility: funcMatch[1] || 'Public',
                parameters: params,
                returnType: funcMatch[4] || 'Object',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        const subMatch = line.match(/^\s*(Public|Private)?\s*Sub\s+(\w+)\s*\(([^)]*)\)/i);
        if (subMatch) {
            const params = subMatch[3] ? subMatch[3].split(',').map(p => p.trim()).filter(p => p) : [];
            symbols.push({
                name: subMatch[2],
                kind: node_1.CompletionItemKind.Method,
                detail: 'Subroutine',
                accessibility: subMatch[1] || 'Public',
                parameters: params,
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        const dimMatch = line.match(/^\s*Dim\s+(\w+)(?:\s+As\s+(\w+))?/i);
        if (dimMatch) {
            symbols.push({
                name: dimMatch[1],
                kind: node_1.CompletionItemKind.Variable,
                detail: 'Variable',
                type: dimMatch[2] || 'Object',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
    }
    return symbols;
}
connection.onCompletion((textDocumentPosition) => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        return [];
    }
    const completionItems = [];
    workspaceIndex.symbols.forEach((symbols) => {
        symbols.forEach(symbol => {
            completionItems.push({
                label: symbol.name,
                kind: symbol.kind,
                detail: symbol.detail,
                documentation: symbol.documentation
            });
        });
    });
    workspaceIndex.fileSymbols.forEach((symbols) => {
        symbols.forEach(symbol => {
            const existing = completionItems.find(item => item.label === symbol.name);
            if (!existing) {
                completionItems.push({
                    label: symbol.name,
                    kind: symbol.kind,
                    detail: symbol.detail
                });
            }
        });
    });
    return completionItems;
});
connection.onCompletionResolve((item) => {
    return item;
});
connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    const position = params.position;
    const text = document.getText();
    const lineText = text.split('\n')[position.line];
    const word = getWordAtPosition(lineText, position.character);
    for (const [category, symbols] of workspaceIndex.symbols) {
        const symbol = symbols.find(s => s.name.toLowerCase() === word.toLowerCase());
        if (symbol) {
            return {
                contents: {
                    kind: 'markdown',
                    value: `**${symbol.name}**\n\n${symbol.detail}${symbol.documentation ? '\n\n' + symbol.documentation : ''}`
                }
            };
        }
    }
    const foundSymbol = findSymbol(word, document.uri);
    if (foundSymbol) {
        let content = `**${foundSymbol.name}**\n\n${foundSymbol.detail}`;
        if (foundSymbol.type) {
            content += `\n\nType: ${foundSymbol.type}`;
        }
        return {
            contents: {
                kind: 'markdown',
                value: content
            }
        };
    }
    return null;
});
connection.onDefinition((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    const text = document.getText();
    const lineText = text.split('\n')[params.position.line];
    const word = getWordAtPosition(lineText, params.position.character);
    const symbol = findSymbol(word, document.uri);
    if (symbol && symbol.location) {
        return symbol.location;
    }
    return null;
});
connection.onReferences((params) => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return [];
    }
    const text = document.getText();
    const lineText = text.split('\n')[params.position.line];
    const word = getWordAtPosition(lineText, params.position.character);
    const references = [];
    workspaceIndex.fileSymbols.forEach((symbols, uri) => {
        const fileContent = uri.startsWith('file://') ?
            (() => { try {
                return fs.readFileSync(uri.replace('file://', ''), 'utf-8');
            }
            catch {
                return '';
            } })() : '';
        if (fileContent) {
            const lines = fileContent.split('\n');
            lines.forEach((line, lineNum) => {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    references.push({
                        uri: uri,
                        range: {
                            start: { line: lineNum, character: match.index },
                            end: { line: lineNum, character: match.index + word.length }
                        }
                    });
                }
            });
        }
    });
    return references;
});
documents.onDidChangeContent(change => {
    const uri = change.document.uri;
    const text = change.document.getText();
    const symbols = parseDocumentSymbols(text, uri);
    workspaceIndex.fileSymbols.set(uri, symbols);
    validateTextDocument(change.document);
});
documents.onDidClose(e => {
    workspaceIndex.fileSymbols.delete(e.document.uri);
});
async function validateTextDocument(textDocument) {
    const text = textDocument.getText();
    const diagnostics = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^\s*Dim\s+\w+\s*$/i)) {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Warning,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: lines[i].length }
                },
                message: 'Variable declared without explicit type',
                source: 'vb-lsp',
                code: 'VB001'
            });
        }
        if (line.match(/^\s*(Public|Private)?\s*Function\s+\w+\s*\(/i) && !line.includes(' As ')) {
            diagnostics.push({
                severity: node_1.DiagnosticSeverity.Warning,
                range: {
                    start: { line: i, character: 0 },
                    end: { line: i, character: lines[i].length }
                },
                message: 'Function without explicit return type',
                source: 'vb-lsp',
                code: 'VB002'
            });
        }
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}
function getWordAtPosition(line, character) {
    const beforeCursor = line.substring(0, character);
    const afterCursor = line.substring(character);
    const beforeMatch = beforeCursor.match(/[\w]+$/);
    const afterMatch = afterCursor.match(/^[\w]+/);
    const before = beforeMatch ? beforeMatch[0] : '';
    const after = afterMatch ? afterMatch[0] : '';
    return before + after;
}
function findSymbol(name, currentUri) {
    const lowerName = name.toLowerCase();
    const currentFileSymbols = workspaceIndex.fileSymbols.get(currentUri) || [];
    let symbol = currentFileSymbols.find(s => s.name.toLowerCase() === lowerName);
    if (symbol)
        return symbol;
    for (const [uri, symbols] of workspaceIndex.fileSymbols) {
        symbol = symbols.find(s => s.name.toLowerCase() === lowerName);
        if (symbol)
            return symbol;
    }
    for (const [category, symbols] of workspaceIndex.symbols) {
        symbol = symbols.find(s => s.name.toLowerCase() === lowerName);
        if (symbol)
            return symbol;
    }
    return undefined;
}
documents.listen(connection);
connection.listen();
connection.console.log('Enhanced Visual Basic Language Server is running');
//# sourceMappingURL=server.js.map