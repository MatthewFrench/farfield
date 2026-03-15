import type { IpcResponseFrame } from "@farfield/protocol";
import { DesktopIpcError } from "./Errors.js";

interface PendingRequestRecord {
  method: string;
  timer: NodeJS.Timeout;
  resolve: (value: IpcResponseFrame) => void;
  reject: (error: Error) => void;
}

export interface PendingRequestRegistration {
  requestId: string;
  method: string;
  timeoutMilliseconds: number;
  timeoutErrorMessage: string;
}

export interface ClaimedPendingRequest {
  method: string;
  resolve: (value: IpcResponseFrame) => void;
  reject: (error: Error) => void;
}

/**
 * Owns request/response promise lifecycle, including timeout and deterministic cleanup.
 */
export class IpcPendingRequestOwner {
  private readonly pendingByRequestId = new Map<string, PendingRequestRecord>();

  public createPendingRequestPromise(
    registration: PendingRequestRegistration,
  ): Promise<IpcResponseFrame> {
    return new Promise<IpcResponseFrame>((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        this.pendingByRequestId.delete(registration.requestId);
        reject(new DesktopIpcError(registration.timeoutErrorMessage));
      }, registration.timeoutMilliseconds);

      this.pendingByRequestId.set(registration.requestId, {
        method: registration.method,
        timer: timeoutTimer,
        resolve,
        reject,
      });
    });
  }

  public claimPendingRequest(requestId: string): ClaimedPendingRequest | null {
    const pendingRequest = this.pendingByRequestId.get(requestId);
    if (!pendingRequest) {
      return null;
    }

    clearTimeout(pendingRequest.timer);
    this.pendingByRequestId.delete(requestId);
    return {
      method: pendingRequest.method,
      resolve: pendingRequest.resolve,
      reject: pendingRequest.reject,
    };
  }

  public rejectPendingRequest(requestId: string, error: Error): void {
    const pendingRequest = this.claimPendingRequest(requestId);
    if (!pendingRequest) {
      return;
    }

    pendingRequest.reject(error);
  }

  public rejectAllPendingRequests(error: Error): void {
    for (const pendingRequest of this.pendingByRequestId.values()) {
      clearTimeout(pendingRequest.timer);
      pendingRequest.reject(error);
    }

    this.pendingByRequestId.clear();
  }
}
