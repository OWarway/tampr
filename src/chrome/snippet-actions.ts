import type {
  WorkspaceState,
  WorkspaceStateResponse,
} from '../shared/workspace-messages';

export async function setSnippetEnabled(
  snippetId: string,
  enabled: boolean,
): Promise<WorkspaceState> {
  const response = (await chrome.runtime.sendMessage({
    type: 'snippets/set-enabled',
    enabled,
    snippetId,
  })) as WorkspaceStateResponse | { ok: false; error: string };

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.state;
}
