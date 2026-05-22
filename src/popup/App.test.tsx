// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Popup App', () => {
  it('opens the workspace from the popup action', async () => {
    const openOptionsPage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      runtime: { openOptionsPage },
    });

    render(<App />);

    expect(screen.getByText('No snippets active')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));

    await waitFor(() => expect(openOptionsPage).toHaveBeenCalledTimes(1));
  });
});
