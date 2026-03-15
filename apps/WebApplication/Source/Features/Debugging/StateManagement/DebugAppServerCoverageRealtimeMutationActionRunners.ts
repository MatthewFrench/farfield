import { type Dispatch, type SetStateAction } from "react";
import type { CapabilityServerClient } from "@/Features/Capabilities/DataAccess/CapabilityServerClient";
import type {
  DebugAppServerCoverageThreadRealtimeAppendAudioResult,
  DebugAppServerCoverageThreadRealtimeAppendTextResult,
  DebugAppServerCoverageThreadRealtimeStartResult,
  DebugAppServerCoverageThreadRealtimeStopResult,
  DebugAppServerCoverageWindowsSandboxSetupMode,
  DebugAppServerCoverageWindowsSandboxSetupStartResult,
} from "../DomainModel/DebugAppServerCoverageContracts";
import {
  mapThreadRealtimeAppendAudioResult,
  mapThreadRealtimeAppendTextResult,
  mapThreadRealtimeStartResult,
  mapThreadRealtimeStopResult,
  mapWindowsSandboxSetupStartResult,
} from "./DebugAppServerCoverageDiagnosticsMappers";

const COVERAGE_MUTATION_OPERATION_NAME = "debug-coverage-action";
const COVERAGE_ACTION_ERROR_PREFIX = "Unable to run coverage action: ";

function toErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export interface RunThreadRealtimeStartActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  threadId: string;
  prompt: string;
  sessionId?: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeStartResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeStartResult | null>
  >;
}

export function runThreadRealtimeStartAction(input: RunThreadRealtimeStartActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedThreadId = input.threadId.trim();
  const normalizedPrompt = input.prompt.trim();
  if (normalizedThreadId.length === 0 || normalizedPrompt.length === 0) {
    return;
  }

  const normalizedSessionId = input.sessionId?.trim();
  if (
    input.sessionId !== undefined &&
    normalizedSessionId !== undefined &&
    normalizedSessionId.length === 0
  ) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.startThreadRealtime({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        threadId: normalizedThreadId,
        prompt: normalizedPrompt,
        ...(normalizedSessionId !== undefined ? { sessionId: normalizedSessionId } : {}),
      });
      input.setLastThreadRealtimeStartResult(
        mapThreadRealtimeStartResult(
          response,
          normalizedThreadId,
          normalizedPrompt,
          normalizedSessionId ?? null,
        ),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunThreadRealtimeAppendAudioActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  threadId: string;
  audio: {
    data: string;
    sampleRate: number;
    numChannels: number;
    samplesPerChannel?: number;
  };
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeAppendAudioResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeAppendAudioResult | null>
  >;
}

export function runThreadRealtimeAppendAudioAction(
  input: RunThreadRealtimeAppendAudioActionInput,
): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedThreadId = input.threadId.trim();
  const normalizedAudioData = input.audio.data.trim();
  const normalizedSampleRate = input.audio.sampleRate;
  const normalizedNumChannels = input.audio.numChannels;
  const normalizedSamplesPerChannel = input.audio.samplesPerChannel;
  if (normalizedThreadId.length === 0 || normalizedAudioData.length === 0) {
    return;
  }

  if (!Number.isInteger(normalizedSampleRate) || normalizedSampleRate <= 0) {
    return;
  }

  if (!Number.isInteger(normalizedNumChannels) || normalizedNumChannels <= 0) {
    return;
  }

  if (
    normalizedSamplesPerChannel !== undefined &&
    (!Number.isInteger(normalizedSamplesPerChannel) || normalizedSamplesPerChannel <= 0)
  ) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.appendThreadRealtimeAudio({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        threadId: normalizedThreadId,
        audio: {
          data: normalizedAudioData,
          sampleRate: normalizedSampleRate,
          numChannels: normalizedNumChannels,
          ...(normalizedSamplesPerChannel !== undefined
            ? { samplesPerChannel: normalizedSamplesPerChannel }
            : {}),
        },
      });
      input.setLastThreadRealtimeAppendAudioResult(
        mapThreadRealtimeAppendAudioResult(response, normalizedThreadId, {
          data: normalizedAudioData,
          sampleRate: normalizedSampleRate,
          numChannels: normalizedNumChannels,
          ...(normalizedSamplesPerChannel !== undefined
            ? { samplesPerChannel: normalizedSamplesPerChannel }
            : {}),
        }),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunThreadRealtimeAppendTextActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  threadId: string;
  text: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeAppendTextResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeAppendTextResult | null>
  >;
}

export function runThreadRealtimeAppendTextAction(
  input: RunThreadRealtimeAppendTextActionInput,
): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedThreadId = input.threadId.trim();
  const normalizedText = input.text.trim();
  if (normalizedThreadId.length === 0 || normalizedText.length === 0) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.appendThreadRealtimeText({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        threadId: normalizedThreadId,
        text: normalizedText,
      });
      input.setLastThreadRealtimeAppendTextResult(
        mapThreadRealtimeAppendTextResult(response, normalizedThreadId, normalizedText),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunThreadRealtimeStopActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  threadId: string;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastThreadRealtimeStopResult: Dispatch<
    SetStateAction<DebugAppServerCoverageThreadRealtimeStopResult | null>
  >;
}

export function runThreadRealtimeStopAction(input: RunThreadRealtimeStopActionInput): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  const normalizedThreadId = input.threadId.trim();
  if (normalizedThreadId.length === 0) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.stopThreadRealtime({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        threadId: normalizedThreadId,
      });
      input.setLastThreadRealtimeStopResult(
        mapThreadRealtimeStopResult(response, normalizedThreadId),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}

export interface RunWindowsSandboxSetupStartActionInput {
  capabilityServerClient: CapabilityServerClient;
  isRunningCoverageAction: boolean;
  mode: DebugAppServerCoverageWindowsSandboxSetupMode;
  setIsRunningCoverageAction: Dispatch<SetStateAction<boolean>>;
  setCoverageActionErrorMessage: Dispatch<SetStateAction<string>>;
  setLastWindowsSandboxSetupStartResult: Dispatch<
    SetStateAction<DebugAppServerCoverageWindowsSandboxSetupStartResult | null>
  >;
}

export function runWindowsSandboxSetupStartAction(
  input: RunWindowsSandboxSetupStartActionInput,
): void {
  if (input.isRunningCoverageAction) {
    return;
  }

  input.setIsRunningCoverageAction(true);
  input.setCoverageActionErrorMessage("");

  void (async () => {
    try {
      const response = await input.capabilityServerClient.startWindowsSandboxSetup({
        actionName: COVERAGE_MUTATION_OPERATION_NAME,
        mode: input.mode,
      });
      input.setLastWindowsSandboxSetupStartResult(
        mapWindowsSandboxSetupStartResult(response, input.mode),
      );
    } catch (error) {
      input.setCoverageActionErrorMessage(
        `${COVERAGE_ACTION_ERROR_PREFIX}${toErrorMessage(error)}`,
      );
    } finally {
      input.setIsRunningCoverageAction(false);
    }
  })();
}
