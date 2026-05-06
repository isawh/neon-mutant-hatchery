type TelegramHapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type TelegramNotificationType = "error" | "success" | "warning";
type TelegramViewportHandler = (eventData?: { isStateStable?: boolean }) => void;
type TelegramEventType = "viewportChanged" | "fullscreenChanged";

type TelegramSafeAreaInset = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  onEvent?: (eventType: TelegramEventType, callback: TelegramViewportHandler) => void;
  offEvent?: (eventType: TelegramEventType, callback: TelegramViewportHandler) => void;
  openTelegramLink?: (url: string) => void;
  viewportHeight?: number;
  viewportStableHeight?: number;
  isFullscreen?: boolean;
  isExpanded?: boolean;
  platform?: string;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;
  initDataUnsafe?: {
    start_param?: string;
  };
  HapticFeedback?: {
    impactOccurred?: (style: TelegramHapticStyle) => void;
    notificationOccurred?: (type: TelegramNotificationType) => void;
    selectionChanged?: () => void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const getWebApp = () => window.Telegram?.WebApp;

const root = () => document.documentElement;

const getSafeAreaValue = (webApp: TelegramWebApp | undefined, edge: "top" | "bottom") =>
  Math.max(
    0,
    webApp?.safeAreaInset?.[edge] ?? 0,
    webApp?.contentSafeAreaInset?.[edge] ?? 0,
  );

const isMobileTelegramPlatform = (platform = "") =>
  ["android", "android_x", "ios", "iphone", "ipad"].includes(platform.toLowerCase()) ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const safeCall = (call: () => void) => {
  try {
    call();
  } catch {
    // Telegram capabilities vary by client version; unsupported calls must not block app startup.
  }
};

export type TelegramViewportState = {
  viewportHeight: number | null;
  viewportStableHeight: number | null;
  appHeight: string;
  windowInnerHeight: number;
  documentElementClientHeight: number;
  isFullscreen: boolean | null;
  isExpanded: boolean | null;
  platform: string;
};

export const getTelegramViewportState = (): TelegramViewportState => {
  const webApp = getWebApp();
  const computedStyle = getComputedStyle(root());
  return {
    viewportHeight: typeof webApp?.viewportHeight === "number" ? webApp.viewportHeight : null,
    viewportStableHeight: typeof webApp?.viewportStableHeight === "number" ? webApp.viewportStableHeight : null,
    appHeight: computedStyle.getPropertyValue("--app-height").trim() || `${window.innerHeight}px`,
    windowInnerHeight: window.innerHeight,
    documentElementClientHeight: root().clientHeight,
    isFullscreen: typeof webApp?.isFullscreen === "boolean" ? webApp.isFullscreen : null,
    isExpanded: typeof webApp?.isExpanded === "boolean" ? webApp.isExpanded : null,
    platform: webApp?.platform ?? "browser",
  };
};

export const syncTelegramViewportCss = () => {
  const webApp = getWebApp();
  const documentRoot = root();
  const fallbackHeight = `${Math.max(1, window.innerHeight || documentRoot.clientHeight)}px`;
  const viewportHeight =
    typeof webApp?.viewportHeight === "number" && webApp.viewportHeight > 0
      ? `${webApp.viewportHeight}px`
      : fallbackHeight;
  const stableHeight =
    typeof webApp?.viewportStableHeight === "number" && webApp.viewportStableHeight > 0
      ? `${webApp.viewportStableHeight}px`
      : viewportHeight;
  const safeAreaTop = `${getSafeAreaValue(webApp, "top")}px`;
  const safeAreaBottom = `${getSafeAreaValue(webApp, "bottom")}px`;

  documentRoot.style.setProperty("--tg-viewport-height", viewportHeight);
  documentRoot.style.setProperty("--tg-viewport-stable-height", stableHeight);
  documentRoot.style.setProperty("--tg-safe-area-top", safeAreaTop);
  documentRoot.style.setProperty("--tg-safe-area-bottom", safeAreaBottom);
  documentRoot.style.setProperty("--app-height", viewportHeight);

  documentRoot.classList.toggle("tg-fullscreen", Boolean(webApp?.isFullscreen));
  documentRoot.classList.toggle("tg-expanded", Boolean(webApp?.isExpanded));
  documentRoot.classList.toggle("tg-mobile", webApp ? isMobileTelegramPlatform(webApp.platform) : false);
};

const expandFullscreen = () => {
  const webApp = getWebApp();
  if (!webApp) {
    syncTelegramViewportCss();
    return;
  }

  safeCall(() => webApp.expand?.());
  safeCall(() => webApp.requestFullscreen?.());
  syncTelegramViewportCss();
};

let telegramFullscreenInitialized = false;
let windowViewportListenersInitialized = false;

const handleViewportChanged: TelegramViewportHandler = () => {
  syncTelegramViewportCss();
  window.setTimeout(syncTelegramViewportCss, 40);
};

const handleWindowViewportChanged = () => {
  handleViewportChanged();
};

export const initTelegramFullscreen = () => {
  // Telegram may still reserve native top/bottom UI depending on launch method and client version,
  // but the app requests and uses the maximum available viewport immediately.
  const webApp = getWebApp();
  if (!windowViewportListenersInitialized) {
    windowViewportListenersInitialized = true;
    window.addEventListener("resize", handleWindowViewportChanged, { passive: true });
    window.addEventListener("orientationchange", handleWindowViewportChanged, { passive: true });
  }

  if (!webApp) {
    syncTelegramViewportCss();
    return;
  }

  safeCall(() => webApp.ready?.());
  safeCall(() => webApp.disableVerticalSwipes?.());
  expandFullscreen();

  [50, 150, 500, 1000, 2000].forEach((delay) => {
    window.setTimeout(expandFullscreen, delay);
  });

  if (!telegramFullscreenInitialized) {
    telegramFullscreenInitialized = true;
    safeCall(() => webApp.onEvent?.("viewportChanged", handleViewportChanged));
    safeCall(() => webApp.onEvent?.("fullscreenChanged", handleViewportChanged));
  }
};

export const initTelegram = initTelegramFullscreen;

initTelegramFullscreen();

export const haptic = {
  impact(style: TelegramHapticStyle = "light") {
    getWebApp()?.HapticFeedback?.impactOccurred?.(style);
  },
  success() {
    getWebApp()?.HapticFeedback?.notificationOccurred?.("success");
  },
  error() {
    getWebApp()?.HapticFeedback?.notificationOccurred?.("error");
  },
  selection() {
    getWebApp()?.HapticFeedback?.selectionChanged?.();
  },
};

export const getTelegramStartParam = () => getWebApp()?.initDataUnsafe?.start_param ?? "";

export const shareTelegramInvite = (url: string, text: string) => {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const webApp = getWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(shareUrl);
    return;
  }
  window.open(shareUrl, "_blank", "noopener,noreferrer");
};
