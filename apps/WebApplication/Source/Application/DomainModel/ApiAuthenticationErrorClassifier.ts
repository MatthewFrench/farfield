/**
 * Classifies API-session bootstrap failures that require a token prompt.
 */
const API_TOKEN_AUTHENTICATION_ERROR_PATTERN =
  /^Unauthorized: missing or invalid X-Farfield-Token\b/i;

export class ApiAuthenticationErrorClassifier {
  public isApiTokenAuthenticationError(errorMessage: string): boolean {
    return API_TOKEN_AUTHENTICATION_ERROR_PATTERN.test(errorMessage.trim());
  }
}
