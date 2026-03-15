/**
 * Push diagnostics contract surface consumed by user-interface owners.
 * Values originate from already-validated push data-access responses and are projected into
 * explicit UI-facing contracts to keep user-interface modules independent from data-access modules.
 */
export interface PushStatusDiagnostics {
  enabled: boolean;
  permissionRequired: boolean;
  subscriptionCount: number;
  privateModeDefault: boolean;
}

export interface PushSendDiagnosticsRecord {
  sentAt: string;
  notificationId: string;
  threadId: string;
  turnId: string;
  attempted: number;
  delivered: number;
  failures: number;
}

export interface PushSendDiagnostics {
  latest: PushSendDiagnosticsRecord | null;
}

export interface PushReceiptDiagnosticsRecord {
  createdAt: string;
  notificationId: string;
  event: string;
  threadId: string | null;
  turnId: string | null;
  message: string | null;
}

export interface PushReceiptDiagnostics {
  latest: PushReceiptDiagnosticsRecord | null;
  count: number;
}

export interface PushLocalCertificateAuthorityDiagnostics {
  available: boolean;
  downloadPath: string | null;
}

export interface PushTestDiagnostics {
  reason: string;
  notificationId: string | null;
  attempted: number;
  delivered: number;
  failures: number;
  ready: boolean;
}
