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
  Range,
  Position,
  Definition,
  ReferenceParams,
  DocumentSymbolParams,
  SymbolInformation,
  SymbolKind,
  WorkspaceSymbolParams
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as fs from 'fs';
import * as path from 'path';

// Create connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create document manager
const documents = new TextDocuments(TextDocument);

// Project symbol interface
interface ProjectSymbol {
  name: string;
  kind: CompletionItemKind | SymbolKind;
  detail: string;
  documentation?: string;
  location?: Location;
  type?: string;
  parameters?: string[];
  returnType?: string;
  accessibility?: string;
}

// Workspace symbol index
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
      workspaceSymbolProvider: true,
      diagnosticProvider: {
        interFileDependencies: true,
        workspaceDiagnostics: true
      }
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

  // Load built-in Visual Basic symbols
  loadVisualBasicSymbols();
  
  // Index workspace folders
  indexWorkspace();
});

function loadVisualBasicSymbols() {
  const vbKeywords: ProjectSymbol[] = [
    { name: 'Dim', kind: CompletionItemKind.Keyword, detail: 'Variable declaration', documentation: 'Declares variables and allocates storage space.' },
    { name: 'Public', kind: CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares that program elements are accessible from anywhere.' },
    { name: 'Private', kind: CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares that program elements are accessible only within the same module, class, or structure.' },
    { name: 'Protected', kind: CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares that program elements are accessible only from within their own class or from a derived class.' },
    { name: 'Friend', kind: CompletionItemKind.Keyword, detail: 'Access modifier', documentation: 'Declares that program elements are accessible from within the same assembly.' },
    { name: 'Function', kind: CompletionItemKind.Keyword, detail: 'Function declaration', documentation: 'Declares a procedure that returns a value.' },
    { name: 'Sub', kind: CompletionItemKind.Keyword, detail: 'Subroutine declaration', documentation: 'Declares a procedure that does not return a value.' },
    { name: 'Class', kind: CompletionItemKind.Keyword, detail: 'Class declaration', documentation: 'Declares a class and defines its members.' },
    { name: 'Module', kind: CompletionItemKind.Keyword, detail: 'Module declaration', documentation: 'Declares a module and defines its members.' },
    { name: 'Structure', kind: CompletionItemKind.Keyword, detail: 'Structure declaration', documentation: 'Declares a structure (value type) and defines its members.' },
    { name: 'Interface', kind: CompletionItemKind.Keyword, detail: 'Interface declaration', documentation: 'Declares an interface and defines its members.' },
    { name: 'Enum', kind: CompletionItemKind.Keyword, detail: 'Enumeration declaration', documentation: 'Declares an enumeration and defines its members.' },
    { name: 'Namespace', kind: CompletionItemKind.Keyword, detail: 'Namespace declaration', documentation: 'Organizes code into hierarchical groups.' },
    { name: 'If', kind: CompletionItemKind.Keyword, detail: 'Conditional statement', documentation: 'Conditionally executes a group of statements.' },
    { name: 'Then', kind: CompletionItemKind.Keyword, detail: 'Conditional clause', documentation: 'Introduces the statements to execute when If condition is True.' },
    { name: 'Else', kind: CompletionItemKind.Keyword, detail: 'Alternative clause', documentation: 'Introduces statements to execute when If condition is False.' },
    { name: 'ElseIf', kind: CompletionItemKind.Keyword, detail: 'Additional condition', documentation: 'Introduces an additional condition in an If statement.' },
    { name: 'End', kind: CompletionItemKind.Keyword, detail: 'Block terminator', documentation: 'Terminates a procedure or block definition.' },
    { name: 'For', kind: CompletionItemKind.Keyword, detail: 'Loop statement', documentation: 'Repeats a group of statements a specified number of times.' },
    { name: 'Next', kind: CompletionItemKind.Keyword, detail: 'Loop terminator', documentation: 'Terminates a For loop.' },
    { name: 'Each', kind: CompletionItemKind.Keyword, detail: 'Collection iteration', documentation: 'Iterates through elements in a collection.' },
    { name: 'While', kind: CompletionItemKind.Keyword, detail: 'Loop statement', documentation: 'Repeats statements while a condition is True.' },
    { name: 'Do', kind: CompletionItemKind.Keyword, detail: 'Loop statement', documentation: 'Repeats a block of statements.' },
    { name: 'Loop', kind: CompletionItemKind.Keyword, detail: 'Loop terminator', documentation: 'Terminates a Do loop.' },
    { name: 'Return', kind: CompletionItemKind.Keyword, detail: 'Return statement', documentation: 'Returns control to the calling procedure.' },
    { name: 'As', kind: CompletionItemKind.Keyword, detail: 'Type declaration', documentation: 'Specifies the data type of a variable or return value.' },
    { name: 'New', kind: CompletionItemKind.Keyword, detail: 'Object instantiation', documentation: 'Creates a new instance of a type.' },
    { name: 'Inherits', kind: CompletionItemKind.Keyword, detail: 'Inheritance declaration', documentation: 'Specifies the base class being inherited.' },
    { name: 'Implements', kind: CompletionItemKind.Keyword, detail: 'Interface implementation', documentation: 'Specifies interfaces being implemented.' },
    { name: 'Imports', kind: CompletionItemKind.Keyword, detail: 'Namespace import', documentation: 'Imports namespaces and types.' },
    { name: 'Property', kind: CompletionItemKind.Keyword, detail: 'Property declaration', documentation: 'Declares a property member.' },
    { name: 'Event', kind: CompletionItemKind.Keyword, detail: 'Event declaration', documentation: 'Declares an event.' },
    { name: 'Delegate', kind: CompletionItemKind.Keyword, detail: 'Delegate declaration', documentation: 'Declares a delegate type.' },
    { name: 'Try', kind: CompletionItemKind.Keyword, detail: 'Exception handling', documentation: 'Introduces exception handling block.' },
    { name: 'Catch', kind: CompletionItemKind.Keyword, detail: 'Exception handler', documentation: 'Catches and handles exceptions.' },
    { name: 'Finally', kind: CompletionItemKind.Keyword, detail: 'Cleanup block', documentation: 'Executes code regardless of exceptions.' },
    { name: 'Throw', kind: CompletionItemKind.Keyword, detail: 'Exception throwing', documentation: 'Throws an exception.' },
    { name: 'Select', kind: CompletionItemKind.Keyword, detail: 'Switch statement', documentation: 'Selects a statement block to execute.' },
    { name: 'Case', kind: CompletionItemKind.Keyword, detail: 'Case clause', documentation: 'Specifies a value to match in Select statement.' },
    { name: 'With', kind: CompletionItemKind.Keyword, detail: 'Object reference', documentation: 'Executes statements with implied object reference.' },
    { name: 'ByVal', kind: CompletionItemKind.Keyword, detail: 'Parameter passing', documentation: 'Passes parameter by value.' },
    { name: 'ByRef', kind: CompletionItemKind.Keyword, detail: 'Parameter passing', documentation: 'Passes parameter by reference.' },
    { name: 'Optional', kind: CompletionItemKind.Keyword, detail: 'Optional parameter', documentation: 'Specifies an optional parameter.' },
    { name: 'Overrides', kind: CompletionItemKind.Keyword, detail: 'Method override', documentation: 'Overrides a base class member.' },
    { name: 'Overloads', kind: CompletionItemKind.Keyword, detail: 'Method overload', documentation: 'Declares an overloaded member.' },
    { name: 'Shared', kind: CompletionItemKind.Keyword, detail: 'Shared member', documentation: 'Declares a member shared by all instances.' },
    { name: 'ReadOnly', kind: CompletionItemKind.Keyword, detail: 'Read-only member', documentation: 'Declares a read-only member.' },
    { name: 'WriteOnly', kind: CompletionItemKind.Keyword, detail: 'Write-only member', documentation: 'Declares a write-only property.' },
    { name: 'MustInherit', kind: CompletionItemKind.Keyword, detail: 'Abstract class', documentation: 'Declares an abstract class.' },
    { name: 'MustOverride', kind: CompletionItemKind.Keyword, detail: 'Abstract member', documentation: 'Declares an abstract member.' },
    { name: 'NotInheritable', kind: CompletionItemKind.Keyword, detail: 'Sealed class', documentation: 'Prevents inheritance of a class.' },
    { name: 'NotOverridable', kind: CompletionItemKind.Keyword, detail: 'Sealed member', documentation: 'Prevents override of a member.' }
  ];

  const vbTypes: ProjectSymbol[] = [
    { name: 'String', kind: CompletionItemKind.Class, detail: 'System.String', documentation: 'Represents text as a sequence of UTF-16 code units.' },
    { name: 'Integer', kind: CompletionItemKind.Class, detail: 'System.Int32', documentation: '32-bit signed integer (-2,147,483,648 to 2,147,483,647).' },
    { name: 'Long', kind: CompletionItemKind.Class, detail: 'System.Int64', documentation: '64-bit signed integer.' },
    { name: 'Short', kind: CompletionItemKind.Class, detail: 'System.Int16', documentation: '16-bit signed integer.' },
    { name: 'Byte', kind: CompletionItemKind.Class, detail: 'System.Byte', documentation: '8-bit unsigned integer (0 to 255).' },
    { name: 'Double', kind: CompletionItemKind.Class, detail: 'System.Double', documentation: 'Double-precision floating-point number.' },
    { name: 'Single', kind: CompletionItemKind.Class, detail: 'System.Single', documentation: 'Single-precision floating-point number.' },
    { name: 'Decimal', kind: CompletionItemKind.Class, detail: 'System.Decimal', documentation: 'Decimal number for financial calculations.' },
    { name: 'Boolean', kind: CompletionItemKind.Class, detail: 'System.Boolean', documentation: 'True or False value.' },
    { name: 'Date', kind: CompletionItemKind.Class, detail: 'System.DateTime', documentation: 'Date and time value.' },
    { name: 'Char', kind: CompletionItemKind.Class, detail: 'System.Char', documentation: 'Single Unicode character.' },
    { name: 'Object', kind: CompletionItemKind.Class, detail: 'System.Object', documentation: 'Base type of all .NET types.' },
    { name: 'SByte', kind: CompletionItemKind.Class, detail: 'System.SByte', documentation: '8-bit signed integer.' },
    { name: 'UShort', kind: CompletionItemKind.Class, detail: 'System.UInt16', documentation: '16-bit unsigned integer.' },
    { name: 'UInteger', kind: CompletionItemKind.Class, detail: 'System.UInt32', documentation: '32-bit unsigned integer.' },
    { name: 'ULong', kind: CompletionItemKind.Class, detail: 'System.UInt64', documentation: '64-bit unsigned integer.' }
  ];

  const commonTypes: ProjectSymbol[] = [
    { name: 'List', kind: CompletionItemKind.Class, detail: 'System.Collections.Generic.List(Of T)', documentation: 'Strongly typed list of objects.' },
    { name: 'Dictionary', kind: CompletionItemKind.Class, detail: 'System.Collections.Generic.Dictionary(Of TKey, TValue)', documentation: 'Collection of key/value pairs.' },
    { name: 'Array', kind: CompletionItemKind.Class, detail: 'System.Array', documentation: 'Base class for all arrays.' },
    { name: 'Exception', kind: CompletionItemKind.Class, detail: 'System.Exception', documentation: 'Base class for exceptions.' },
    { name: 'Console', kind: CompletionItemKind.Class, detail: 'System.Console', documentation: 'Console input and output operations.' },
    { name: 'File', kind: CompletionItemKind.Class, detail: 'System.IO.File', documentation: 'Static methods for file operations.' },
    { name: 'Directory', kind: CompletionItemKind.Class, detail: 'System.IO.Directory', documentation: 'Static methods for directory operations.' },
    { name: 'Path', kind: CompletionItemKind.Class, detail: 'System.IO.Path', documentation: 'Performs operations on path strings.' },
    { name: 'StringBuilder', kind: CompletionItemKind.Class, detail: 'System.Text.StringBuilder', documentation: 'Mutable string for efficient string manipulation.' },
    { name: 'Task', kind: CompletionItemKind.Class, detail: 'System.Threading.Tasks.Task', documentation: 'Represents asynchronous operation.' }
  ];

  const literals: ProjectSymbol[] = [
    { name: 'True', kind: CompletionItemKind.Value, detail: 'Boolean literal', documentation: 'Boolean true value.' },
    { name: 'False', kind: CompletionItemKind.Value, detail: 'Boolean literal', documentation: 'Boolean false value.' },
    { name: 'Nothing', kind: CompletionItemKind.Value, detail: 'Null reference', documentation: 'Null reference value.' },
    { name: 'Me', kind: CompletionItemKind.Value, detail: 'Current instance', documentation: 'Reference to current class instance.' },
    { name: 'MyBase', kind: CompletionItemKind.Value, detail: 'Base class', documentation: 'Reference to base class.' },
    { name: 'MyClass', kind: CompletionItemKind.Value, detail: 'Current class', documentation: 'Reference to current class implementation.' }
  ];

  workspaceIndex.symbols.set('keywords', vbKeywords);
  workspaceIndex.symbols.set('types', vbTypes);
  workspaceIndex.symbols.set('commonTypes', commonTypes);
  workspaceIndex.symbols.set('literals', literals);
  
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
        // Skip common directories that don't contain source code
        if (!entry.name.startsWith('.') && 
            entry.name !== 'node_modules' && 
            entry.name !== 'bin' && 
            entry.name !== 'obj' &&
            entry.name !== 'packages') {
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

    // Parse Class declarations
    const classMatch = line.match(/^\s*(Public|Private|Protected|Friend)?\s*(MustInherit|NotInheritable)?\s*Class\s+(\w+)/i);
    if (classMatch) {
      symbols.push({
        name: classMatch[3],
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

    // Parse Module declarations
    const moduleMatch = line.match(/^\s*(Public|Private|Protected|Friend)?\s*Module\s+(\w+)/i);
    if (moduleMatch) {
      symbols.push({
        name: moduleMatch[2],
        kind: CompletionItemKind.Module,
        detail: 'Module',
        accessibility: moduleMatch[1] || 'Public',
        location: {
          uri: uri,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length }
          }
        }
      });
    }

    // Parse Structure declarations
    const structMatch = line.match(/^\s*(Public|Private|Protected|Friend)?\s*Structure\s+(\w+)/i);
    if (structMatch) {
      symbols.push({
        name: structMatch[2],
        kind: CompletionItemKind.Struct,
        detail: 'Structure',
        accessibility: structMatch[1] || 'Public',
        location: {
          uri: uri,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length }
          }
        }
      });
    }

    // Parse Function declarations
    const funcMatch = line.match(/^\s*(Public|Private|Protected|Friend|Shared)?\s*(Overrides|Overloads|MustOverride)?\s*Function\s+(\w+)\s*\(([^)]*)\)(?:\s+As\s+(\w+))?/i);
    if (funcMatch) {
      const params = funcMatch[4] ? funcMatch[4].split(',').map(p => p.trim()).filter(p => p) : [];
      symbols.push({
        name: funcMatch[3],
        kind: CompletionItemKind.Function,
        detail: 'Function',
        accessibility: funcMatch[1] || 'Public',
        parameters: params,
        returnType: funcMatch[5] || 'Object',
        location: {
          uri: uri,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length }
          }
        }
      });
    }

    // Parse Sub declarations
    const subMatch = line.match(/^\s*(Public|Private|Protected|Friend|Shared)?\s*(Overrides|Overloads|MustOverride)?\s*Sub\s+(\w+)\s*\(([^)]*)\)/i);
    if (subMatch) {
      const params = subMatch[4] ? subMatch[4].split(',').map(p => p.trim()).filter(p => p) : [];
      symbols.push({
        name: subMatch[3],
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

    // Parse Property declarations
    const propMatch = line.match(/^\s*(Public|Private|Protected|Friend)?\s*(ReadOnly|WriteOnly)?\s*Property\s+(\w+)\s*(?:\(([^)]*)\))?\s*(?:As\s+(\w+))?/i);
    if (propMatch) {
      symbols.push({
        name: propMatch[3],
        kind: CompletionItemKind.Property,
        detail: 'Property',
        accessibility: propMatch[1] || 'Public',
        type: propMatch[5] || 'Object',
        location: {
          uri: uri,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length }
          }
        }
      });
    }

    // Parse Dim declarations
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

    // Parse Const declarations
    const constMatch = line.match(/^\s*(Public|Private|Protected|Friend)?\s*Const\s+(\w+)(?:\s+As\s+(\w+))?\s*=/i);
    if (constMatch) {
      symbols.push({
        name: constMatch[2],
        kind: CompletionItemKind.Constant,
        detail: 'Constant',
        accessibility: constMatch[1] || 'Private',
        type: constMatch[3] || 'Object',
        location: {
          uri: uri,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length }
          }
        }
      });
    }

    // Parse Enum declarations
    const enumMatch = line.match(/^\s*(Public|Private|Protected|Friend)?\s*Enum\s+(\w+)/i);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[2],
        kind: CompletionItemKind.Enum,
        detail: 'Enumeration',
        accessibility: enumMatch[1] || 'Public',
        location: {
          uri: uri,
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: line.length }
          }
        }
      });
    }

    // Parse Interface declarations
    const interfaceMatch = line.match(/^\s*(Public|Private|Protected|Friend)?\s*Interface\s+(\w+)/i);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[2],
        kind: CompletionItemKind.Interface,
        detail: 'Interface',
        accessibility: interfaceMatch[1] || 'Public',
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

    const text = document.getText();
    const position = textDocumentPosition.position;
    const lineText = text.split('\n')[position.line];
    const currentWord = getCurrentWord(lineText, position.character);

    const completionItems: CompletionItem[] = [];

    // Check for member access (dot notation)
    const beforeDot = lineText.substring(0, position.character).match(/(\w+)\.(\w*)$/);
    if (beforeDot) {
      const objectName = beforeDot[1];
      const memberPrefix = beforeDot[2] || '';
      
      // Find the type of the object and provide member completions
      const objectSymbol = findSymbol(objectName, document.uri);
      if (objectSymbol && objectSymbol.type) {
        const members = getTypeMembers(objectSymbol.type);
        return members.map(member => ({
          label: member.name,
          kind: member.kind as CompletionItemKind,
          detail: member.detail,
          documentation: member.documentation,
          insertText: member.name
        }));
      }
    }

    // Add workspace symbols
    workspaceIndex.symbols.forEach((symbols) => {
      symbols.forEach(symbol => {
        completionItems.push({
          label: symbol.name,
          kind: symbol.kind as CompletionItemKind,
          detail: symbol.detail,
          documentation: symbol.documentation,
          insertText: symbol.name
        });
      });
    });

    // Add symbols from all indexed files
    workspaceIndex.fileSymbols.forEach((symbols) => {
      symbols.forEach(symbol => {
        const existing = completionItems.find(item => item.label === symbol.name);
        if (!existing) {
          completionItems.push({
            label: symbol.name,
            kind: symbol.kind as CompletionItemKind,
            detail: symbol.detail,
            documentation: symbol.documentation,
            insertText: symbol.name
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

    // Search in workspace symbols
    for (const [category, symbols] of workspaceIndex.symbols) {
      const symbol = symbols.find(s => s.name.toLowerCase() === word.toLowerCase());
      if (symbol) {
        let content = `**${symbol.name}**`;
        const kindName = symbol.kind === CompletionItemKind.Keyword ? 'Keyword' : 'Type';
        content += ` (${kindName})`;
        content += `\n\n${symbol.detail}`;
        if (symbol.documentation) {
          content += `\n\n${symbol.documentation}`;
        }
        return {
          contents: {
            kind: 'markdown',
            value: content
          }
        };
      }
    }

    // Search in file symbols
    const symbol = findSymbol(word, document.uri);
    if (symbol) {
      let content = `**${symbol.name}**`;
      if (symbol.accessibility) {
        content += ` (${symbol.accessibility})`;
      }
      content += `\n\n${symbol.detail}`;
      
      if (symbol.parameters && symbol.parameters.length > 0) {
        content += `\n\n**Parameters:** ${symbol.parameters.join(', ')}`;
      }
      
      if (symbol.returnType) {
        content += `\n\n**Returns:** ${symbol.returnType}`;
      }
      
      if (symbol.type) {
        content += `\n\n**Type:** ${symbol.type}`;
      }
      
      if (symbol.documentation) {
        content += `\n\n---\n\n${symbol.documentation}`;
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

    const position = params.position;
    const text = document.getText();
    const lineText = text.split('\n')[position.line];
    const word = getWordAtPosition(lineText, position.character);

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

    // Search for references in all indexed files
    workspaceIndex.fileSymbols.forEach((symbols, uri) => {
      const doc = documents.get(uri);
      const fileContent = doc ? doc.getText() : (uri.startsWith('file://') ? 
        (() => { try { return fs.readFileSync(uri.replace('file://', ''), 'utf-8'); } catch { return ''; } })() : '');
      
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

connection.onDocumentSymbol(
  (params: DocumentSymbolParams): SymbolInformation[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }

    const symbols = workspaceIndex.fileSymbols.get(document.uri) || [];
    return symbols.map(symbol => ({
      name: symbol.name,
      kind: convertCompletionKindToSymbolKind(symbol.kind),
      location: symbol.location || {
        uri: document.uri,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
      }
    }));
  }
);

connection.onWorkspaceSymbol(
  (params: WorkspaceSymbolParams): SymbolInformation[] => {
    const query = params.query.toLowerCase();
    const results: SymbolInformation[] = [];

    workspaceIndex.fileSymbols.forEach((symbols, uri) => {
      symbols.forEach(symbol => {
        if (symbol.name.toLowerCase().includes(query)) {
          results.push({
            name: symbol.name,
            kind: convertCompletionKindToSymbolKind(symbol.kind),
            location: symbol.location || {
              uri: uri,
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }
            }
          });
        }
      });
    });

    return results.slice(0, 50); // Limit results
  }
);

function convertCompletionKindToSymbolKind(kind: CompletionItemKind | SymbolKind): SymbolKind {
  if (typeof kind === 'number' && kind >= 1 && kind <= 26) {
    return kind as SymbolKind;
  }
  return SymbolKind.Variable;
}

documents.onDidChangeContent(change => {
  const uri = change.document.uri;
  const text = change.document.getText();
  
  // Re-index the changed file
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

    // Variable without type
    if (line.match(/^\s*Dim\s+\w+\s*$/i)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: 0 },
          end: { line: i, character: lines[i].length }
        },
        message: 'Variable declared without explicit type. Consider adding "As Type" for better type safety.',
        source: 'vb-lsp',
        code: 'VB001'
      });
    }

    // Function without return type
    if (line.match(/^\s*(Public|Private|Protected|Friend)?\s*Function\s+\w+\s*\(/i) && !line.includes(' As ')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: 0 },
          end: { line: i, character: lines[i].length }
        },
        message: 'Function declared without explicit return type. Consider adding "As Type".',
        source: 'vb-lsp',
        code: 'VB002'
      });
    }

    // Parameter without type
    const paramMatch = line.match(/\(([^)]+)\)/);
    if (paramMatch) {
      const params = paramMatch[1].split(',');
      for (const param of params) {
        if (param.trim() && !param.includes(' As ') && !param.includes('Optional')) {
          const paramStart = lines[i].indexOf(param.trim());
          if (paramStart !== -1) {
            diagnostics.push({
              severity: DiagnosticSeverity.Warning,
              range: {
                start: { line: i, character: paramStart },
                end: { line: i, character: paramStart + param.trim().length }
              },
              message: 'Parameter declared without explicit type.',
              source: 'vb-lsp',
              code: 'VB003'
            });
          }
        }
      }
    }

    // Unused variable detection (simplified)
    const dimMatch = line.match(/^\s*Dim\s+(\w+)/i);
    if (dimMatch) {
      const varName = dimMatch[1];
      const usageCount = text.split('\n').filter((l, idx) => idx !== i && l.includes(varName)).length;
      if (usageCount === 0) {
        const varStart = lines[i].indexOf(varName);
        diagnostics.push({
          severity: DiagnosticSeverity.Hint,
          range: {
            start: { line: i, character: varStart },
            end: { line: i, character: varStart + varName.length }
          },
          message: `Variable '${varName}' is declared but never used.`,
          source: 'vb-lsp',
          code: 'VB004'
        });
      }
    }

    // Check for proper End statements
    if (line.match(/^\s*(Class|Module|Structure|Function|Sub|Property|With|Select|Namespace)\s/i)) {
      const keyword = line.match(/^\s*(Class|Module|Structure|Function|Sub|Property|With|Select|Namespace)/i)?.[1];
      if (keyword) {
        const endPattern = new RegExp(`^\\s*End\\s+${keyword}`, 'i');
        const hasEnd = lines.slice(i + 1).some(l => endPattern.test(l));
        if (!hasEnd) {
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: i, character: 0 },
              end: { line: i, character: lines[i].length }
            },
            message: `Missing 'End ${keyword}' statement.`,
            source: 'vb-lsp',
            code: 'VB005'
          });
        }
      }
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

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

function findSymbol(name: string, currentUri: string): ProjectSymbol | undefined {
  const lowerName = name.toLowerCase();

  // Search in current file first
  const currentFileSymbols = workspaceIndex.fileSymbols.get(currentUri) || [];
  let symbol = currentFileSymbols.find(s => s.name.toLowerCase() === lowerName);
  if (symbol) return symbol;

  // Search in all indexed files
  for (const [uri, symbols] of workspaceIndex.fileSymbols) {
    symbol = symbols.find(s => s.name.toLowerCase() === lowerName);
    if (symbol) return symbol;
  }

  // Search in workspace symbols
  for (const [category, symbols] of workspaceIndex.symbols) {
    symbol = symbols.find(s => s.name.toLowerCase() === lowerName);
    if (symbol) return symbol;
  }

  return undefined;
}

function getTypeMembers(typeName: string): ProjectSymbol[] {
  const members: ProjectSymbol[] = [];

  // Common String members
  if (typeName.toLowerCase() === 'string') {
    members.push(
      { name: 'Length', kind: CompletionItemKind.Property, detail: 'Integer', documentation: 'Gets the number of characters in the string.' },
      { name: 'ToUpper', kind: CompletionItemKind.Method, detail: 'Function() As String', documentation: 'Returns a copy of this string converted to uppercase.' },
      { name: 'ToLower', kind: CompletionItemKind.Method, detail: 'Function() As String', documentation: 'Returns a copy of this string converted to lowercase.' },
      { name: 'Substring', kind: CompletionItemKind.Method, detail: 'Function(startIndex As Integer) As String', documentation: 'Retrieves a substring from this instance.' },
      { name: 'IndexOf', kind: CompletionItemKind.Method, detail: 'Function(value As String) As Integer', documentation: 'Reports the zero-based index of the first occurrence of a specified string.' },
      { name: 'Replace', kind: CompletionItemKind.Method, detail: 'Function(oldValue As String, newValue As String) As String', documentation: 'Returns a new string with all occurrences of oldValue replaced with newValue.' },
      { name: 'Trim', kind: CompletionItemKind.Method, detail: 'Function() As String', documentation: 'Removes all leading and trailing white-space characters.' },
      { name: 'Split', kind: CompletionItemKind.Method, detail: 'Function(separator As Char()) As String()', documentation: 'Splits a string into substrings.' },
      { name: 'Contains', kind: CompletionItemKind.Method, detail: 'Function(value As String) As Boolean', documentation: 'Returns a value indicating whether a specified substring occurs within this string.' },
      { name: 'StartsWith', kind: CompletionItemKind.Method, detail: 'Function(value As String) As Boolean', documentation: 'Determines whether the beginning of this string matches the specified string.' },
      { name: 'EndsWith', kind: CompletionItemKind.Method, detail: 'Function(value As String) As Boolean', documentation: 'Determines whether the end of this string matches the specified string.' }
    );
  }

  // Common Integer/Long members
  if (typeName.toLowerCase() === 'integer' || typeName.toLowerCase() === 'long') {
    members.push(
      { name: 'ToString', kind: CompletionItemKind.Method, detail: 'Function() As String', documentation: 'Converts the numeric value to its equivalent string representation.' },
      { name: 'CompareTo', kind: CompletionItemKind.Method, detail: 'Function(value As Integer) As Integer', documentation: 'Compares this instance to a specified object.' },
      { name: 'Equals', kind: CompletionItemKind.Method, detail: 'Function(obj As Object) As Boolean', documentation: 'Returns a value indicating whether this instance is equal to a specified object.' }
    );
  }

  // Common Double/Single members
  if (typeName.toLowerCase() === 'double' || typeName.toLowerCase() === 'single') {
    members.push(
      { name: 'ToString', kind: CompletionItemKind.Method, detail: 'Function() As String', documentation: 'Converts the numeric value to its equivalent string representation.' },
      { name: 'CompareTo', kind: CompletionItemKind.Method, detail: 'Function(value As Double) As Integer', documentation: 'Compares this instance to a specified object.' }
    );
  }

  return members;
}

// Listen on documents and connection
documents.listen(connection);
connection.listen();

connection.console.log('Enhanced Visual Basic Language Server is running');
