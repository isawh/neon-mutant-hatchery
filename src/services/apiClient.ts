import type { GameState } from "../types";
import { getTelegramInitData } from "../telegram";

type ApiAuthResponse = {
  playerId: string;
  telegramUser: unknown;
  isNewPlayer: boolean;
  player?: {
    id: string;
    referralCode: string;
    referredBy: string | null;
  };
};

type CloudSaveResponse = {
  gameState: GameState | null;
  updatedAt: string | null;
};

export type ReferralReward = {
  gems?: number;
  eggs?: number;
  premiumCapsules?: number;
  rareChanceBonus?: number;
  exclusiveColor?: string;
};

export type BackendReferralMilestone = {
  invites: number;
  label: string;
  reward: ReferralReward;
  claimed: boolean;
  claimable: boolean;
};

export type BackendReferralStats = {
  playerId: string;
  referralCode: string;
  referredBy: string | null;
  inviteCount: number;
  claimedMilestones: number[];
  milestones: BackendReferralMilestone[];
};

export type ReferralRegisterResponse = {
  ok: boolean;
  registered: boolean;
  rewardPending: boolean;
  reason?: string;
  invitedReward?: ReferralReward;
};

export type ReferralClaimResponse = {
  ok: boolean;
  claimed: boolean;
  milestone?: number;
  reward?: ReferralReward;
  reason?: string;
  stats?: BackendReferralStats;
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
): Promise<ReferralRegisterResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<ReferralRegisterResponse>("/api/referral/register", {
    method: "POST",
    body: JSON.stringify({ playerId, referralCode }),
  });
};

export const loadReferralStats = async (playerId: string): Promise<BackendReferralStats | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<BackendReferralStats>(`/api/referral/${encodeURIComponent(playerId)}`);
};

export const claimReferralMilestoneWithBackend = async (
  playerId: string,
  milestone: number,
): Promise<ReferralClaimResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<ReferralClaimResponse>("/api/referral/claim", {
    method: "POST",
    body: JSON.stringify({ playerId, milestone }),
  });
};

export const simulateReferralWithBackend = async (playerId: string): Promise<ReferralRegisterResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<ReferralRegisterResponse>("/api/referral/simulate", {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
};
