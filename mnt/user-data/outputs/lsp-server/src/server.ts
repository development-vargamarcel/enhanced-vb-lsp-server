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
  DiagnosticSeverity
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server using Node's IPC as a transport
const connection = createConnection(ProposedFeatures.all);

// Create a document manager to track open text documents
const documents = new TextDocuments(TextDocument);

// Store workspace symbols and project context
interface ProjectSymbol {
  name: string;
  kind: CompletionItemKind;
  detail: string;
  documentation?: string;
}

const workspaceSymbols: Map<string, ProjectSymbol[]> = new Map();

connection.onInitialize((params: InitializeParams) => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', ' ']
      },
      hoverProvider: true,
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false
      }
    }
  };

  return result;
});

connection.onInitialized(() => {
  connection.console.log('Language Server initialized successfully');
  
  // Load initial Visual Basic keywords and common types
  loadVisualBasicSymbols();
});

function loadVisualBasicSymbols() {
  // Common Visual Basic keywords and types
  const vbKeywords: ProjectSymbol[] = [
    { name: 'Dim', kind: CompletionItemKind.Keyword, detail: 'Variable declaration' },
    { name: 'Public', kind: CompletionItemKind.Keyword, detail: 'Access modifier' },
    { name: 'Private', kind: CompletionItemKind.Keyword, detail: 'Access modifier' },
    { name: 'Function', kind: CompletionItemKind.Keyword, detail: 'Function declaration' },
    { name: 'Sub', kind: CompletionItemKind.Keyword, detail: 'Subroutine declaration' },
    { name: 'Class', kind: CompletionItemKind.Keyword, detail: 'Class declaration' },
    { name: 'Module', kind: CompletionItemKind.Keyword, detail: 'Module declaration' },
    { name: 'If', kind: CompletionItemKind.Keyword, detail: 'Conditional statement' },
    { name: 'Then', kind: CompletionItemKind.Keyword, detail: 'Conditional clause' },
    { name: 'Else', kind: CompletionItemKind.Keyword, detail: 'Alternative clause' },
    { name: 'End', kind: CompletionItemKind.Keyword, detail: 'Block terminator' },
    { name: 'For', kind: CompletionItemKind.Keyword, detail: 'Loop statement' },
    { name: 'Next', kind: CompletionItemKind.Keyword, detail: 'Loop terminator' },
    { name: 'While', kind: CompletionItemKind.Keyword, detail: 'Loop statement' },
    { name: 'Return', kind: CompletionItemKind.Keyword, detail: 'Return statement' },
    { name: 'As', kind: CompletionItemKind.Keyword, detail: 'Type declaration' },
    { name: 'New', kind: CompletionItemKind.Keyword, detail: 'Object instantiation' }
  ];

  const vbTypes: ProjectSymbol[] = [
    { name: 'String', kind: CompletionItemKind.Class, detail: 'System.String' },
    { name: 'Integer', kind: CompletionItemKind.Class, detail: 'System.Int32' },
    { name: 'Long', kind: CompletionItemKind.Class, detail: 'System.Int64' },
    { name: 'Double', kind: CompletionItemKind.Class, detail: 'System.Double' },
    { name: 'Boolean', kind: CompletionItemKind.Class, detail: 'System.Boolean' },
    { name: 'Date', kind: CompletionItemKind.Class, detail: 'System.DateTime' },
    { name: 'Object', kind: CompletionItemKind.Class, detail: 'System.Object' },
    { name: 'Decimal', kind: CompletionItemKind.Class, detail: 'System.Decimal' }
  ];

  workspaceSymbols.set('keywords', vbKeywords);
  workspaceSymbols.set('types', vbTypes);
}

// Provide code completion
connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    const text = document.getText();
    const position = textDocumentPosition.position;
    const offset = document.offsetAt(position);
    
    // Get the word being typed
    const lineText = text.split('\n')[position.line];
    const currentWord = getCurrentWord(lineText, position.character);

    connection.console.log(`Completion requested for: "${currentWord}"`);

    // Combine all symbols for completion
    const completionItems: CompletionItem[] = [];
    
    workspaceSymbols.forEach((symbols, category) => {
      symbols.forEach(symbol => {
        completionItems.push({
          label: symbol.name,
          kind: symbol.kind,
          detail: symbol.detail,
          documentation: symbol.documentation
        });
      });
    });

    // Parse document for user-defined symbols
    const userSymbols = parseDocumentSymbols(text);
    userSymbols.forEach(symbol => {
      completionItems.push({
        label: symbol.name,
        kind: symbol.kind,
        detail: symbol.detail
      });
    });

    return completionItems;
  }
);

// Resolve additional information for completion items
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    // Add additional documentation or details if needed
    return item;
  }
);

// Provide hover information
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

    // Look up the word in our symbol table
    for (const [category, symbols] of workspaceSymbols) {
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

    return null;
  }
);

// Provide diagnostics (error checking)
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];

  // Simple validation: check for common Visual Basic syntax patterns
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for Dim without As clause
    if (line.match(/^\s*Dim\s+\w+\s*$/i)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: 0 },
          end: { line: i, character: lines[i].length }
        },
        message: 'Variable declared without type specification. Consider adding "As Type".',
        source: 'vb-lsp'
      });
    }

    // Check for Function without return type
    if (line.match(/^\s*Function\s+\w+\s*\(/i) && !line.includes('As ')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: 0 },
          end: { line: i, character: lines[i].length }
        },
        message: 'Function declared without return type. Consider adding "As Type".',
        source: 'vb-lsp'
      });
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Helper functions
function getCurrentWord(line: string, character: number): string {
  const beforeCursor = line.substring(0, character);
  const match = beforeCursor.match(/[\w\.]+$/);
  return match ? match[0] : '';
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

function parseDocumentSymbols(text: string): ProjectSymbol[] {
  const symbols: ProjectSymbol[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Parse Sub declarations
    const subMatch = line.match(/^\s*(Public|Private)?\s*Sub\s+(\w+)/i);
    if (subMatch) {
      symbols.push({
        name: subMatch[2],
        kind: CompletionItemKind.Method,
        detail: 'Subroutine'
      });
    }

    // Parse Function declarations
    const funcMatch = line.match(/^\s*(Public|Private)?\s*Function\s+(\w+)/i);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[2],
        kind: CompletionItemKind.Function,
        detail: 'Function'
      });
    }

    // Parse Dim declarations
    const dimMatch = line.match(/^\s*Dim\s+(\w+)/i);
    if (dimMatch) {
      symbols.push({
        name: dimMatch[1],
        kind: CompletionItemKind.Variable,
        detail: 'Variable'
      });
    }

    // Parse Class declarations
    const classMatch = line.match(/^\s*(Public|Private)?\s*Class\s+(\w+)/i);
    if (classMatch) {
      symbols.push({
        name: classMatch[2],
        kind: CompletionItemKind.Class,
        detail: 'Class'
      });
    }
  }

  return symbols;
}

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();

connection.console.log('Visual Basic Language Server is running');
