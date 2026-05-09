export type Rarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Secret";

export type PassiveTrait = "Lucky" | "Toxic" | "Ancient" | "Glitched" | "Radiant";

export type TabId = "hatch" | "collection" | "breed" | "shop" | "profile";

export type MissionId = "hatch_3" | "upgrade_1" | "breed_1" | "collect_250";

export type TutorialTaskId = "first_hatch" | "open_collection" | "upgrade_creature" | "claim_daily" | "open_shop";

export type AchievementId =
  | "hatch_10"
  | "hatch_50"
  | "hatch_100"
  | "own_5"
  | "own_20"
  | "own_50"
  | "first_rare"
  | "first_epic"
  | "first_legendary"
  | "first_mythic"
  | "first_secret"
  | "level_5"
  | "level_10"
  | "level_25"
  | "breed_1"
  | "breed_5"
  | "breed_20"
  | "invite_1"
  | "invite_3"
  | "invite_10";

export type RareEventId =
  | "glitched_capsule"
  | "double_hatch_luck"
  | "radiant_surge"
  | "mutation_storm"
  | "secret_hour";

export type LimitedOfferId = "premium_capsule" | "double_income" | "lucky_hatch";

export type SessionRewardId = "session_5" | "session_15" | "session_30";

export type ProgressionReward = {
  coins?: number;
  gems?: number;
  eggs?: number;
  premiumCapsules?: number;
  incomeBoostMinutes?: number;
  luckyBoostMinutes?: number;
};

export type DailyMission = {
  id: MissionId;
  title: string;
  progress: number;
  target: number;
  claimed: boolean;
  reward: ProgressionReward;
};

export type TutorialTask = {
  id: TutorialTaskId;
  title: string;
  body: string;
  completed: boolean;
  claimed: boolean;
  reward: ProgressionReward;
};

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  progress: number;
  target: number;
  claimed: boolean;
  reward: ProgressionReward;
};

export type ActiveRareEvent = {
  id: RareEventId;
  title: string;
  description: string;
  startsAt?: number;
  endsAt: number;
};

export type CreatureVisualDna = {
  bodyShape: string;
  eyeType: string;
  hornType: string;
  auraStyle: string;
  patternStyle: string;
  mutationEffect: string;
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
  visualDna: CreatureVisualDna;
  createdAt: number;
};

export type GameState = {
  coins: number;
  gems: number;
  eggs: number;
  premiumCapsules: number;
  creatures: Creature[];
  hatchStreak: number;
  lastHatchAt: number;
  hatchStreakExpiresAt: number;
  totalHatches: number;
  totalBreeds: number;
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
  claimedLoginRewardDate: string;
  loginStreak: number;
  lastLoginDate: string;
  freeCapsuleReadyAt: number;
  sessionStartedAt: number;
  claimedSessionRewards: SessionRewardId[];
  onboardingCompleted: boolean;
  starterRewardsClaimed: boolean;
  tutorialTasks: TutorialTask[];
  achievements: Achievement[];
  claimedAlbumRewards: Rarity[];
  fullAlbumRewardClaimed: boolean;
  lastActiveAt: number;
};

export type HatchResult = {
  state: GameState;
  creature: Creature;
};
