export class ApiAuthenticationErrorClassifier {
  public isApiTokenAuthenticationError(errorMessage: string): boolean {
    return /^Unauthorized: missing or invalid X-Farfield-Token\b/i.test(errorMessage.trim());
  }
}
