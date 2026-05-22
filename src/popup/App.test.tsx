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
  it('opens the workspace with active page context from the popup action', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const openOptionsPage = vi.fn().mockResolvedValue(undefined);
    const query = vi.fn().mockResolvedValue([
      {
        url: 'https://docs.example.com/snippets/new?token=private#draft',
      },
    ]);

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://tampr/${path}`,
        openOptionsPage,
      },
      tabs: { create, query },
    });

    render(<App />);

    expect(screen.getByText('No snippets active')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        url: 'chrome-extension://tampr/workspace.html?sourcePage=https%3A%2F%2Fdocs.example.com%2Fsnippets%2Fnew',
      }),
    );
    expect(openOptionsPage).not.toHaveBeenCalled();
  });

  it('falls back to the options page outside web pages', async () => {
    const openOptionsPage = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      runtime: { openOptionsPage },
      tabs: {
        query: vi.fn().mockResolvedValue([{ url: 'chrome://extensions' }]),
      },
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));

    await waitFor(() => expect(openOptionsPage).toHaveBeenCalledTimes(1));
  });
});
