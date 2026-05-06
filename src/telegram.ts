type TelegramHapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type TelegramNotificationType = "error" | "success" | "warning";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  openTelegramLink?: (url: string) => void;
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

export const initTelegram = () => {
  const webApp = getWebApp();
  if (!webApp) {
    return;
  }

  webApp.ready?.();
  webApp.expand?.();
  webApp.requestFullscreen?.();
  webApp.disableVerticalSwipes?.();
};

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
