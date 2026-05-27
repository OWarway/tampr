// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceState } from '../../../shared/workspace-messages';
import { RuntimeSetup } from './RuntimeSetup';

afterEach(cleanup);

describe('RuntimeSetup', () => {
  it('prompts unavailable User Scripts setup', () => {
    const openExtensionDetails = vi.fn();

    render(
      <RuntimeSetup
        workspace={workspaceState('user-scripts-unavailable')}
        onOpenExtensionDetails={openExtensionDetails}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Enable User Scripts' }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Open extension details' }),
    );

    expect(openExtensionDetails).toHaveBeenCalledTimes(1);
  });

  it('stays hidden once the runtime is ready', () => {
    const { container } = render(
      <RuntimeSetup
        workspace={workspaceState('ready')}
        onOpenExtensionDetails={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });
});

function workspaceState(
  state: WorkspaceState['runtime']['state'],
): WorkspaceState {
  return {
    snippets: [],
    runtime: {
      state,
      registrations: 0,
      skipped: [],
      errors: [],
    },
  };
}
