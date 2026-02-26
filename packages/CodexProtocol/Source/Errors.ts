import { ZodError } from "zod";

/**
 * Owns protocol boundary parse error formatting and metadata so consumers can diagnose failures
 * without depending on Zod issue types.
 */
const RootPathToken = "<root>";
const IssueSeparator = "; ";
const SchemaMismatchSuffix = "did not match expected schema.";
const LegacyErrorContext = "ProtocolValidationError";

export type ProtocolValidationIssuePathSegment = string | number;

export type ProtocolValidationIssueInput = {
  readonly pathSegments: readonly ProtocolValidationIssuePathSegment[];
  readonly message: string;
};

export type ProtocolValidationIssueMetadata = {
  readonly pathSegments: readonly ProtocolValidationIssuePathSegment[];
  readonly path: string;
  readonly message: string;
  readonly summary: string;
};

export type ProtocolValidationErrorMetadata = {
  readonly context: string;
  readonly issuePaths: readonly string[];
  readonly issueDetails: readonly ProtocolValidationIssueMetadata[];
};

function formatIssuePath(pathSegments: readonly ProtocolValidationIssuePathSegment[]): string {
  if (pathSegments.length === 0) {
    return RootPathToken;
  }

  return pathSegments
    .map((pathSegment) => (typeof pathSegment === "number" ? `[${pathSegment}]` : pathSegment))
    .join(".")
    .replace(/\.\[/g, "[");
}

function createIssueMetadata(issueInput: ProtocolValidationIssueInput): ProtocolValidationIssueMetadata {
  const path = formatIssuePath(issueInput.pathSegments);
  const summary = `${path}: ${issueInput.message}`;
  return {
    pathSegments: [...issueInput.pathSegments],
    path,
    message: issueInput.message,
    summary
  };
}

function createMetadata(
  context: string,
  issueInputs: readonly ProtocolValidationIssueInput[]
): ProtocolValidationErrorMetadata {
  const issueDetails = issueInputs.map(createIssueMetadata);
  return {
    context,
    issuePaths: issueDetails.map((issueDetail) => issueDetail.path),
    issueDetails
  };
}

function createValidationMessage(metadata: ProtocolValidationErrorMetadata): string {
  if (metadata.issueDetails.length === 0) {
    return `${metadata.context} ${SchemaMismatchSuffix}`;
  }

  return `${metadata.context} ${SchemaMismatchSuffix} ${metadata.issueDetails
    .map((issueDetail) => issueDetail.summary)
    .join(IssueSeparator)}`;
}

function createLegacyMetadata(issues: readonly string[]): ProtocolValidationErrorMetadata {
  return createMetadata(
    LegacyErrorContext,
    issues.map((issue) => ({ pathSegments: [], message: issue }))
  );
}

export class ProtocolValidationError extends Error {
  public readonly issues: string[];
  public readonly metadata: ProtocolValidationErrorMetadata;

  public constructor(
    message: string,
    issues: string[],
    metadata: ProtocolValidationErrorMetadata = createLegacyMetadata(issues)
  ) {
    super(message);
    this.name = "ProtocolValidationError";
    this.issues = [...issues];
    this.metadata = metadata;
  }

  public static fromIssues(
    context: string,
    issueInputs: readonly ProtocolValidationIssueInput[]
  ): ProtocolValidationError {
    const metadata = createMetadata(context, issueInputs);
    return new ProtocolValidationError(
      createValidationMessage(metadata),
      metadata.issueDetails.map((issueDetail) => issueDetail.summary),
      metadata
    );
  }

  public static fromZod(context: string, error: ZodError): ProtocolValidationError {
    return ProtocolValidationError.fromIssues(
      context,
      error.issues.map((issue) => ({
        pathSegments: issue.path,
        message: issue.message
      }))
    );
  }
}
