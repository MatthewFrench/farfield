import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/Components/UserInterface/Button";
import { Input } from "@/Components/UserInterface/Input";
import { Label } from "@/Components/UserInterface/Label";
import { type PendingAuthTokenRefreshRequest } from "@/Features/Chat/DomainModel/PendingAuthTokenRefreshRequestSelector";

const ACCESS_TOKEN_LABEL = "Access token";
const ACCOUNT_IDENTIFIER_LABEL = "ChatGPT account identifier";
const PLAN_TYPE_LABEL = "Plan type (optional)";

export interface PendingAuthTokenRefreshRequestCardProps {
  request: PendingAuthTokenRefreshRequest;
  onSubmit: (accessToken: string, chatgptAccountId: string, chatgptPlanType: string | null) => void;
  isBusy: boolean;
}

function readTrimmedValue(value: string): string {
  return value.trim();
}

export function PendingAuthTokenRefreshRequestCard({
  request,
  onSubmit,
  isBusy,
}: PendingAuthTokenRefreshRequestCardProps): React.JSX.Element {
  const [accessTokenDraft, setAccessTokenDraft] = useState<string>("");
  const [accountIdentifierDraft, setAccountIdentifierDraft] = useState<string>(
    request.params.previousAccountId ?? "",
  );
  const [planTypeDraft, setPlanTypeDraft] = useState<string>("");

  useEffect(() => {
    setAccessTokenDraft("");
    setAccountIdentifierDraft(request.params.previousAccountId ?? "");
    setPlanTypeDraft("");
  }, [request.id, request.params.previousAccountId]);

  const canSubmit = useMemo(() => {
    return (
      readTrimmedValue(accessTokenDraft).length > 0 &&
      readTrimmedValue(accountIdentifierDraft).length > 0 &&
      !isBusy
    );
  }, [accessTokenDraft, accountIdentifierDraft, isBusy]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          Auth token refresh request
        </div>
        <div className="text-sm text-foreground">
          Codex requested token refresh because of:{" "}
          <span className="font-medium">{request.params.reason}</span>
        </div>
        {request.params.previousAccountId !== undefined &&
        request.params.previousAccountId !== null ? (
          <div className="text-xs text-muted-foreground">
            Previous account hint:{" "}
            <span className="font-medium">{request.params.previousAccountId}</span>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pending-auth-token-access-token">{ACCESS_TOKEN_LABEL}</Label>
        <Input
          id="pending-auth-token-access-token"
          type="password"
          value={accessTokenDraft}
          onChange={(event) => {
            setAccessTokenDraft(event.target.value);
          }}
          placeholder="Enter refreshed access token"
          className="h-8 bg-background text-base md:text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pending-auth-token-account-id">{ACCOUNT_IDENTIFIER_LABEL}</Label>
        <Input
          id="pending-auth-token-account-id"
          type="text"
          value={accountIdentifierDraft}
          onChange={(event) => {
            setAccountIdentifierDraft(event.target.value);
          }}
          placeholder="Account identifier"
          className="h-8 bg-background text-base md:text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pending-auth-token-plan-type">{PLAN_TYPE_LABEL}</Label>
        <Input
          id="pending-auth-token-plan-type"
          type="text"
          value={planTypeDraft}
          onChange={(event) => {
            setPlanTypeDraft(event.target.value);
          }}
          placeholder="pro, plus, enterprise..."
          className="h-8 bg-background text-base md:text-sm"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          onClick={() => {
            onSubmit(
              readTrimmedValue(accessTokenDraft),
              readTrimmedValue(accountIdentifierDraft),
              readTrimmedValue(planTypeDraft).length > 0 ? readTrimmedValue(planTypeDraft) : null,
            );
          }}
          disabled={!canSubmit}
          size="sm"
          className="h-8 text-xs"
        >
          Submit refresh token
        </Button>
      </div>
    </motion.div>
  );
}
