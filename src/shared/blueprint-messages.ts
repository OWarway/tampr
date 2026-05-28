export const START_BLUEPRINT_CREATOR_MESSAGE = 'blueprints/start-creator';

export type StartBlueprintCreatorMessage = {
  type: typeof START_BLUEPRINT_CREATOR_MESSAGE;
};

export type StartBlueprintCreatorResponse =
  | {
      ok: true;
      snippetId?: string;
      status: 'cancelled' | 'created';
    }
  | {
      error: string;
      ok: false;
    };

export function isStartBlueprintCreatorMessage(
  message: unknown,
): message is StartBlueprintCreatorMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === START_BLUEPRINT_CREATOR_MESSAGE
  );
}
