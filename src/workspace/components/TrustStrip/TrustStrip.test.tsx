// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { WorkspaceState } from '../../../shared/workspace-messages';
import { TrustStrip } from './TrustStrip';

afterEach(cleanup);

describe('TrustStrip', () => {
  it('summarizes local data, runtime, and host access state', () => {
    render(<TrustStrip workspace={createWorkspaceState()} />);

    expect(screen.getByText('2 local snippets')).toBeTruthy();
    expect(screen.getByText('1 registration')).toBeTruthy();
    expect(screen.getByText('1 needs access')).toBeTruthy();
  });

  it('shows loading trust state before workspace data arrives', () => {
    render(<TrustStrip workspace={undefined} />);

    expect(screen.getByText('Loading')).toBeTruthy();
    expect(screen.getByText('Checking')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});

function createWorkspaceState(): WorkspaceState {
  return {
    snippets: [
      {
        id: 'snippet-1',
        name: 'One',
        enabled: true,
        matches: ['*://example.com/*'],
        excludeMatches: [],
        css: '',
        js: '',
        runAt: 'document_idle',
        world: 'USER_SCRIPT',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'snippet-2',
        name: 'Two',
        enabled: true,
        matches: ['*://docs.example.com/*'],
        excludeMatches: [],
        css: '',
        js: '',
        runAt: 'document_idle',
        world: 'USER_SCRIPT',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    runtime: {
      state: 'ready',
      registrations: 1,
      skipped: [{ snippetId: 'snippet-2', reason: 'host-access' }],
      errors: [],
    },
  };
}
