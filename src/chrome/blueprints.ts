import {
  START_BLUEPRINT_CREATOR_MESSAGE,
  type StartBlueprintCreatorResponse,
} from '../shared/blueprint-messages';

export async function startBlueprintCreator(): Promise<StartBlueprintCreatorResponse> {
  const response = (await chrome.runtime.sendMessage({
    type: START_BLUEPRINT_CREATOR_MESSAGE,
  })) as StartBlueprintCreatorResponse | undefined;

  if (!response) {
    return {
      ok: false,
      error: 'Blueprint creator did not return a response.',
    };
  }

  return response;
}
