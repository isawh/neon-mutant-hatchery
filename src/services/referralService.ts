import { INVITE_MILESTONES } from "../constants";
import type { GameState } from "../types";

export const generateReferralCode = () =>
  `NEON${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export const ensureReferralCode = (state: GameState): GameState =>
  state.referralCode ? state : { ...state, referralCode: generateReferralCode() };

export const buildReferralLink = (code: string) => {
  const origin = typeof window === "undefined" ? import.meta.env.VITE_PUBLIC_APP_URL : window.location.origin;
  return `${origin}?ref=${encodeURIComponent(code)}`;
};

export const registerIncomingReferral = (state: GameState, code: string): GameState => {
  // Backend needed: validate referral code, prevent duplicate/device-farmed claims, and reward inviter.
  if (!code || code === state.referralCode || state.referralRewardClaimed) {
    return state;
  }

  return {
    ...state,
    referredBy: code,
    referralRewardClaimed: true,
    premiumCapsules: state.premiumCapsules + 1,
    lastActiveAt: Date.now(),
  };
};

export const claimReferralMilestone = (state: GameState, id: number): GameState | null => {
  // Backend needed: milestone eligibility should come from server-confirmed invite conversions.
  const milestone = INVITE_MILESTONES.find((item) => item.invites === id);
  if (!milestone || state.inviteCount < id || state.claimedInviteMilestones.includes(id)) {
    return null;
  }

  const reward = milestone.reward;
  return {
    ...state,
    gems: state.gems + (reward.gems ?? 0),
    eggs: state.eggs + (reward.eggs ?? 0),
    premiumCapsules: state.premiumCapsules + (reward.premiumCapsules ?? 0),
    rareChanceBonus: state.rareChanceBonus + (reward.rareChanceBonus ?? 0),
    exclusiveColors: reward.exclusiveColor
      ? Array.from(new Set([...state.exclusiveColors, reward.exclusiveColor]))
      : state.exclusiveColors,
    claimedInviteMilestones: [...state.claimedInviteMilestones, id],
    lastActiveAt: Date.now(),
  };
};

export const syncReferralStats = (state: GameState): GameState => {
  // Backend needed: pull authoritative invite count, conversion list, and inviter rewards.
  return ensureReferralCode(state);
};
