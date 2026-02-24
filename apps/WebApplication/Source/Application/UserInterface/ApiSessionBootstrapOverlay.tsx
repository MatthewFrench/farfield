import { Button } from "@/Components/UserInterface/Button";

export interface ApiSessionBootstrapOverlayProperties {
  apiTokenDraft: string;
  onApiTokenDraftChange: (nextValue: string) => void;
  onSubmitApiToken: () => void;
  isSubmitting: boolean;
  errorMessage: string;
}

export function ApiSessionBootstrapOverlay({
  apiTokenDraft,
  onApiTokenDraftChange,
  onSubmitApiToken,
  isSubmitting,
  errorMessage
}: ApiSessionBootstrapOverlayProperties): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <form
        className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitApiToken();
        }}
      >
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Authenticate Session</h2>
          <p className="text-xs text-muted-foreground">
            This server requires an API token. Enter it once to create a secure browser session.
          </p>
        </div>
        <input
          type="password"
          value={apiTokenDraft}
          onChange={(event) => onApiTokenDraftChange(event.target.value)}
          className="w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="API token"
          autoComplete="off"
          autoFocus
        />
        {errorMessage.length > 0 && (
          <p className="text-xs text-danger">{errorMessage}</p>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            size="sm"
          >
            {isSubmitting ? "Authenticating..." : "Authenticate"}
          </Button>
        </div>
      </form>
    </div>
  );
}
