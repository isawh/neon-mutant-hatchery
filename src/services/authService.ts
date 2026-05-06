const PLAYER_ID_KEY = "neon-mutant-hatchery:player-id";

export type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type CurrentPlayer = {
  id: string;
  telegramUser: TelegramUser | null;
  isTelegram: boolean;
};

type TelegramWebAppUnsafe = {
  user?: TelegramUser;
};

const createLocalPlayerId = () =>
  `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const getTelegramWebApp = () =>
  (window as Window & {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: TelegramWebAppUnsafe;
      };
    };
  }).Telegram?.WebApp;

export const isTelegramEnvironment = () => Boolean(getTelegramWebApp());

export const getTelegramUser = (): TelegramUser | null => getTelegramWebApp()?.initDataUnsafe?.user ?? null;

export const getCurrentPlayer = (): CurrentPlayer => {
  const telegramUser = getTelegramUser();
  const telegramId = telegramUser?.id ? `tg_${telegramUser.id}` : "";
  if (telegramId) {
    return { id: telegramId, telegramUser, isTelegram: true };
  }

  let localId = localStorage.getItem(PLAYER_ID_KEY);
  if (!localId) {
    localId = createLocalPlayerId();
    localStorage.setItem(PLAYER_ID_KEY, localId);
  }

  return { id: localId, telegramUser, isTelegram: isTelegramEnvironment() };
};
