import { useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface ScriptEditorProps {
    value: string;
    onChange: (value: string) => void;
    height?: string;
}

export function ScriptEditor({ value, onChange, height = '400px' }: ScriptEditorProps) {
    const editorRef = useRef<any>(null);

    const handleEditorDidMount = (editor: any, monacoInstance: typeof monaco) => {
        editorRef.current = editor;

        // Register custom language for the game DSL
        monacoInstance.languages.register({ id: 'gamescript' });

        // Define tokens (syntax highlighting rules)
        monacoInstance.languages.setMonarchTokensProvider('gamescript', {
            defaultToken: '',
            tokenPostfix: '.gs',

            // Keywords (triggers)
            triggers: [
                'ACTIVATE', 'ATTACK', 'TICK', 'EQUIP', 'UNEQUIP',
                'ON_DEATH', 'ON_HIT', 'ON_CRITICAL', 'ON_KILL',
                'FIRE_STORM', 'ICE_BLAST', 'LIGHTNING_STRIKE'
            ],

            // Functions
            functions: [
                'damage_target', 'heal_target', 'effect', 'add_stat',
                'chance', 'set_element', 'spawn_projectile', 'apply_buff',
                'remove_buff', 'teleport', 'knockback'
            ],

            // Variables
            variables: ['$_self', '$_target', '@$_self', '@$_target'],

            // Elements
            elements: ['fire', 'ice', 'lightning', 'poison', 'holy', 'dark'],

            // Stats
            stats: [
                'hp', 'energy', 'attack', 'defense', 'speed',
                'luck', 'crit_chance', 'crit_damage', 'armor'
            ],

            tokenizer: {
                root: [
                    // Comments
                    [/#.*$/, 'comment'],

                    // Triggers (keywords)
                    [/[A-Z_]+/, {
                        cases: {
                            '@triggers': 'keyword',
                            '@default': 'identifier'
                        }
                    }],

                    // Functions
                    [/[a-z_]+/, {
                        cases: {
                            '@functions': 'type',
                            '@elements': 'string',
                            '@stats': 'variable',
                            '@default': 'identifier'
                        }
                    }],

                    // Variables
                    [/[@$][a-z_]+/, {
                        cases: {
                            '@variables': 'variable.predefined',
                            '@default': 'variable'
                        }
                    }],

                    // Numbers
                    [/\d+/, 'number'],

                    // Delimiters
                    [/[;,]/, 'delimiter'],

                    // Whitespace
                    [/\s+/, 'white']
                ]
            }
        });

        // Define the theme
        monacoInstance.editor.defineTheme('gamescript-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
                { token: 'type', foreground: '4EC9B0' },
                { token: 'variable.predefined', foreground: '9CDCFE' },
                { token: 'variable', foreground: '9CDCFE' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'number', foreground: 'B5CEA8' },
                { token: 'delimiter', foreground: 'D4D4D4' }
            ],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.foreground': '#D4D4D4',
                'editorLineNumber.foreground': '#858585',
                'editorCursor.foreground': '#AEAFAD',
                'editor.selectionBackground': '#264F78',
                'editor.inactiveSelectionBackground': '#3A3D41'
            }
        });

        // Set up autocomplete
        monacoInstance.languages.registerCompletionItemProvider('gamescript', {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const suggestions: any[] = [];

                // Trigger suggestions
                const triggers = [
                    'ACTIVATE', 'ATTACK', 'TICK', 'EQUIP', 'UNEQUIP',
                    'ON_DEATH', 'ON_HIT', 'ON_CRITICAL', 'ON_KILL'
                ];
                triggers.forEach(trigger => {
                    suggestions.push({
                        label: trigger,
                        kind: monacoInstance.languages.CompletionItemKind.Keyword,
                        insertText: trigger,
                        documentation: `Trigger: ${trigger}`,
                        range
                    });
                });

                // Function suggestions with snippets
                const functions = [
                    { name: 'damage_target', snippet: 'damage_target ${1:amount},${2:$_target};', doc: 'Deals damage to the target' },
                    { name: 'heal_target', snippet: 'heal_target ${1:amount},${2:$_target};', doc: 'Heals the target' },
                    { name: 'effect', snippet: 'effect ${1:effectId},${2:@$_target},${3:duration};', doc: 'Spawns a visual effect' },
                    { name: 'add_stat', snippet: 'add_stat ${1:statName},${2:value},${3:$_self};', doc: 'Modifies a stat' },
                    { name: 'chance', snippet: 'chance ${1:percent},${2:function},${3:args};', doc: 'Random chance to execute function' },
                    { name: 'set_element', snippet: 'set_element ${1:element},${2:$_target};', doc: 'Sets attack element' }
                ];
                functions.forEach(fn => {
                    suggestions.push({
                        label: fn.name,
                        kind: monacoInstance.languages.CompletionItemKind.Function,
                        insertText: fn.snippet,
                        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: fn.doc,
                        range
                    });
                });

                // Variable suggestions
                const variables = [
                    { name: '$_self', doc: 'The entity executing the script' },
                    { name: '$_target', doc: 'The current target entity' },
                    { name: '@$_self', doc: 'Position of the executing entity' },
                    { name: '@$_target', doc: 'Position of the target entity' }
                ];
                variables.forEach(v => {
                    suggestions.push({
                        label: v.name,
                        kind: monacoInstance.languages.CompletionItemKind.Variable,
                        insertText: v.name,
                        documentation: v.doc,
                        range
                    });
                });

                return { suggestions };
            }
        });

        // Set the theme
        monacoInstance.editor.setTheme('gamescript-dark');
    };

    const handleEditorChange = (value: string | undefined) => {
        onChange(value || '');
    };

    return (
        <div style={{
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            overflow: 'hidden'
        }}>
            <Editor
                height={height}
                defaultLanguage="gamescript"
                value={value}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: true,
                    autoClosingBrackets: 'always',
                    autoClosingQuotes: 'always',
                    formatOnPaste: true,
                    formatOnType: true
                }}
            />
        </div>
    );
}
