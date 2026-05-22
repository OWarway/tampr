// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceState } from '../../../shared/workspace-messages';
import { WorkspaceHeader } from './WorkspaceHeader';

afterEach(cleanup);

describe('WorkspaceHeader', () => {
  it('shows runtime registration status', () => {
    render(<WorkspaceHeader workspace={createWorkspaceState()} />);

    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeTruthy();
    expect(screen.getByText('2 registrations')).toBeTruthy();
  });
});

function createWorkspaceState(): WorkspaceState {
  return {
    snippets: [],
    runtime: {
      state: 'ready',
      registrations: 2,
      skipped: [],
      errors: [],
    },
  };
}
