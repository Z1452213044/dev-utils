import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { tags as t } from '@lezer/highlight';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { cpp } from '@codemirror/lang-cpp';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import type { Extension } from '@codemirror/state';
import { fileExtension } from '../utils/clipboard';

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword, t.moduleKeyword], class: 'tok-keyword' },
  { tag: [t.string, t.special(t.string), t.regexp], class: 'tok-string' },
  { tag: [t.number, t.integer, t.float], class: 'tok-number' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], class: 'tok-comment' },
  { tag: [t.propertyName, t.attributeName, t.attributeValue], class: 'tok-property' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], class: 'tok-fn' },
  { tag: t.operator, class: 'tok-operator' },
  { tag: [t.bool, t.null, t.atom], class: 'tok-atom' },
  { tag: [t.tagName, t.standard(t.tagName)], class: 'tok-tag' },
  { tag: [t.typeName, t.namespace, t.className], class: 'tok-type' },
  { tag: t.escape, class: 'tok-escape' },
  { tag: [t.definition(t.variableName), t.variableName], class: '' },
]);

export const languageCompartment = new Compartment();
export const wrapCompartment = new Compartment();
export const tabCompartment = new Compartment();

/** 手动语法高亮可选语言（「更多选项」下拉）。 */
export const HIGHLIGHT_LANGUAGES: { value: string; label: string }[] = [
  { value: 'auto', label: '自动检测' },
  { value: 'none', label: '纯文本' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'cpp', label: 'C / C++' },
  { value: 'go', label: 'Go' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
];

export function languageById(id: string): Extension {
  switch (id) {
    case 'json':
      return json();
    case 'markdown':
      return markdown();
    case 'cpp':
    case 'go':
      return cpp();
    case 'python':
      return python();
    case 'javascript':
      return javascript();
    case 'typescript':
      return javascript({ typescript: true });
    case 'java':
      return java();
    case 'xml':
      return xml();
    case 'yaml':
      return yaml();
    case 'none':
    case 'auto':
      return [];
    default:
      return [];
  }
}

export function languageFor(filename: string | null, text?: string): Extension {
  const ext = filename ? fileExtension(filename) : '';
  switch (ext) {
    case 'json':
      return json();
    case 'md':
      return markdown();
    case 'cpp':
    case 'cc':
    case 'c':
    case 'h':
    case 'hpp':
      return cpp();
    case 'go':
      return cpp(); // decent C-family highlight for Go without another package
    case 'py':
      return python();
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
      return javascript({ typescript: ext === 'ts' || ext === 'tsx', jsx: ext === 'tsx' || ext === 'jsx' });
    case 'java':
      return java();
    case 'xml':
      return xml();
    case 'yaml':
    case 'yml':
      return yaml();
    case 'proto':
    case 'conf':
    case 'ini':
    case 'csv':
    case 'log':
    case 'txt':
      return [];
  }
  if (!filename && text) {
    const trimmed = text.slice(0, 64).trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return json();
  }
  return [];
}

export interface EditorOptions {
  doc?: string;
  language?: Extension;
  readOnly?: boolean;
  wordWrap?: boolean;
  tabSize?: number;
  onChange?: (text: string) => void;
  parent: HTMLElement;
  /** Additional extensions (e.g. diff decoration fields). */
  extra?: Extension[];
}

export interface EditorHandle {
  view: EditorView;
  setDoc: (text: string) => void;
  setLanguage: (lang: Extension) => void;
  setWordWrap: (on: boolean) => void;
  setTabSize: (size: number) => void;
}

export function createEditor(options: EditorOptions): EditorHandle {
  const { parent } = options;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && options.onChange) {
      options.onChange(update.state.doc.toString());
    }
  });

  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(highlightStyle),
    bracketMatching(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    rectangularSelection(),
    crosshairCursor(),
    search({ top: true }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    languageCompartment.of(options.language ?? []),
    wrapCompartment.of(options.wordWrap ? EditorView.lineWrapping : []),
    tabCompartment.of(EditorState.tabSize.of(options.tabSize ?? 4)),
    EditorState.readOnly.of(options.readOnly ?? false),
    EditorView.editorAttributes.of({ spellcheck: 'false' }),
  ];

  if (options.onChange) extensions.push(updateListener);
  if (options.extra) extensions.push(...options.extra);

  const view = new EditorView({
    state: EditorState.create({ doc: options.doc ?? '', extensions }),
    parent,
  });

  return {
    view,
    setDoc(text: string) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: 0 },
        scrollIntoView: true,
      });
    },
    setLanguage(lang: Extension) {
      view.dispatch({ effects: languageCompartment.reconfigure(lang ?? []) });
    },
    setWordWrap(on: boolean) {
      view.dispatch({ effects: wrapCompartment.reconfigure(on ? EditorView.lineWrapping : []) });
    },
    setTabSize(size: number) {
      view.dispatch({ effects: tabCompartment.reconfigure(EditorState.tabSize.of(size)) });
    },
  };
}
