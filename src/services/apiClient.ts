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

const PRODUCTION_FRONTEND_HOST = "neon-mutant-hatchery.vercel.app";
const PRODUCTION_FALLBACK_API_URL = "https://neon-mutant-hatchery.onrender.com";

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

export type ReferralSimulateResponse = ReferralRegisterResponse & {
  playerId: string;
  stats: BackendReferralStats | null;
};

export type BackendProduct = {
  id: string;
  section: "capsules" | "gems" | "boosts" | "limited";
  title: string;
  description: string;
  starsPrice: number;
  rewardLabel: string;
  reward: ReferralReward & {
    incomeBoostMinutes?: number;
    luckyBoostMinutes?: number;
    mutationStormTickets?: number;
  };
  enabled: boolean;
  badge?: "Best Value" | "Limited";
};

export type PaymentPurchase = {
  id: string;
  playerId: string;
  productId: string;
  starsPrice: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type CreateInvoiceResponse = {
  ok: boolean;
  mode: "dev_mock_available" | "telegram_stars_placeholder";
  purchase: PaymentPurchase;
  invoice: {
    productId: string;
    title: string;
    description: string;
    starsPrice: number;
    payload: string;
    invoiceLink: string | null;
  };
};

export type MockCompletePaymentResponse = {
  ok: boolean;
  purchase: PaymentPurchase;
  product: BackendProduct;
  reward: BackendProduct["reward"];
};

export type BackendHealthResponse = {
  ok: boolean;
};

export type ReferralClaimResponse = {
  ok: boolean;
  claimed: boolean;
  milestone?: number;
  reward?: ReferralReward;
  reason?: string;
  stats?: BackendReferralStats;
};

export const getRawApiUrl = () => {
  const value = import.meta.env.VITE_API_URL;
  return typeof value === "string" ? value : "";
};

const normalizeApiBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

export const getApiBaseUrl = () => {
  const rawValue = normalizeApiBaseUrl(getRawApiUrl());
  if (rawValue) {
    return rawValue;
  }

  if (
    typeof window !== "undefined" &&
    window.location.hostname.includes(PRODUCTION_FRONTEND_HOST)
  ) {
    return PRODUCTION_FALLBACK_API_URL;
  }

  return "";
};

const requestJson = async <T>(path: string, options?: RequestInit): Promise<T> => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("Backend API is not configured.");
  }

  if (import.meta.env.DEV || (typeof window !== "undefined" && window.location.search.includes("debugApi=1"))) {
    console.info("[api] baseUrl", baseUrl);
  }

  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    mode: "cors",
    credentials: "omit",
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API request failed: ${response.status}${body ? ` ${body}` : ""}`);
  }

  return response.json() as Promise<T>;
};

export const isBackendConfigured = () => Boolean(getApiBaseUrl());

export const checkBackendHealth = async (): Promise<BackendHealthResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<BackendHealthResponse>("/health");
};

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

export const loadBackendProducts = async (): Promise<BackendProduct[] | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  const response = await requestJson<{ products: BackendProduct[] }>("/api/products");
  return response.products;
};

export const createPaymentInvoice = async (
  playerId: string,
  productId: string,
): Promise<CreateInvoiceResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<CreateInvoiceResponse>("/api/payments/create-invoice", {
    method: "POST",
    body: JSON.stringify({ playerId, productId }),
  });
};

export const completeMockPayment = async (
  playerId: string,
  productId: string,
): Promise<MockCompletePaymentResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<MockCompletePaymentResponse>("/api/payments/mock-complete", {
    method: "POST",
    body: JSON.stringify({ playerId, productId }),
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

export const simulateReferralWithBackend = async (playerId: string): Promise<ReferralSimulateResponse | null> => {
  if (!isBackendConfigured()) {
    return null;
  }

  return requestJson<ReferralSimulateResponse>("/api/referral/simulate", {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
};
