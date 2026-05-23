import type { ChangeEvent } from 'react';
import { useRef } from 'react';

import styles from './DataActions.module.scss';

type DataActionsProps = {
  busy: boolean;
  exportDisabled: boolean;
  onExport(): Promise<void> | void;
  onImport(file: File): void;
};

export function DataActions({
  busy,
  exportDisabled,
  onExport,
  onImport,
}: DataActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function chooseImportFile(): void {
    fileInputRef.current?.click();
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (file) {
      onImport(file);
    }
  }

  return (
    <div className={styles.actions} aria-label="Snippet data">
      <button
        className={styles.button}
        disabled={busy || exportDisabled}
        type="button"
        onClick={() => void onExport()}
      >
        Export
      </button>
      <button
        className={styles.button}
        disabled={busy}
        type="button"
        onClick={chooseImportFile}
      >
        Import
      </button>
      <input
        ref={fileInputRef}
        accept="application/json,.json"
        aria-label="Import snippets file"
        className={styles.fileInput}
        type="file"
        onChange={handleImportFile}
      />
    </div>
  );
}
