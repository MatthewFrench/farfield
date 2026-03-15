import {
  type CollaborationMode,
  type TurnStartParams,
  TurnStartParamsSchema,
} from "@farfield/protocol";

const TURN_START_TEXT_INPUT_PART_TYPE = "text" as const;

export interface BuildTurnStartMessageParametersInput {
  threadId: string;
  text: string;
  cwd?: string;
  turnStartTemplate?: TurnStartParams | null;
  model?: string | null;
  effort?: string | null;
  collaborationMode?: CollaborationMode | null;
}

/**
 * Owns turn/start payload construction for user text messages.
 * Both IPC and app-server paths share this mapper to keep turn-start behavior identical.
 */
export function buildTurnStartMessageParameters(
  input: BuildTurnStartMessageParametersInput,
): TurnStartParams {
  const normalizedCwd = normalizeNonEmptyOptionalString(input.cwd);
  const textInput: TurnStartParams["input"] = [
    {
      type: TURN_START_TEXT_INPUT_PART_TYPE,
      text: input.text,
    },
  ];

  const template = input.turnStartTemplate;
  const baseTurnStartParameters: TurnStartParams = template
    ? {
        ...template,
        threadId: input.threadId,
        input: textInput,
        cwd: normalizedCwd ?? template.cwd,
        attachments: template.attachments ?? [],
      }
    : {
        threadId: input.threadId,
        input: textInput,
        ...(normalizedCwd !== undefined ? { cwd: normalizedCwd } : {}),
        attachments: [],
      };

  const mergedTurnStartParameters: TurnStartParams = {
    ...baseTurnStartParameters,
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(input.effort !== undefined ? { effort: input.effort } : {}),
    ...(input.collaborationMode !== undefined
      ? { collaborationMode: input.collaborationMode }
      : {}),
  };

  return TurnStartParamsSchema.parse(mergedTurnStartParameters);
}

function normalizeNonEmptyOptionalString(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}
