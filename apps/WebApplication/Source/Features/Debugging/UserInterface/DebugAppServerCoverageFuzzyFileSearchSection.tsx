import { useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { type DebugAppServerCoverageFuzzyFileSearchResult } from "../DomainModel/DebugAppServerCoverageContracts";

export interface DebugAppServerCoverageFuzzyFileSearchSectionProps {
  isRunningCoverageAction: boolean;
  lastFuzzyFileSearchResult: DebugAppServerCoverageFuzzyFileSearchResult | null;
  onSearchFuzzyFiles: (query: string, roots: string[], cancellationToken?: string) => void;
}

/**
 * Owns fuzzy-file-search controls for debug coverage diagnostics.
 * Inputs map directly to files/fuzzy-search route parameters so operators can validate result quality.
 */
export function DebugAppServerCoverageFuzzyFileSearchSection({
  isRunningCoverageAction,
  lastFuzzyFileSearchResult,
  onSearchFuzzyFiles,
}: DebugAppServerCoverageFuzzyFileSearchSectionProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState("main");
  const [searchRootsText, setSearchRootsText] = useState("");
  const [cancellationToken, setCancellationToken] = useState("");

  const runFuzzyFileSearch = (): void => {
    const roots = searchRootsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    onSearchFuzzyFiles(
      searchQuery,
      roots,
      cancellationToken.trim().length > 0 ? cancellationToken : undefined,
    );
  };

  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fuzzy File Search
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="debug-coverage-fuzzy-search-run"
          disabled={isRunningCoverageAction}
          onClick={runFuzzyFileSearch}
        >
          Search Files
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-fuzzy-query">
          Query
        </label>
        <input
          id="debug-coverage-fuzzy-query"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
          }}
        />
        <label className="text-xs text-muted-foreground" htmlFor="debug-coverage-fuzzy-roots">
          Roots (one per line)
        </label>
        <textarea
          id="debug-coverage-fuzzy-roots"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs min-h-16"
          value={searchRootsText}
          onChange={(event) => {
            setSearchRootsText(event.target.value);
          }}
        />
        <label
          className="text-xs text-muted-foreground"
          htmlFor="debug-coverage-fuzzy-cancellation-token"
        >
          Cancellation Token (optional)
        </label>
        <input
          id="debug-coverage-fuzzy-cancellation-token"
          type="text"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
          value={cancellationToken}
          onChange={(event) => {
            setCancellationToken(event.target.value);
          }}
        />
      </div>
      {lastFuzzyFileSearchResult === null ? (
        <p className="text-xs text-muted-foreground">No fuzzy file search captured.</p>
      ) : (
        <div
          className="rounded border border-border/70 p-2 text-xs space-y-2"
          data-testid="debug-coverage-fuzzy-search-result"
        >
          <p>Query: {lastFuzzyFileSearchResult.query}</p>
          <p>Roots: {lastFuzzyFileSearchResult.roots.join(", ")}</p>
          <p>
            Searched: {new Date(lastFuzzyFileSearchResult.searchedAtIso8601).toLocaleTimeString()}
          </p>
          {lastFuzzyFileSearchResult.files.length === 0 ? (
            <p className="text-muted-foreground">No file matches returned.</p>
          ) : (
            <div className="space-y-1">
              {lastFuzzyFileSearchResult.files.map((fileMatch) => (
                <div key={`${fileMatch.root}:${fileMatch.path}`} className="rounded border p-2">
                  <p className="font-medium">
                    {fileMatch.fileName} ({fileMatch.score.toFixed(2)})
                  </p>
                  <p className="text-muted-foreground break-all">{fileMatch.root}</p>
                  <p className="text-muted-foreground break-all">{fileMatch.path}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
