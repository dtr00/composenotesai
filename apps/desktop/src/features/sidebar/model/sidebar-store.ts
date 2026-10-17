import { panelWidth } from "../../../entities/settings/model/panel-width";
import { SIDEBAR_WIDTH_PX } from "../../../entities/settings/model/setting-limits";
import { getSettings, updateSettings, useSettings } from "../../../entities/settings/model/settings-store";

export const sidebarWidth = panelWidth("sidebarWidth", SIDEBAR_WIDTH_PX);

export const useSidebarOpen = () => useSettings().sidebarOpen;

export const openSidebar = () => {
  if (!getSettings().sidebarOpen) updateSettings({ sidebarOpen: true });
};

export const toggleSidebar = () => updateSettings({ sidebarOpen: !getSettings().sidebarOpen });
