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
    const sendMessage = vi.fn().mockResolvedValue(readyPageResponse());
    const query = vi.fn().mockResolvedValue([
      {
        url: 'https://docs.example.com/snippets/new?token=private#draft',
      },
    ]);

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://tampr/${path}`,
        openOptionsPage,
        sendMessage,
      },
      tabs: { create, query },
    });

    render(<App />);

    await screen.findByText('Current page cleanup');

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        url: 'chrome-extension://tampr/workspace.html?sourcePage=https%3A%2F%2Fdocs.example.com%2Fsnippets%2Fnew',
      }),
    );
    expect(openOptionsPage).not.toHaveBeenCalled();
  });

  it('toggles matching snippets from the popup', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(readyPageResponse())
      .mockResolvedValueOnce(workspaceResponse())
      .mockResolvedValueOnce(disabledPageResponse());

    vi.stubGlobal('chrome', {
      runtime: { sendMessage },
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            url: 'https://docs.example.com/snippets/new',
          },
        ]),
      },
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Disable' }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith({
        type: 'snippets/set-enabled',
        enabled: false,
        snippetId: 'page-snippet',
      }),
    );
    expect(await screen.findByRole('button', { name: 'Enable' })).toBeTruthy();
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

  it('shows unsupported web surfaces before local page snippets', async () => {
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([{ url: 'chrome://extensions' }]),
      },
    });

    render(<App />);

    expect(await screen.findByText('Web page needed')).toBeTruthy();
  });

  it('explains unavailable User Scripts setup on matching pages', async () => {
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: vi.fn().mockResolvedValue(setupPageResponse()) },
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            url: 'https://docs.example.com/snippets/new',
          },
        ]),
      },
    });

    render(<App />);

    expect(await screen.findByText('Setup')).toBeTruthy();
    expect(
      screen.getByText(
        'Enable User Scripts for Tampr in Chrome extension details before snippets can run.',
      ),
    ).toBeTruthy();
  });
});

function readyPageResponse() {
  return {
    ok: true,
    state: {
      pageUrl: 'https://docs.example.com/snippets/new',
      savedMatches: [
        {
          id: 'page-snippet',
          enabled: true,
          name: 'Current page cleanup',
          rule: '*://docs.example.com/*',
        },
      ],
      enabledMatches: [
        {
          id: 'page-snippet',
          enabled: true,
          name: 'Current page cleanup',
          rule: '*://docs.example.com/*',
        },
      ],
      runtime: {
        state: 'ready',
        registrations: 1,
        skipped: [],
        errors: [],
      },
    },
  };
}

function disabledPageResponse() {
  return {
    ok: true,
    state: {
      pageUrl: 'https://docs.example.com/snippets/new',
      savedMatches: [
        {
          id: 'page-snippet',
          enabled: false,
          name: 'Current page cleanup',
          rule: '*://docs.example.com/*',
        },
      ],
      enabledMatches: [],
      runtime: {
        state: 'ready',
        registrations: 0,
        skipped: [{ snippetId: 'page-snippet', reason: 'disabled' }],
        errors: [],
      },
    },
  };
}

function setupPageResponse() {
  return {
    ok: true,
    state: {
      pageUrl: 'https://docs.example.com/snippets/new',
      savedMatches: [
        {
          id: 'page-snippet',
          enabled: true,
          name: 'Current page cleanup',
          rule: '*://docs.example.com/*',
        },
      ],
      enabledMatches: [
        {
          id: 'page-snippet',
          enabled: true,
          name: 'Current page cleanup',
          rule: '*://docs.example.com/*',
        },
      ],
      runtime: {
        state: 'user-scripts-unavailable',
        registrations: 0,
        skipped: [],
        errors: [],
      },
    },
  };
}

function workspaceResponse() {
  return {
    ok: true,
    state: {
      snippets: [],
      runtime: {
        state: 'ready',
        registrations: 0,
        skipped: [],
        errors: [],
      },
    },
  };
}
