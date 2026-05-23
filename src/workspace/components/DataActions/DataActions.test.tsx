// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataActions } from './DataActions';

afterEach(cleanup);

describe('DataActions', () => {
  it('runs the export action from the toolbar', () => {
    const onExport = vi.fn();

    render(
      <DataActions
        busy={false}
        exportDisabled={false}
        onExport={onExport}
        onImport={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('passes the selected import file to the caller', () => {
    const onImport = vi.fn();
    const file = new File(['{}'], 'tampr-snippets.json', {
      type: 'application/json',
    });

    render(
      <DataActions
        busy={false}
        exportDisabled={false}
        onExport={vi.fn()}
        onImport={onImport}
      />,
    );

    fireEvent.change(screen.getByLabelText('Import snippets file'), {
      target: { files: [file] },
    });

    expect(onImport).toHaveBeenCalledWith(file);
  });

  it('disables data actions while the workspace is busy', () => {
    render(
      <DataActions
        busy={true}
        exportDisabled={false}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'Export' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Import' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
