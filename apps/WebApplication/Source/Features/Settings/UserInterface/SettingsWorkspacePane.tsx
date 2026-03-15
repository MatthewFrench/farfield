import { Loader2, Moon, RefreshCcw, Settings2, Sun } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import { Tabs } from "@/Components/UserInterface/Tabs";
import { TabsList } from "@/Components/UserInterface/TabsList";
import { TabsTrigger } from "@/Components/UserInterface/TabsTrigger";
import {
  DebugWorkspacePane,
  type DebugWorkspacePaneProps,
} from "@/Features/Debugging/UserInterface/DebugWorkspacePane";
import {
  PushNotificationsSettingsPane,
  type PushNotificationsSettingsPaneProps,
} from "@/Features/PushNotifications/UserInterface/PushNotificationsSettingsPane";
import {
  parseSettingsWorkspaceSection,
  type SettingsWorkspaceSection,
} from "@/Features/Settings/DomainModel/SettingsWorkspaceSectionContracts";

export interface SettingsWorkspacePaneProps {
  settingsWorkspaceSection: SettingsWorkspaceSection;
  onSettingsWorkspaceSectionChange: (nextSection: SettingsWorkspaceSection) => void;
  theme: string;
  isBusy: boolean;
  onRefreshData: () => void;
  onToggleTheme: () => void;
  debugWorkspacePaneProperties: DebugWorkspacePaneProps;
  pushNotificationsSettingsPaneProperties: PushNotificationsSettingsPaneProps;
}

function readThemeActionLabel(theme: string): string {
  if (theme === "dark") {
    return "Use light theme";
  }
  return "Use dark theme";
}

function readThemeActionIcon(theme: string): React.JSX.Element {
  if (theme === "dark") {
    return <Sun size={13} aria-hidden="true" />;
  }
  return <Moon size={13} aria-hidden="true" />;
}

export function SettingsWorkspacePane({
  settingsWorkspaceSection,
  onSettingsWorkspaceSectionChange,
  theme,
  isBusy,
  onRefreshData,
  onToggleTheme,
  debugWorkspacePaneProperties,
  pushNotificationsSettingsPaneProperties,
}: SettingsWorkspacePaneProps): React.JSX.Element {
  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Settings2 size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">Settings</span>
        </div>
      </div>

      <div className="shrink-0 px-4 py-3 border-b border-border">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-xs font-semibold">Refresh app data</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reload thread list, selected thread details, and runtime summaries from app-server.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full justify-start gap-1.5"
              onClick={onRefreshData}
              disabled={isBusy}
              data-testid="refresh-button"
            >
              {isBusy ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCcw size={13} aria-hidden="true" />
              )}
              <span>{isBusy ? "Refreshing data" : "Refresh now"}</span>
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <div className="text-xs font-semibold">Appearance theme</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Switch Farfield between light and dark display themes.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full justify-start gap-1.5"
              onClick={onToggleTheme}
              data-testid="settings-theme-toggle-button"
            >
              {readThemeActionIcon(theme)}
              <span>{readThemeActionLabel(theme)}</span>
            </Button>
          </div>
        </div>
      </div>

      <Tabs
        value={settingsWorkspaceSection}
        onValueChange={(value) => {
          onSettingsWorkspaceSectionChange(parseSettingsWorkspaceSection(value));
        }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        <div className="shrink-0 px-4 py-2 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger
              value="notifications"
              data-testid="settings-tab-notifications"
              className="text-xs h-7 px-2.5"
            >
              Notifications
            </TabsTrigger>
            <TabsTrigger
              value="debug"
              data-testid="settings-tab-debug"
              className="text-xs h-7 px-2.5"
            >
              Debug
            </TabsTrigger>
          </TabsList>
        </div>

        {settingsWorkspaceSection === "notifications" && (
          <PushNotificationsSettingsPane {...pushNotificationsSettingsPaneProperties} />
        )}

        {settingsWorkspaceSection === "debug" && (
          <DebugWorkspacePane {...debugWorkspacePaneProperties} />
        )}
      </Tabs>
    </div>
  );
}
