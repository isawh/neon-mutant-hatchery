import type {
  Achievement,
  DailyMission,
  GameState,
  LimitedOfferId,
  MissionId,
  PassiveTrait,
  Rarity,
  TabId,
  TutorialTask,
} from "./types";

export const STORAGE_KEY = "neon-mutant-hatchery:v1";

// Temporary development reset switch.
// Increase DEV_SAVE_RESET_VERSION to force all local saves to reset on every device after deploy.
export const DEV_SAVE_RESET_VERSION = "test-reset-001";

export const INITIAL_STATE: GameState = {
  coins: 0,
  gems: 0,
  eggs: 0,
  premiumCapsules: 0,
  creatures: [],
  hatchStreak: 0,
  totalHatches: 0,
  totalBreeds: 0,
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
  onboardingCompleted: false,
  starterRewardsClaimed: false,
  tutorialTasks: [],
  achievements: [],
  claimedAlbumRewards: [],
  fullAlbumRewardClaimed: false,
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

export const RARITY_ALBUM_GOALS: Record<
  Rarity,
  { total: number; reward: { coins?: number; gems?: number; eggs?: number; premiumCapsules?: number; incomeBoostMinutes?: number; luckyBoostMinutes?: number } }
> = {
  Common: { total: 12, reward: { coins: 260, eggs: 2 } },
  Rare: { total: 10, reward: { gems: 4, premiumCapsules: 1 } },
  Epic: { total: 8, reward: { gems: 8, premiumCapsules: 2, luckyBoostMinutes: 30 } },
  Legendary: { total: 5, reward: { gems: 16, premiumCapsules: 3, incomeBoostMinutes: 60 } },
  Mythic: { total: 3, reward: { gems: 30, premiumCapsules: 5, luckyBoostMinutes: 60 } },
  Secret: { total: 1, reward: { gems: 75, premiumCapsules: 10, incomeBoostMinutes: 120 } },
};

export const FULL_COLLECTION_REWARD = {
  gems: 125,
  premiumCapsules: 15,
  incomeBoostMinutes: 240,
  luckyBoostMinutes: 120,
};

export const RARITY_CONFIG: Record<
  Rarity,
  { chance: number; minIncome: number; maxIncome: number; className: string }
> = {
  Common: { chance: 61.95, minIncome: 7, maxIncome: 10, className: "rarity-common" },
  Rare: { chance: 24, minIncome: 12, maxIncome: 18, className: "rarity-rare" },
  Epic: { chance: 10, minIncome: 24, maxIncome: 36, className: "rarity-epic" },
  Legendary: { chance: 3.5, minIncome: 46, maxIncome: 72, className: "rarity-legendary" },
  Mythic: { chance: 0.5, minIncome: 92, maxIncome: 140, className: "rarity-mythic" },
  Secret: { chance: 0.05, minIncome: 220, maxIncome: 320, className: "rarity-secret" },
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

export const HATCH_BASE_COST = 26;

export const UPGRADE_BASE_COST = 82;

export const BREED_COIN_COST = 320;

export const BREED_GEM_COST = 1;

export const FREE_CAPSULE_COOLDOWN_MS = 20 * 60 * 1000;

export const DAILY_REWARD = {
  coins: 90,
  gems: 1,
  eggs: 1,
};

export const STARTER_REWARD = {
  eggs: 3,
  coins: 100,
  gems: 5,
};

export const TUTORIAL_TASKS: TutorialTask[] = [
  {
    id: "first_hatch",
    title: "Hatch your first capsule",
    body: "Open a capsule and reveal your first mutant.",
    completed: false,
    claimed: false,
    reward: { coins: 35 },
  },
  {
    id: "open_collection",
    title: "Open Collection",
    body: "See every mutant you have discovered.",
    completed: false,
    claimed: false,
    reward: { gems: 1 },
  },
  {
    id: "upgrade_creature",
    title: "Upgrade a creature",
    body: "Spend coins to increase idle income.",
    completed: false,
    claimed: false,
    reward: { coins: 75 },
  },
  {
    id: "claim_daily",
    title: "Claim daily reward",
    body: "Start your return streak and get supplies.",
    completed: false,
    claimed: false,
    reward: { eggs: 1 },
  },
  {
    id: "open_shop",
    title: "Open Shop",
    body: "Preview Stars products and free-to-play offers.",
    completed: false,
    claimed: false,
    reward: { gems: 1, coins: 50 },
  },
];

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "hatch_10",
    title: "Capsule Opener I",
    description: "Hatch 10 capsules.",
    progress: 0,
    target: 10,
    claimed: false,
    reward: { coins: 250, eggs: 1 },
  },
  {
    id: "hatch_50",
    title: "Capsule Opener II",
    description: "Hatch 50 capsules.",
    progress: 0,
    target: 50,
    claimed: false,
    reward: { gems: 8, premiumCapsules: 2 },
  },
  {
    id: "hatch_100",
    title: "Capsule Opener III",
    description: "Hatch 100 capsules.",
    progress: 0,
    target: 100,
    claimed: false,
    reward: { gems: 18, premiumCapsules: 4, luckyBoostMinutes: 60 },
  },
  {
    id: "own_5",
    title: "Small Colony",
    description: "Own 5 creatures.",
    progress: 0,
    target: 5,
    claimed: false,
    reward: { coins: 400 },
  },
  {
    id: "own_20",
    title: "Growing Lab",
    description: "Own 20 creatures.",
    progress: 0,
    target: 20,
    claimed: false,
    reward: { gems: 10, eggs: 3 },
  },
  {
    id: "own_50",
    title: "Mutant Reserve",
    description: "Own 50 creatures.",
    progress: 0,
    target: 50,
    claimed: false,
    reward: { gems: 25, premiumCapsules: 5 },
  },
  {
    id: "first_rare",
    title: "Rare Signal",
    description: "Get your first Rare creature.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { coins: 250, gems: 2 },
  },
  {
    id: "first_epic",
    title: "Epic Breakthrough",
    description: "Get your first Epic creature.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { gems: 6, premiumCapsules: 1 },
  },
  {
    id: "first_legendary",
    title: "Legendary Genome",
    description: "Get your first Legendary creature.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { gems: 14, premiumCapsules: 2, incomeBoostMinutes: 60 },
  },
  {
    id: "first_mythic",
    title: "Mythic Pulse",
    description: "Get your first Mythic creature.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { gems: 30, premiumCapsules: 4, luckyBoostMinutes: 60 },
  },
  {
    id: "first_secret",
    title: "Secret Specimen",
    description: "Get your first Secret creature.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { gems: 90, premiumCapsules: 10, incomeBoostMinutes: 180 },
  },
  {
    id: "level_5",
    title: "Level 5 Mutant",
    description: "Upgrade any creature to level 5.",
    progress: 0,
    target: 5,
    claimed: false,
    reward: { coins: 900, gems: 3 },
  },
  {
    id: "level_10",
    title: "Level 10 Mutant",
    description: "Upgrade any creature to level 10.",
    progress: 0,
    target: 10,
    claimed: false,
    reward: { gems: 12, premiumCapsules: 2, incomeBoostMinutes: 60 },
  },
  {
    id: "level_25",
    title: "Apex Mutant",
    description: "Upgrade any creature to level 25.",
    progress: 0,
    target: 25,
    claimed: false,
    reward: { gems: 45, premiumCapsules: 8, incomeBoostMinutes: 180 },
  },
  {
    id: "breed_1",
    title: "First Fusion",
    description: "Breed creatures once.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { coins: 500, gems: 2 },
  },
  {
    id: "breed_5",
    title: "Fusion Routine",
    description: "Breed creatures 5 times.",
    progress: 0,
    target: 5,
    claimed: false,
    reward: { gems: 10, premiumCapsules: 2 },
  },
  {
    id: "breed_20",
    title: "Gene Architect",
    description: "Breed creatures 20 times.",
    progress: 0,
    target: 20,
    claimed: false,
    reward: { gems: 35, premiumCapsules: 6, luckyBoostMinutes: 90 },
  },
  {
    id: "invite_1",
    title: "First Invite",
    description: "Invite 1 friend.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { gems: 3 },
  },
  {
    id: "invite_3",
    title: "Lab Circle",
    description: "Invite 3 friends.",
    progress: 0,
    target: 3,
    claimed: false,
    reward: { gems: 8, premiumCapsules: 1 },
  },
  {
    id: "invite_10",
    title: "Viral Hatchery",
    description: "Invite 10 friends.",
    progress: 0,
    target: 10,
    claimed: false,
    reward: { gems: 25, premiumCapsules: 4, luckyBoostMinutes: 60 },
  },
];

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
