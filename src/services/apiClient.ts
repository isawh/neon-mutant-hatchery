import type { GameState } from "../types";
import { getTelegramInitData } from "../telegram";

type ApiAuthResponse = {
  playerId: string;
  telegramUser: unknown;
  isNewPlayer: boolean;
};

type CloudSaveResponse = {
  gameState: GameState | null;
  updatedAt: string | null;
};

const getApiBaseUrl = () => {
  const value = import.meta.env.VITE_API_URL;
  return typeof value === "string" ? value.replace(/\/+$/, "") : "";
};

const requestJson = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Backend API is not configured.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const isBackendConfigured = () => Boolean(getApiBaseUrl());

export const authenticateWithTelegram = async (): Promise<ApiAuthResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<ApiAuthResponse>("/api/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData: getTelegramInitData() }),
  });
};

export const loadCloudSave = async (playerId: string): Promise<CloudSaveResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<CloudSaveResponse>(`/api/player/${encodeURIComponent(playerId)}/save`);
};

export const saveCloudSave = async (playerId: string, gameState: GameState): Promise<CloudSaveResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<CloudSaveResponse>(`/api/player/${encodeURIComponent(playerId)}/save`, {
    method: "POST",
    body: JSON.stringify({ gameState }),
  });
};

export const registerReferralWithBackend = async (
  playerId: string,
  referralCode: string,
): Promise<{ ok: boolean; registered: boolean; rewardPending: boolean } | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<{ ok: boolean; registered: boolean; rewardPending: boolean }>("/api/referral/register", {
    method: "POST",
    body: JSON.stringify({ playerId, referralCode }),
  });
};
