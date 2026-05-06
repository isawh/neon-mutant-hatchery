export type Rarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";

export type PassiveTrait = "Lucky" | "Toxic" | "Ancient" | "Glitched" | "Radiant";

export type TabId = "hatch" | "collection" | "breed" | "shop" | "profile";

export type MissionId = "hatch_3" | "upgrade_1" | "breed_1" | "collect_250";

export type RareEventId = "glitched_capsule" | "radiant_surge" | "mutation_storm";

export type LimitedOfferId = "premium_capsule" | "double_income" | "lucky_hatch";

export type DailyMission = {
  id: MissionId;
  title: string;
  progress: number;
  target: number;
  claimed: boolean;
  reward: {
    coins?: number;
    gems?: number;
    eggs?: number;
    premiumCapsules?: number;
  };
};

export type ActiveRareEvent = {
  id: RareEventId;
  title: string;
  description: string;
  endsAt: number;
};

export type Creature = {
  id: string;
  name: string;
  rarity: Rarity;
  generation: number;
  level: number;
  incomePerMinute: number;
  traits: string[];
  passiveTraits: PassiveTrait[];
  powerScore: number;
  isNew: boolean;
  colors: {
    body: string;
    accent: string;
    glow: string;
    eye: string;
  };
  createdAt: number;
};

export type GameState = {
  coins: number;
  gems: number;
  eggs: number;
  premiumCapsules: number;
  creatures: Creature[];
  hatchStreak: number;
  totalHatches: number;
  discoveredCreatureNames: string[];
  favoriteCreatureIds: string[];
  referralCode: string;
  referredBy: string;
  referralRewardClaimed: boolean;
  inviteCount: number;
  claimedInviteMilestones: number[];
  exclusiveColors: string[];
  rareChanceBonus: number;
  dailyMissionDate: string;
  dailyMissions: DailyMission[];
  activeEvent: ActiveRareEvent | null;
  lastRareEventRollAt: number;
  limitedOfferDate: string;
  purchasedOfferIds: LimitedOfferId[];
  incomeBoostUntil: number;
  luckyBoostUntil: number;
  mutationStormTickets: number;
  lastDailyRewardAt: number;
  loginStreak: number;
  lastLoginDate: string;
  freeCapsuleReadyAt: number;
  lastActiveAt: number;
};

export type HatchResult = {
  state: GameState;
  creature: Creature;
};
