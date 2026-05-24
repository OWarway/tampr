import { useState } from 'react';

import { DEFAULT_SNIPPET_FOLDER, type Snippet } from '../../../domain/snippets';
import { toEditorState, type EditorState } from '../../editor-state';

import styles from './SnippetRail.module.scss';

type SnippetRailProps = {
  editor: EditorState;
  snippets: readonly Snippet[];
  onCreate(): void;
  onSelect(editor: EditorState): void;
};

export function SnippetRail({
  editor,
  snippets,
  onCreate,
  onSelect,
}: SnippetRailProps) {
  const [query, setQuery] = useState('');
  const visibleSnippets = filterSnippets(snippets, query);
  const folderGroups = groupSnippetsByFolder(visibleSnippets);

  return (
    <aside className={styles.rail} aria-label="Snippets">
      <div className={styles.top}>
        <h2>Snippets</h2>
        <button type="button" onClick={onCreate}>
          New
        </button>
      </div>
      <label className={styles.search}>
        <span>Search</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={styles.groups}>
        {folderGroups.map((group) => (
          <section
            aria-label={`${group.folder} snippets`}
            className={styles.group}
            key={group.folder}
          >
            <h3 aria-label={`${group.folder} ${group.snippets.length}`}>
              <span>{group.folder}</span>
              <span>{group.snippets.length}</span>
            </h3>
            <ol className={styles.list}>
              {group.snippets.map((snippet) => (
                <li key={snippet.id}>
                  <button
                    className={`${styles.item} ${
                      snippet.id === editor.id ? styles.selected : ''
                    }`}
                    type="button"
                    onClick={() => onSelect(toEditorState(snippet))}
                  >
                    <strong>{snippet.name}</strong>
                    <span className={styles.meta}>
                      {snippet.matches[0] ?? 'No match rule'}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {snippets.length === 0 ? (
        <p className={styles.empty}>No snippets yet.</p>
      ) : visibleSnippets.length === 0 ? (
        <p className={styles.empty}>No snippets match.</p>
      ) : null}
    </aside>
  );
}

function filterSnippets(
  snippets: readonly Snippet[],
  query: string,
): readonly Snippet[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return snippets;
  }

  return snippets.filter((snippet) => {
    return [
      snippet.name,
      snippet.folder,
      ...snippet.matches,
      ...snippet.excludeMatches,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

type SnippetFolderGroup = {
  folder: string;
  snippets: Snippet[];
};

function groupSnippetsByFolder(
  snippets: readonly Snippet[],
): SnippetFolderGroup[] {
  const groups = new Map<string, Snippet[]>();

  for (const snippet of snippets) {
    const folder = snippet.folder.trim() || DEFAULT_SNIPPET_FOLDER;
    groups.set(folder, [...(groups.get(folder) ?? []), snippet]);
  }

  return [...groups.entries()]
    .map(([folder, groupSnippets]) => ({
      folder,
      snippets: groupSnippets,
    }))
    .sort((left, right) => compareFolders(left.folder, right.folder));
}

function compareFolders(left: string, right: string): number {
  if (left === DEFAULT_SNIPPET_FOLDER) {
    return right === DEFAULT_SNIPPET_FOLDER ? 0 : -1;
  }

  if (right === DEFAULT_SNIPPET_FOLDER) {
    return 1;
  }

  return left.localeCompare(right);
}
