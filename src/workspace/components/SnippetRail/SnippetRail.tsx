import { useState, type FormEvent } from 'react';

import { DEFAULT_SNIPPET_FOLDER, type Snippet } from '../../../domain/snippets';
import { toEditorState, type EditorState } from '../../editor-state';

import styles from './SnippetRail.module.scss';

const COLLAPSED_FOLDERS_STORAGE_KEY = 'tampr.workspace.collapsedFolders';

type SnippetRailProps = {
  editor: EditorState;
  snippets: readonly Snippet[];
  onCreate(): void;
  onDeleteFolder(folder: string): void;
  onRenameFolder(folder: string, nextFolder: string): void;
  onSelect(editor: EditorState): void;
};

export function SnippetRail({
  editor,
  snippets,
  onCreate,
  onDeleteFolder,
  onRenameFolder,
  onSelect,
}: SnippetRailProps) {
  const [collapsedFolders, setCollapsedFolders] =
    useState<ReadonlySet<string>>(readCollapsedFolders);
  const [managedFolder, setManagedFolder] = useState<string>();
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<string>();
  const [editingFolder, setEditingFolder] = useState<{
    folder: string;
    value: string;
  }>();
  const [query, setQuery] = useState('');
  const visibleSnippets = filterSnippets(snippets, query);
  const folderGroups = groupSnippetsByFolder(visibleSnippets);
  const searching = query.trim().length > 0;

  function toggleFolder(folder: string): void {
    setCollapsedFolders((folders) => {
      const nextFolders = new Set(folders);

      if (nextFolders.has(folder)) {
        nextFolders.delete(folder);
      } else {
        nextFolders.add(folder);
      }

      writeCollapsedFolders(nextFolders);
      return nextFolders;
    });
  }

  function toggleFolderMenu(folder: string): void {
    setEditingFolder(undefined);
    setPendingDeleteFolder(undefined);
    setManagedFolder((currentFolder) =>
      currentFolder === folder ? undefined : folder,
    );
  }

  function startFolderRename(folder: string): void {
    setManagedFolder(undefined);
    setPendingDeleteFolder(undefined);
    setEditingFolder({ folder, value: folder });
  }

  function submitFolderRename(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!editingFolder) {
      return;
    }

    const nextFolder = editingFolder.value.trim();

    if (!nextFolder) {
      return;
    }

    if (nextFolder === editingFolder.folder) {
      setEditingFolder(undefined);
      return;
    }

    onRenameFolder(editingFolder.folder, nextFolder);
    setEditingFolder(undefined);
  }

  function startFolderDelete(folder: string): void {
    if (folder === DEFAULT_SNIPPET_FOLDER) {
      return;
    }

    setManagedFolder(undefined);
    setEditingFolder(undefined);
    setPendingDeleteFolder(folder);
  }

  function confirmFolderDelete(folder: string): void {
    onDeleteFolder(folder);
    setPendingDeleteFolder(undefined);
  }

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
        {folderGroups.map((group) => {
          const expanded = searching || !collapsedFolders.has(group.folder);

          return (
            <section
              aria-label={`${group.folder} snippets`}
              className={styles.group}
              key={group.folder}
            >
              <div className={styles.groupHeader}>
                <button
                  aria-expanded={expanded}
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${
                    group.folder
                  } folder`}
                  className={styles.folderToggle}
                  type="button"
                  onClick={() => toggleFolder(group.folder)}
                >
                  <span className={styles.chevron} aria-hidden="true" />
                  <span className={styles.folderName}>{group.folder}</span>
                  <span className={styles.count} aria-hidden="true">
                    {group.snippets.length}
                  </span>
                </button>

                <button
                  aria-expanded={managedFolder === group.folder}
                  aria-label={`Manage ${group.folder} folder`}
                  className={styles.menuButton}
                  title={`Manage ${group.folder} folder`}
                  type="button"
                  onClick={() => toggleFolderMenu(group.folder)}
                >
                  ...
                </button>
              </div>

              {managedFolder === group.folder ? (
                <div className={styles.folderMenu}>
                  <button
                    aria-label={`Rename ${group.folder} folder`}
                    className={styles.manageButton}
                    type="button"
                    onClick={() => startFolderRename(group.folder)}
                  >
                    Rename
                  </button>
                  {group.folder !== DEFAULT_SNIPPET_FOLDER ? (
                    <button
                      aria-label={`Delete ${group.folder} folder`}
                      className={`${styles.manageButton} ${styles.dangerButton}`}
                      type="button"
                      onClick={() => startFolderDelete(group.folder)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}

              {editingFolder?.folder === group.folder ? (
                <form
                  className={styles.folderForm}
                  onSubmit={submitFolderRename}
                >
                  <input
                    aria-label={`Folder name for ${group.folder}`}
                    maxLength={80}
                    required
                    value={editingFolder.value}
                    onChange={(event) =>
                      setEditingFolder({
                        ...editingFolder,
                        value: event.target.value,
                      })
                    }
                  />
                  <button type="submit">Save folder</button>
                  <button
                    type="button"
                    onClick={() => setEditingFolder(undefined)}
                  >
                    Cancel
                  </button>
                </form>
              ) : null}

              {pendingDeleteFolder === group.folder ? (
                <div className={styles.folderDelete}>
                  <span>
                    Move {group.snippets.length}{' '}
                    {group.snippets.length === 1 ? 'snippet' : 'snippets'} to{' '}
                    {DEFAULT_SNIPPET_FOLDER}.
                  </span>
                  <button
                    type="button"
                    onClick={() => confirmFolderDelete(group.folder)}
                  >
                    Move snippets to {DEFAULT_SNIPPET_FOLDER}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteFolder(undefined)}
                  >
                    Cancel
                  </button>
                </div>
              ) : null}

              {expanded ? (
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
              ) : null}
            </section>
          );
        })}
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

function readCollapsedFolders(): ReadonlySet<string> {
  try {
    const storedFolders = window.localStorage.getItem(
      COLLAPSED_FOLDERS_STORAGE_KEY,
    );

    if (!storedFolders) {
      return new Set();
    }

    const parsedFolders = JSON.parse(storedFolders) as unknown;

    if (!Array.isArray(parsedFolders)) {
      return new Set();
    }

    return new Set(
      parsedFolders.filter(
        (folder): folder is string =>
          typeof folder === 'string' && folder.trim().length > 0,
      ),
    );
  } catch {
    return new Set();
  }
}

function writeCollapsedFolders(folders: ReadonlySet<string>): void {
  try {
    if (folders.size === 0) {
      window.localStorage.removeItem(COLLAPSED_FOLDERS_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      COLLAPSED_FOLDERS_STORAGE_KEY,
      JSON.stringify([...folders]),
    );
  } catch {
    // Folder collapse state is a convenience, so storage failures stay silent.
  }
}
