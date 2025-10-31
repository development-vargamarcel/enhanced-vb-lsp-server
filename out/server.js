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
    connection.console.log('Initializing server with params: ' + JSON.stringify(params, null, 2));
    const capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    if (params.workspaceFolders) {
        workspaceFolders = params.workspaceFolders;
        connection.console.log('Workspace folders: ' + JSON.stringify(workspaceFolders, null, 2));
    }
    // Add test folder to workspace folders if not present
    const testFolder = {
        uri: (params.rootUri || '') + '/test',
        name: 'VB Test Files'
    };
    if (!workspaceFolders.some(folder => folder.uri === testFolder.uri)) {
        workspaceFolders.push(testFolder);
        connection.console.log('Added test folder to workspace folders');
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
connection.onInitialized(async () => {
    connection.console.log('Enhanced Visual Basic Language Server initialized');
    if (hasConfigurationCapability) {
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    // Register file watcher for VB files
    connection.client.register(require('vscode-languageserver').DidChangeWatchedFilesNotification.type, {
        watchers: [
            {
                globPattern: '**/*.{vb,vbs,bas,cls,frm}',
                kind: require('vscode-languageserver').WatchKind.Create |
                    require('vscode-languageserver').WatchKind.Change |
                    require('vscode-languageserver').WatchKind.Delete
            }
        ]
    });
    // Load initial workspace
    connection.console.log('Starting initial workspace indexing...');
    loadVisualBasicSymbols();
    await indexWorkspace();
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
    // Always include the test folder
    const testFolderPath = path.join(__dirname, '..', 'test');
    if (fs.existsSync(testFolderPath)) {
        connection.console.log(`Indexing test folder: ${testFolderPath}`);
        await indexDirectory(testFolderPath);
    }
    for (const folder of workspaceFolders) {
        const folderPath = decodeURIComponent(folder.uri.replace('file://', ''));
        connection.console.log(`Indexing workspace folder: ${folderPath}`);
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
        const vbFilePatterns = ['.vb', '.vbs', '.bas', '.cls', '.frm'];
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
            else if (entry.isFile() && vbFilePatterns.some(ext => entry.name.toLowerCase().endsWith(ext))) {
                try {
                    await indexFile(fullPath);
                    connection.console.log(`Indexed VB file: ${entry.name}`);
                }
                catch (error) {
                    connection.console.error(`Error indexing file ${entry.name}: ${error}`);
                }
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
    let currentClass = null;
    let currentModule = null;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip comments and empty lines
        if (line.startsWith("'") || line.startsWith('REM ') || !line) {
            continue;
        }
        // Module detection
        const moduleMatch = line.match(/^\s*(Public\s+|Private\s+)?Module\s+(\w+)/i);
        if (moduleMatch) {
            currentModule = moduleMatch[2];
            symbols.push({
                name: moduleMatch[2],
                kind: node_1.CompletionItemKind.Module,
                detail: 'Module',
                accessibility: moduleMatch[1]?.trim() || 'Public',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
            continue;
        }
        // Class detection
        const classMatch = line.match(/^\s*(Public\s+|Private\s+)?Class\s+(\w+)(?:\s+(?:Inherits|Implements)\s+(\w+))?/i);
        if (classMatch) {
            currentClass = classMatch[2];
            symbols.push({
                name: classMatch[2],
                kind: node_1.CompletionItemKind.Class,
                detail: `Class${classMatch[3] ? ` (${classMatch[3]})` : ''}`,
                accessibility: classMatch[1]?.trim() || 'Public',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
            continue;
        }
        // Property detection
        const propertyMatch = line.match(/^\s*(Public\s+|Private\s+)?Property\s+(Get|Let|Set)?\s*(\w+)(?:\s*\((.*?)\))?\s*(?:As\s+(\w+))?/i);
        if (propertyMatch) {
            const propName = propertyMatch[3];
            const propType = propertyMatch[5] || 'Variant';
            const accessType = propertyMatch[2] || 'Get';
            symbols.push({
                name: propName,
                kind: node_1.CompletionItemKind.Property,
                detail: `Property ${accessType} As ${propType}`,
                accessibility: propertyMatch[1]?.trim() || 'Public',
                type: propType,
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        // Function detection with enhanced parameter parsing
        const funcMatch = line.match(/^\s*(Public\s+|Private\s+)?Function\s+(\w+)\s*\((.*?)\)(?:\s+As\s+(\w+))?/i);
        if (funcMatch) {
            const params = funcMatch[3] ? funcMatch[3].split(',').map(p => {
                const paramMatch = p.trim().match(/(?:ByVal\s+|ByRef\s+)?(\w+)(?:\s+As\s+(\w+))?/i);
                return paramMatch ? `${paramMatch[1]}: ${paramMatch[2] || 'Variant'}` : p.trim();
            }).filter(p => p) : [];
            symbols.push({
                name: funcMatch[2],
                kind: node_1.CompletionItemKind.Function,
                detail: `Function (${params.join(', ')}) As ${funcMatch[4] || 'Variant'}`,
                accessibility: funcMatch[1]?.trim() || 'Public',
                parameters: params,
                returnType: funcMatch[4] || 'Variant',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        // Subroutine detection with enhanced parameter parsing
        const subMatch = line.match(/^\s*(Public\s+|Private\s+)?Sub\s+(\w+)\s*\((.*?)\)/i);
        if (subMatch) {
            const params = subMatch[3] ? subMatch[3].split(',').map(p => {
                const paramMatch = p.trim().match(/(?:ByVal\s+|ByRef\s+)?(\w+)(?:\s+As\s+(\w+))?/i);
                return paramMatch ? `${paramMatch[1]}: ${paramMatch[2] || 'Variant'}` : p.trim();
            }).filter(p => p) : [];
            symbols.push({
                name: subMatch[2],
                kind: node_1.CompletionItemKind.Method,
                detail: `Sub (${params.join(', ')})`,
                accessibility: subMatch[1]?.trim() || 'Public',
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
        // Variable declarations (Dim, Private, Public)
        const varMatch = line.match(/^\s*(Dim|Private|Public)\s+(\w+)(?:\s*\(.*?\))?\s*(?:As\s+(\w+))?/i);
        if (varMatch) {
            const scope = varMatch[1].toLowerCase() === 'dim' ? (currentClass || currentModule ? 'Private' : 'Local') : varMatch[1];
            symbols.push({
                name: varMatch[2],
                kind: node_1.CompletionItemKind.Variable,
                detail: `${scope} Variable As ${varMatch[3] || 'Variant'}`,
                type: varMatch[3] || 'Variant',
                accessibility: scope,
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        // Const declarations
        const constMatch = line.match(/^\s*(Private\s+|Public\s+)?Const\s+(\w+)\s*(?:As\s+(\w+))?\s*=\s*(.+)$/i);
        if (constMatch) {
            symbols.push({
                name: constMatch[2],
                kind: node_1.CompletionItemKind.Constant,
                detail: `Constant As ${constMatch[3] || 'Variant'} = ${constMatch[4].trim()}`,
                type: constMatch[3] || 'Variant',
                accessibility: constMatch[1]?.trim() || 'Public',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        // Enum detection
        const enumMatch = line.match(/^\s*(Public\s+|Private\s+)?Enum\s+(\w+)/i);
        if (enumMatch) {
            symbols.push({
                name: enumMatch[2],
                kind: node_1.CompletionItemKind.Enum,
                detail: 'Enumeration',
                accessibility: enumMatch[1]?.trim() || 'Public',
                location: {
                    uri: uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: line.length }
                    }
                }
            });
        }
        // Type (User-Defined Type) detection
        const typeMatch = line.match(/^\s*(Public\s+|Private\s+)?Type\s+(\w+)/i);
        if (typeMatch) {
            symbols.push({
                name: typeMatch[2],
                kind: node_1.CompletionItemKind.Struct,
                detail: 'User-Defined Type',
                accessibility: typeMatch[1]?.trim() || 'Public',
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
function generateSymbolDocumentation(symbol) {
    let doc = `### ${symbol.name}\n\n`;
    if (symbol.accessibility) {
        doc += `**Accessibility:** ${symbol.accessibility}\n\n`;
    }
    if (symbol.type) {
        doc += `**Type:** ${symbol.type}\n\n`;
    }
    if (symbol.parameters && symbol.parameters.length > 0) {
        doc += '**Parameters:**\n';
        symbol.parameters.forEach(param => {
            doc += `- ${param}\n`;
        });
        doc += '\n';
    }
    if (symbol.returnType) {
        doc += `**Returns:** ${symbol.returnType}\n\n`;
    }
    if (symbol.documentation) {
        doc += `${symbol.documentation}\n\n`;
    }
    return doc;
}
connection.onCompletion((textDocumentPosition) => {
    console.log('Completion request received:', textDocumentPosition);
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
        console.log('Document not found:', textDocumentPosition.textDocument.uri);
        // Return built-in symbols as fallback
        return Array.from(workspaceIndex.symbols.values())
            .flat()
            .map(symbol => ({
            label: symbol.name,
            kind: symbol.kind,
            detail: symbol.detail,
            documentation: symbol.documentation
        }));
    }
    console.log('Document found, processing completion...');
    const completionItems = [];
    const text = document.getText();
    const position = textDocumentPosition.position;
    const currentLine = text.split('\n')[position.line];
    const lineUntilCursor = currentLine.slice(0, position.character);
    // Context-aware completion based on the current line
    const inClassContext = /^\s*(Public\s+|Private\s+)?Class\s+\w*$/.test(lineUntilCursor);
    const inFunctionContext = /^\s*(Public\s+|Private\s+)?(?:Function|Sub)\s+\w*$/.test(lineUntilCursor);
    const inTypeContext = /\b(?:As|New)\s+\w*$/.test(lineUntilCursor);
    const inPropertyContext = /^\s*(Public\s+|Private\s+)?Property\s+(?:Get|Let|Set)?\s*\w*$/.test(lineUntilCursor);
    // Add built-in symbols based on context
    workspaceIndex.symbols.forEach((symbols, category) => {
        symbols.forEach(symbol => {
            if ((inTypeContext && symbol.kind === node_1.CompletionItemKind.Class) ||
                (inClassContext && symbol.kind === node_1.CompletionItemKind.Keyword) ||
                (!inTypeContext && !inClassContext)) {
                completionItems.push({
                    label: symbol.name,
                    kind: symbol.kind,
                    detail: symbol.detail,
                    documentation: symbol.documentation,
                    sortText: `0${symbol.name}` // Built-in symbols appear first
                });
            }
        });
    });
    // Add workspace symbols with context awareness
    workspaceIndex.fileSymbols.forEach((symbols) => {
        symbols.forEach(symbol => {
            const existing = completionItems.find(item => item.label === symbol.name);
            if (!existing) {
                let shouldAdd = true;
                if (inTypeContext) {
                    shouldAdd = symbol.kind === node_1.CompletionItemKind.Class ||
                        symbol.kind === node_1.CompletionItemKind.Interface ||
                        symbol.kind === node_1.CompletionItemKind.Enum ||
                        symbol.kind === node_1.CompletionItemKind.Struct;
                }
                else if (inPropertyContext) {
                    shouldAdd = symbol.kind === node_1.CompletionItemKind.Property ||
                        symbol.kind === node_1.CompletionItemKind.Method ||
                        symbol.kind === node_1.CompletionItemKind.Function;
                }
                if (shouldAdd) {
                    let detail = symbol.detail;
                    if (symbol.parameters) {
                        detail += `\nParameters: (${symbol.parameters.join(', ')})`;
                    }
                    if (symbol.type) {
                        detail += `\nType: ${symbol.type}`;
                    }
                    completionItems.push({
                        label: symbol.name,
                        kind: symbol.kind,
                        detail: detail,
                        documentation: {
                            kind: 'markdown',
                            value: generateSymbolDocumentation(symbol)
                        },
                        sortText: `1${symbol.name}`, // Workspace symbols appear after built-ins
                        data: {
                            uri: document.uri,
                            name: symbol.name,
                            kind: symbol.kind
                        }
                    });
                }
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
connection.onDidChangeWatchedFiles(async (params) => {
    for (const change of params.changes) {
        const uri = change.uri;
        const fsPath = uri.replace('file://', '');
        // Handle file changes
        if (change.type === 1 || change.type === 2) { // Created or Changed
            try {
                await indexFile(fsPath);
                connection.console.log(`Reindexed file: ${fsPath}`);
            }
            catch (error) {
                connection.console.error(`Error reindexing file ${fsPath}: ${error}`);
            }
        }
        // Handle file deletions
        else if (change.type === 3) { // Deleted
            workspaceIndex.fileSymbols.delete(uri);
            connection.console.log(`Removed from index: ${fsPath}`);
        }
    }
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