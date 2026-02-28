import { Settings2 } from "lucide-react";
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
  debugWorkspacePaneProperties: DebugWorkspacePaneProps;
  pushNotificationsSettingsPaneProperties: PushNotificationsSettingsPaneProps;
}

export function SettingsWorkspacePane({
  settingsWorkspaceSection,
  onSettingsWorkspaceSectionChange,
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
