import type { SnippetDraft } from '../domain/snippets';
import type {
  WorkspaceResponse,
  WorkspaceState,
} from '../shared/workspace-messages';

export async function getWorkspaceState(): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'workspace/get-state' });
}

export async function saveSnippetDraft(
  draft: SnippetDraft,
): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'snippets/save', draft });
}

export async function removeSnippet(
  snippetId: string,
): Promise<WorkspaceState> {
  return sendWorkspaceMessage({ type: 'snippets/remove', snippetId });
}

async function sendWorkspaceMessage(message: unknown): Promise<WorkspaceState> {
  const response = (await chrome.runtime.sendMessage(
    message,
  )) as WorkspaceResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.state;
}
