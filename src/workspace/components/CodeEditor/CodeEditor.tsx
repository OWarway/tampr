import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

import styles from './CodeEditor.module.scss';

export type CodeEditorLanguage = 'css' | 'javascript';

const tamprHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.unit],
    color: '#f3bd78',
  },
  {
    tag: [
      tags.atom,
      tags.bool,
      tags.number,
      tags.color,
      tags.definition(tags.variableName),
    ],
    color: '#f29b8f',
  },
  {
    tag: [tags.string, tags.url, tags.regexp, tags.special(tags.string)],
    color: '#9adbb6',
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    color: '#c6d7ff',
  },
  {
    tag: [tags.typeName, tags.className, tags.definition(tags.propertyName)],
    color: '#f2d37a',
  },
  {
    tag: [tags.comment, tags.meta],
    color: '#87a69d',
    fontStyle: 'italic',
  },
  {
    tag: tags.invalid,
    color: '#ff8c85',
    textDecoration: 'underline',
  },
]);

type CodeEditorProps = {
  label: string;
  language: CodeEditorLanguage;
  value: string;
  onChange(value: string): void;
};

export function CodeEditor({
  label,
  language,
  onChange,
  value,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const viewRef = useRef<EditorView>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const view = new EditorView({
      doc: valueRef.current,
      extensions: [
        ...buildExtensions(label, language),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
      parent: host,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [label, language]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();

    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        insert: value,
        to: currentValue.length,
      },
    });
  }, [value]);

  return (
    <div className={styles.shell} data-language={language} ref={hostRef} />
  );
}

function buildExtensions(
  label: string,
  language: CodeEditorLanguage,
): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    EditorState.tabSize.of(2),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(tamprHighlightStyle),
    highlightActiveLine(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      'aria-label': label,
      autocapitalize: 'off',
      autocomplete: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
    }),
    language === 'css' ? css() : javascript(),
  ];
}
