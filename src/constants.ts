import type {
  DailyMission,
  GameState,
  LimitedOfferId,
  MissionId,
  PassiveTrait,
  Rarity,
  TabId,
} from "./types";

export const STORAGE_KEY = "neon-mutant-hatchery:v1";

export const INITIAL_STATE: GameState = {
  coins: 120,
  gems: 8,
  eggs: 3,
  premiumCapsules: 0,
  creatures: [],
  hatchStreak: 0,
  totalHatches: 0,
  discoveredCreatureNames: [],
  favoriteCreatureIds: [],
  referralCode: "",
  referredBy: "",
  referralRewardClaimed: false,
  inviteCount: 0,
  claimedInviteMilestones: [],
  exclusiveColors: [],
  rareChanceBonus: 0,
  dailyMissionDate: "",
  dailyMissions: [],
  activeEvent: null,
  lastRareEventRollAt: 0,
  limitedOfferDate: "",
  purchasedOfferIds: [],
  incomeBoostUntil: 0,
  luckyBoostUntil: 0,
  mutationStormTickets: 0,
  lastDailyRewardAt: 0,
  loginStreak: 1,
  lastLoginDate: "",
  freeCapsuleReadyAt: Date.now() + 10 * 60 * 1000,
  lastActiveAt: Date.now(),
};

export const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "hatch", label: "Hatch", icon: "capsule" },
  { id: "collection", label: "Collection", icon: "grid" },
  { id: "breed", label: "Breed", icon: "helix" },
  { id: "shop", label: "Shop", icon: "cart" },
  { id: "profile", label: "Profile", icon: "user" },
];

export const RARITY_ORDER: Rarity[] = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Secret"];

export const RARITY_CONFIG: Record<
  Rarity,
  { chance: number; minIncome: number; maxIncome: number; className: string }
> = {
  Common: { chance: 61.95, minIncome: 2, maxIncome: 6, className: "rarity-common" },
  Rare: { chance: 24, minIncome: 7, maxIncome: 14, className: "rarity-rare" },
  Epic: { chance: 10, minIncome: 15, maxIncome: 28, className: "rarity-epic" },
  Legendary: { chance: 3.5, minIncome: 32, maxIncome: 56, className: "rarity-legendary" },
  Mythic: { chance: 0.5, minIncome: 70, maxIncome: 110, className: "rarity-mythic" },
  Secret: { chance: 0.05, minIncome: 165, maxIncome: 240, className: "rarity-secret" },
};

export const TRAITS = [
  "Volt Horns",
  "Glass Spine",
  "Plasma Tail",
  "Chrome Shell",
  "Echo Eyes",
  "Ion Wings",
  "Acid Bloom",
  "Phase Claws",
  "Nova Gills",
  "Pulse Antenna",
  "Cryo Veins",
  "Solar Fangs",
];

export const PASSIVE_TRAIT_CONFIG: Record<
  PassiveTrait,
  { multiplier: number; label: string; description: string }
> = {
  Lucky: {
    multiplier: 1.08,
    label: "+8% income",
    description: "A small fortune field improves coin yield.",
  },
  Toxic: {
    multiplier: 1.14,
    label: "+14% income",
    description: "Corrosive metabolism converts waste into coins.",
  },
  Ancient: {
    multiplier: 1.22,
    label: "+22% income",
    description: "Old genetic memory improves idle output.",
  },
  Glitched: {
    multiplier: 1.3,
    label: "+30% income",
    description: "Unstable code spikes production.",
  },
  Radiant: {
    multiplier: 1.45,
    label: "+45% income",
    description: "Pure neon energy multiplies yield.",
  },
};

export const PASSIVE_TRAITS: PassiveTrait[] = ["Lucky", "Toxic", "Ancient", "Glitched", "Radiant"];

export const NAME_PREFIXES = [
  "Zyn",
  "Kiro",
  "Vexa",
  "Nyx",
  "Oro",
  "Muta",
  "Luma",
  "Xeno",
  "Iri",
  "Quon",
  "Astra",
  "Nero",
];

export const NAME_SUFFIXES = [
  "pod",
  "byte",
  "morph",
  "coil",
  "fang",
  "loom",
  "spark",
  "shade",
  "pulse",
  "drift",
  "nova",
  "flux",
];

export const PALETTE = [
  "#1df7ff",
  "#64ff73",
  "#f7f05a",
  "#ff4fd8",
  "#9b6dff",
  "#ff7a45",
  "#39ffb6",
  "#5aa7ff",
  "#ff3366",
  "#f2f7ff",
];

export const MAX_OFFLINE_MS = 12 * 60 * 60 * 1000;

export const HATCH_BASE_COST = 18;

export const FREE_CAPSULE_COOLDOWN_MS = 20 * 60 * 1000;

export const DAILY_REWARD = {
  coins: 180,
  gems: 1,
  eggs: 1,
};

export const INVITE_MILESTONES = [
  { invites: 1, reward: { gems: 2, premiumCapsules: 1 }, label: "2 gems + premium capsule" },
  { invites: 3, reward: { gems: 5, eggs: 2 }, label: "5 gems + 2 capsules" },
  { invites: 5, reward: { gems: 8, rareChanceBonus: 3 }, label: "8 gems + rare chance" },
  { invites: 10, reward: { gems: 15, premiumCapsules: 3, exclusiveColor: "#00ffd5" }, label: "Neon mint color" },
  { invites: 25, reward: { gems: 40, premiumCapsules: 8, exclusiveColor: "#ffffff" }, label: "Prismatic lab kit" },
];

export const DAILY_MISSION_POOL: Record<MissionId, Omit<DailyMission, "progress" | "claimed">> = {
  hatch_3: {
    id: "hatch_3",
    title: "Hatch 3 capsules",
    target: 3,
    reward: { coins: 120, eggs: 1 },
  },
  upgrade_1: {
    id: "upgrade_1",
    title: "Upgrade a creature",
    target: 1,
    reward: { coins: 160, gems: 1 },
  },
  breed_1: {
    id: "breed_1",
    title: "Breed creatures",
    target: 1,
    reward: { gems: 2, premiumCapsules: 1 },
  },
  collect_250: {
    id: "collect_250",
    title: "Collect 250 idle coins",
    target: 250,
    reward: { coins: 250, eggs: 1 },
  },
};

export const RARE_EVENTS = [
  {
    id: "glitched_capsule",
    title: "Glitched Capsule",
    description: "Premium and normal hatches get a rare-chance spike.",
    durationMs: 12 * 60 * 1000,
  },
  {
    id: "radiant_surge",
    title: "Radiant Surge",
    description: "Idle income is doubled for a short lab surge.",
    durationMs: 15 * 60 * 1000,
  },
  {
    id: "mutation_storm",
    title: "Mutation Storm",
    description: "Epic+ odds and mission rewards feel extra charged.",
    durationMs: 10 * 60 * 1000,
  },
] as const;

export const LIMITED_OFFERS: Record<
  LimitedOfferId,
  { title: string; body: string; cost: { coins?: number; gems?: number }; rewardLabel: string }
> = {
  premium_capsule: {
    title: "Discounted premium capsule",
    body: "A boosted capsule with better rare odds.",
    cost: { gems: 2 },
    rewardLabel: "+1 premium",
  },
  double_income: {
    title: "Double income boost",
    body: "Doubles idle income for 30 minutes.",
    cost: { coins: 240 },
    rewardLabel: "30m boost",
  },
  lucky_hatch: {
    title: "Lucky hatch boost",
    body: "Raises rare odds for the next 20 minutes.",
    cost: { gems: 3 },
    rewardLabel: "20m luck",
  },
};
