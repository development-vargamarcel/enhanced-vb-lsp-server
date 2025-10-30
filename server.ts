import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Hover,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  WorkspaceFolder,
  Location,
  Definition,
  ReferenceParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from 'path';

// Create connection based on environment or fallback to stdio
const connection = process.argv.includes('--stdio')
  ? createConnection(process.stdin, process.stdout)
  : createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

interface ProjectSymbol {
  name: string;
  kind: CompletionItemKind;
  detail: string;
  documentation?: string;
  location?: Location;
  type?: string;
  parameters?: string[];
  returnType?: string;
  accessibility?: string;
}

interface WorkspaceSymbolIndex {
  symbols: Map<string, ProjectSymbol[]>;
  fileSymbols: Map<string, ProjectSymbol[]>;
  references: Map<string, Location[]>;
}

const workspaceIndex: WorkspaceSymbolIndex = {
  symbols: new Map(),
  fileSymbols: new Map(),
  references: new Map()
};

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let workspaceFolders: WorkspaceFolder[] = [];

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );

  if (params.workspaceFolders) {
    workspaceFolders = params.workspaceFolders;
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
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
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }

  loadVisualBasicSymbols();
  indexWorkspace();
});

function loadVisualBasicSymbols() {
  const vbKeywords: ProjectSymbol[] = [
    { name: 'Dim', kind: CompletionItemKind.Keyword, detail: 'Variable declaration', documentation: 'Declares variables and allocates storage space.' },
    { name: 'Public', kind: CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares public accessibility.' },
    { name: 'Private', kind: CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares private accessibility.' },
    { name: 'Function', kind: CompletionItemKind.Keyword, detail: 'Function declaration', documentation: 'Declares a function that returns a value.' },
    { name: 'Sub', kind: CompletionItemKind.Keyword, detail: 'Subroutine declaration', documentation: 'Declares a subroutine.' },
    { name: 'Class', kind: CompletionItemKind.Keyword, detail: 'Class declaration', documentation: 'Declares a class.' },
    { name: 'Module', kind: CompletionItemKind.Keyword, detail: 'Module declaration', documentation: 'Declares a module.' },
    { name: 'If', kind: CompletionItemKind.Keyword, detail: 'Conditional statement', documentation: 'Conditional execution.' },
    { name: 'Then', kind: CompletionItemKind.Keyword, detail: 'Conditional clause', documentation: 'Part of If statement.' },
    { name: 'Else', kind: CompletionItemKind.Keyword, detail: 'Alternative clause', documentation: 'Alternative branch.' },
    { name: 'End', kind: CompletionItemKind.Keyword, detail: 'Block terminator', documentation: 'Terminates a block.' },
    { name: 'For', kind: CompletionItemKind.Keyword, detail: 'Loop statement', documentation: 'For loop.' },
    { name: 'Next', kind: CompletionItemKind.Keyword, detail: 'Loop terminator', documentation: 'Ends For loop.' },
    { name: 'While', kind: CompletionItemKind.Keyword, detail: 'Loop statement', documentation: 'While loop.' },
    { name: 'Return', kind: CompletionItemKind.Keyword, detail: 'Return statement', documentation: 'Returns from function.' },
    { name: 'As', kind: CompletionItemKind.Keyword, detail: 'Type declaration', documentation: 'Specifies type.' },
    { name: 'New', kind: CompletionItemKind.Keyword, detail: 'Object instantiation', documentation: 'Creates new instance.' }
  ];

  const vbTypes: ProjectSymbol[] = [
    { name: 'String', kind: CompletionItemKind.Class, detail: 'System.String', documentation: 'Text string type.' },
    { name: 'Integer', kind: CompletionItemKind.Class, detail: 'System.Int32', documentation: '32-bit integer.' },
    { name: 'Long', kind: CompletionItemKind.Class, detail: 'System.Int64', documentation: '64-bit integer.' },
    { name: 'Double', kind: CompletionItemKind.Class, detail: 'System.Double', documentation: 'Double precision float.' },
    { name: 'Boolean', kind: CompletionItemKind.Class, detail: 'System.Boolean', documentation: 'True or False.' },
    { name: 'Date', kind: CompletionItemKind.Class, detail: 'System.DateTime', documentation: 'Date and time.' },
    { name: 'Object', kind: CompletionItemKind.Class, detail: 'System.Object', documentation: 'Base object type.' }
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

async function indexDirectory(dirPath: string) {
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
      } else if (entry.isFile() && (entry.name.endsWith('.vb') || entry.name.endsWith('.vbs'))) {
        await indexFile(fullPath);
      }
    }
  } catch (error) {
    connection.console.error(`Error indexing directory ${dirPath}: ${error}`);
  }
}

async function indexFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const uri = 'file://' + filePath;
    const symbols = parseDocumentSymbols(content, uri);
    workspaceIndex.fileSymbols.set(uri, symbols);

    connection.console.log(`Indexed ${symbols.length} symbols from ${path.basename(filePath)}`);
  } catch (error) {
    connection.console.error(`Error indexing file ${filePath}: ${error}`);
  }
}

function parseDocumentSymbols(text: string, uri: string): ProjectSymbol[] {
  const symbols: ProjectSymbol[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const classMatch = line.match(/^\s*(Public|Private)?\s*Class\s+(\w+)/i);
    if (classMatch) {
      symbols.push({
        name: classMatch[2],
        kind: CompletionItemKind.Class,
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
        kind: CompletionItemKind.Function,
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
        kind: CompletionItemKind.Method,
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
        kind: CompletionItemKind.Variable,
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

connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    const completionItems: CompletionItem[] = [];

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
  }
);

connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    return item;
  }
);

connection.onHover(
  (params: TextDocumentPositionParams): Hover | null => {
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
  }
);

connection.onDefinition(
  (params: TextDocumentPositionParams): Definition | null => {
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
  }
);

connection.onReferences(
  (params: ReferenceParams): Location[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const text = document.getText();
    const lineText = text.split('\n')[params.position.line];
    const word = getWordAtPosition(lineText, params.position.character);

    const references: Location[] = [];

    workspaceIndex.fileSymbols.forEach((symbols, uri) => {
      const fileContent = uri.startsWith('file://') ?
        (() => { try { return fs.readFileSync(uri.replace('file://', ''), 'utf-8'); } catch { return ''; } })() : '';

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
  }
);

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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.match(/^\s*Dim\s+\w+\s*$/i)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
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
        severity: DiagnosticSeverity.Warning,
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

function getWordAtPosition(line: string, character: number): string {
  const beforeCursor = line.substring(0, character);
  const afterCursor = line.substring(character);

  const beforeMatch = beforeCursor.match(/[\w]+$/);
  const afterMatch = afterCursor.match(/^[\w]+/);

  const before = beforeMatch ? beforeMatch[0] : '';
  const after = afterMatch ? afterMatch[0] : '';

  return before + after;
}

function findSymbol(name: string, currentUri: string): ProjectSymbol | undefined {
  const lowerName = name.toLowerCase();

  const currentFileSymbols = workspaceIndex.fileSymbols.get(currentUri) || [];
  let symbol = currentFileSymbols.find(s => s.name.toLowerCase() === lowerName);
  if (symbol) return symbol;

  for (const [uri, symbols] of workspaceIndex.fileSymbols) {
    symbol = symbols.find(s => s.name.toLowerCase() === lowerName);
    if (symbol) return symbol;
  }

  for (const [category, symbols] of workspaceIndex.symbols) {
    symbol = symbols.find(s => s.name.toLowerCase() === lowerName);
    if (symbol) return symbol;
  }

  return undefined;
}

documents.listen(connection);
connection.listen();

connection.console.log('Enhanced Visual Basic Language Server is running');
