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
  version?: string;
  platform?: string;
  safeAreaInset?: TelegramSafeAreaInset;
  contentSafeAreaInset?: TelegramSafeAreaInset;
  initData?: string;
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
    __telegramEarlyInitError?: unknown;
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

const isDesktopTelegramPlatform = (platform = "") => {
  const normalized = platform.toLowerCase();
  return ["tdesktop", "desktop", "web", "macos", "windows", "win", "linux"].some((desktopPlatform) =>
    normalized.includes(desktopPlatform),
  );
};

const isDesktopTelegramViewport = (platform = "") => window.innerWidth >= 700 || isDesktopTelegramPlatform(platform);

const safeCall = (call: () => void) => {
  try {
    call();
  } catch {
    // Telegram capabilities vary by client version; unsupported calls must not block app startup.
  }
};

const VIEWPORT_DEBOUNCE_MS = 100;
const MIN_VALID_VIEWPORT_HEIGHT = 300;
const MAX_SUDDEN_SHRINK_RATIO = 0.72;

let pendingViewportTimer = 0;
let pendingViewportReason = "init";
let appliedStableHeight = 0;
let lastAppliedAt = 0;
let lastRawViewportHeight: number | null = null;
let lastRawStableHeight: number | null = null;
let lastFullscreenState: boolean | null = null;

const px = (value: number) => `${Math.round(value)}px`;

const getRawViewportSnapshot = () => {
  const webApp = getWebApp();
  const documentRoot = root();
  const windowHeight = Math.max(1, window.innerHeight || documentRoot.clientHeight);
  const viewportHeight =
    typeof webApp?.viewportHeight === "number" && webApp.viewportHeight > 0 ? webApp.viewportHeight : null;
  const viewportStableHeight =
    typeof webApp?.viewportStableHeight === "number" && webApp.viewportStableHeight > 0
      ? webApp.viewportStableHeight
      : null;
  const platform = webApp?.platform ?? "browser";
  const isDesktop = isDesktopTelegramViewport(platform);
  const lockedFullscreenHeight = Boolean(webApp?.isFullscreen) && appliedStableHeight > 0 && !isDesktop;

  return {
    webApp,
    platform,
    isDesktop,
    viewportHeight,
    viewportStableHeight,
    windowHeight,
    candidateHeight: isDesktop
      ? windowHeight
      : viewportStableHeight ?? (lockedFullscreenHeight ? appliedStableHeight : windowHeight),
    isFullscreen: Boolean(webApp?.isFullscreen),
    isExpanded: Boolean(webApp?.isExpanded),
  };
};

const isBadViewportHeight = (height: number, previousHeight: number) => {
  if (!Number.isFinite(height) || height < MIN_VALID_VIEWPORT_HEIGHT) {
    return true;
  }
  if (!previousHeight) {
    return false;
  }
  const suddenShrink = height < previousHeight * MAX_SUDDEN_SHRINK_RATIO;
  const rawDelta = previousHeight - height;
  return suddenShrink && rawDelta > 180;
};

const logViewportSync = (
  reason: string,
  action: "applied" | "ignored" | "scheduled",
  details: Record<string, unknown>,
) => {
  console.log("[telegram-viewport]", {
    reason,
    action,
    ...details,
  });
};

export type TelegramViewportState = {
  viewportHeight: number | null;
  viewportStableHeight: number | null;
  appHeight: string;
  windowInnerHeight: number;
  documentElementClientHeight: number;
  documentHeight: number;
  telegramSdkLoaded: boolean;
  telegramObjectExists: boolean;
  version: string;
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
    documentHeight: root().scrollHeight,
    telegramSdkLoaded: Boolean(webApp),
    telegramObjectExists: Boolean(window.Telegram),
    version: webApp?.version ?? "Unavailable",
    isFullscreen: typeof webApp?.isFullscreen === "boolean" ? webApp.isFullscreen : null,
    isExpanded: typeof webApp?.isExpanded === "boolean" ? webApp.isExpanded : null,
    platform: webApp?.platform ?? "browser",
  };
};

export const syncTelegramViewportCss = () => {
  const snapshot = getRawViewportSnapshot();
  const { webApp } = snapshot;
  const documentRoot = root();
  const previousStableHeight = appliedStableHeight;
  const nextStableHeight = snapshot.candidateHeight;
  const fullscreenChanged = lastFullscreenState !== snapshot.isFullscreen;
  const desktopShrinkAmount = previousStableHeight - nextStableHeight;
  const reopenDetected =
    Boolean(previousStableHeight) &&
    lastRawViewportHeight !== null &&
    snapshot.viewportHeight !== null &&
    Math.abs(snapshot.viewportHeight - lastRawViewportHeight) > 80 &&
    Date.now() - lastAppliedAt > 500;

  lastRawViewportHeight = snapshot.viewportHeight;
  lastRawStableHeight = snapshot.viewportStableHeight;
  lastFullscreenState = snapshot.isFullscreen;

  if (snapshot.isDesktop && previousStableHeight > 0 && desktopShrinkAmount > 80) {
    logViewportSync(pendingViewportReason, "ignored", {
      oldHeight: previousStableHeight,
      newHeight: nextStableHeight,
      reason: "desktop_shrink_guard",
      viewportHeight: snapshot.viewportHeight,
      viewportStableHeight: snapshot.viewportStableHeight,
      windowInnerHeight: snapshot.windowHeight,
      appliedAppHeight: px(previousStableHeight),
      platform: snapshot.platform,
      isDesktop: snapshot.isDesktop,
      isFullscreen: snapshot.isFullscreen,
      reopenDetected,
    });
    return;
  }

  if (isBadViewportHeight(nextStableHeight, previousStableHeight)) {
    logViewportSync(pendingViewportReason, "ignored", {
      oldHeight: previousStableHeight || null,
      newHeight: nextStableHeight,
      reason: "invalid_or_sudden_mobile_height",
      viewportHeight: snapshot.viewportHeight,
      viewportStableHeight: snapshot.viewportStableHeight,
      windowInnerHeight: snapshot.windowHeight,
      previousStableHeight,
      appliedAppHeight: previousStableHeight ? px(previousStableHeight) : "unchanged",
      platform: snapshot.platform,
      isDesktop: snapshot.isDesktop,
      isFullscreen: snapshot.isFullscreen,
      reopenDetected,
    });
    return;
  }

  appliedStableHeight = nextStableHeight;
  lastAppliedAt = Date.now();

  const viewportHeight = px(
    snapshot.isDesktop ? snapshot.windowHeight : snapshot.viewportHeight ?? snapshot.windowHeight,
  );
  const stableHeight = px(nextStableHeight);
  const telegramStableHeight = px(
    snapshot.isDesktop ? nextStableHeight : snapshot.viewportStableHeight ?? nextStableHeight,
  );
  const safeAreaTop = `${getSafeAreaValue(webApp, "top")}px`;
  const safeAreaBottom = `${getSafeAreaValue(webApp, "bottom")}px`;

  documentRoot.style.setProperty("--tg-viewport-height", viewportHeight);
  documentRoot.style.setProperty("--tg-viewport-stable-height", telegramStableHeight);
  documentRoot.style.setProperty("--tg-safe-area-top", safeAreaTop);
  documentRoot.style.setProperty("--tg-safe-area-bottom", safeAreaBottom);
  documentRoot.style.setProperty("--app-height", stableHeight);

  documentRoot.classList.toggle("tg-fullscreen", Boolean(webApp?.isFullscreen));
  documentRoot.classList.toggle("tg-expanded", Boolean(webApp?.isExpanded));
  documentRoot.classList.toggle("tg-mobile", webApp ? isMobileTelegramPlatform(webApp.platform) : false);

  logViewportSync(pendingViewportReason, "applied", {
    viewportHeight: snapshot.viewportHeight,
    viewportStableHeight: snapshot.viewportStableHeight,
    windowInnerHeight: snapshot.windowHeight,
    appliedAppHeight: stableHeight,
    platform: snapshot.platform,
    isDesktop: snapshot.isDesktop,
    isFullscreen: snapshot.isFullscreen,
    isExpanded: snapshot.isExpanded,
    fullscreenChanged,
    reopenDetected,
  });
};

const scheduleTelegramViewportCssSync = (reason: string) => {
  pendingViewportReason = reason;
  const snapshot = getRawViewportSnapshot();

  if (pendingViewportTimer) {
    window.clearTimeout(pendingViewportTimer);
  }

  logViewportSync(reason, "scheduled", {
    viewportHeight: snapshot.viewportHeight,
    viewportStableHeight: snapshot.viewportStableHeight,
    windowInnerHeight: snapshot.windowHeight,
    previousStableHeight: appliedStableHeight || null,
    platform: snapshot.platform,
    isDesktop: snapshot.isDesktop,
    isFullscreen: snapshot.isFullscreen,
  });

  pendingViewportTimer = window.setTimeout(() => {
    pendingViewportTimer = 0;
    syncTelegramViewportCss();
  }, VIEWPORT_DEBOUNCE_MS);
};

const expandFullscreen = () => {
  const webApp = getWebApp();
  if (!webApp) {
    scheduleTelegramViewportCssSync("no_webapp_expand");
    return;
  }

  safeCall(() => webApp.expand?.());
  safeCall(() => webApp.requestFullscreen?.());
  scheduleTelegramViewportCssSync("expand_fullscreen");
};

let telegramFullscreenInitialized = false;
let windowViewportListenersInitialized = false;

const handleViewportChanged: TelegramViewportHandler = () => {
  scheduleTelegramViewportCssSync("telegram_viewport_changed");
};

const handleWindowViewportChanged = () => {
  scheduleTelegramViewportCssSync("window_resize");
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
    scheduleTelegramViewportCssSync("no_webapp_init");
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

export const getTelegramInitData = () => getWebApp()?.initData ?? "";

export const shareTelegramInvite = (url: string, text: string) => {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const webApp = getWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(shareUrl);
    return;
  }
  window.open(shareUrl, "_blank", "noopener,noreferrer");
};
