import type { GameState } from "../types";

export const generateReferralCode = () =>
  `NEON${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export const ensureReferralCode = (state: GameState): GameState =>
  state.referralCode ? state : { ...state, referralCode: generateReferralCode() };

export const buildReferralLink = (code: string) => {
  const botUsername = String(import.meta.env.VITE_BOT_USERNAME ?? "").replace(/^@/, "").trim();
  if (botUsername) {
    return `https://t.me/${botUsername}?startapp=${encodeURIComponent(code)}`;
  }

  const origin = typeof window === "undefined" ? import.meta.env.VITE_PUBLIC_APP_URL : window.location.origin;
  return `${origin}?startapp=${encodeURIComponent(code)}`;
};

export const registerIncomingReferral = (state: GameState, code: string): GameState => {
  void code;
  return state;
};

export const claimReferralMilestone = (state: GameState, id: number): GameState | null => {
  void state;
  void id;
  return null;
};

export const syncReferralStats = (state: GameState): GameState => {
  return ensureReferralCode(state);
};
