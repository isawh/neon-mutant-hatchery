import type {
  Achievement,
  DailyMission,
  GameState,
  LimitedOfferId,
  MissionId,
  PassiveTrait,
  Rarity,
  SessionRewardId,
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
  mutantShards: 0,
  creatures: [],
  hatchStreak: 0,
  lastHatchAt: 0,
  hatchStreakExpiresAt: 0,
  totalHatches: 0,
  totalBreeds: 0,
  discoveredCreatureNames: [],
  favoriteCreatureIds: [],
  equippedCreatureIds: [],
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
  claimedLoginRewardDate: "",
  loginStreak: 1,
  lastLoginDate: "",
  freeCapsuleReadyAt: Date.now() + 10 * 60 * 1000,
  sessionStartedAt: Date.now(),
  claimedSessionRewards: [],
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
  { id: "breed", label: "Fusion", icon: "helix" },
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
  Common: { chance: 72, minIncome: 7, maxIncome: 10, className: "rarity-common" },
  Rare: { chance: 22, minIncome: 12, maxIncome: 18, className: "rarity-rare" },
  Epic: { chance: 5, minIncome: 24, maxIncome: 36, className: "rarity-epic" },
  Legendary: { chance: 0.8, minIncome: 46, maxIncome: 72, className: "rarity-legendary" },
  Mythic: { chance: 0.18, minIncome: 92, maxIncome: 140, className: "rarity-mythic" },
  Secret: { chance: 0.02, minIncome: 220, maxIncome: 320, className: "rarity-secret" },
};

export const PREMIUM_RARITY_CHANCES: Record<Rarity, number> = {
  Common: 45,
  Rare: 35,
  Epic: 15,
  Legendary: 4,
  Mythic: 0.9,
  Secret: 0.1,
};

export const RARITY_CHANCE_CAPS: Partial<Record<Rarity, number>> = {
  Legendary: 6,
  Mythic: 1.5,
  Secret: 0.2,
};

export const DUPLICATE_SHARDS_BY_RARITY: Record<Rarity, number> = {
  Common: 2,
  Rare: 6,
  Epic: 14,
  Legendary: 35,
  Mythic: 80,
  Secret: 200,
};

export const TRAITS = [
  "Volt Antennae",
  "Glass Spine",
  "Plasma Leak",
  "Chrome Shell",
  "Echo Eyes",
  "Ion Shards",
  "Acid Bloom",
  "Phase Tendrils",
  "Nova Vents",
  "Pulse Antenna",
  "Cryo Veins",
  "Solar Cracks",
  "Mirror Carapace",
  "Static Blood",
  "Prism Jaw",
  "Neon Spores",
  "Void Tears",
  "Flux Arcs",
  "Quantum Scales",
  "Viral Halo",
  "Magnet Nodes",
  "Comet Shards",
  "Circuit Frill",
  "Gamma Bloom",
  "Floating Shards",
  "Orbit Particles",
  "Energy Leaks",
  "Extra Eyes",
  "Asym Growth",
  "Crystal Spikes",
  "Slime Drips",
  "Plasma Arcs",
  "Geo Mutation",
];

export const BODY_SHAPES = [
  "blob",
  "node",
  "slug",
  "helix",
  "vector",
  "asym",
  "disc",
  "tendril",
  "poly",
  "bud",
  "bean",
  "orb",
  "spindle",
  "crystal",
];

export const CREATURE_ARCHETYPES = [
  "jelly-mascot",
  "neon-slug",
  "floating-puff",
  "tiny-reactor-pet",
  "crystal-bunny-blob",
  "spiral-floater",
  "antenna-creature",
  "plasma-tadpole",
  "halo-jellyfish",
  "sleepy-biomech-orb",
  "prism-hopper",
  "star-parasite",
  "quantum-bean",
  "baby-reactor-core",
  "neon-axolotl-like-organism",
];

export const CREATURE_ARCHETYPE_LABELS: Record<string, string> = {
  "jelly-mascot": "Jelly Mascot",
  "neon-slug": "Neon Slug",
  "floating-puff": "Floating Puff",
  "tiny-reactor-pet": "Tiny Reactor Pet",
  "crystal-bunny-blob": "Crystal Bunny Blob",
  "spiral-floater": "Spiral Floater",
  "antenna-creature": "Antenna Creature",
  "plasma-tadpole": "Plasma Tadpole",
  "halo-jellyfish": "Halo Jellyfish",
  "sleepy-biomech-orb": "Sleepy Biomech Orb",
  "prism-hopper": "Prism Hopper",
  "star-parasite": "Star Parasite",
  "quantum-bean": "Quantum Bean",
  "baby-reactor-core": "Baby Reactor Core",
  "neon-axolotl-like-organism": "Neon Axolotl",
};

export const CREATURE_ARCHETYPE_ALIASES: Record<string, string> = {
  orb: "jelly-mascot",
  "tall-parasite": "antenna-creature",
  "segmented-worm": "neon-slug",
  "floating-prism": "prism-hopper",
  "asymmetrical-blob": "quantum-bean",
  "crystalline-cluster": "crystal-bunny-blob",
  "tripod-reactor": "tiny-reactor-pet",
  "split-body-mutant": "plasma-tadpole",
  "halo-organism": "halo-jellyfish",
  "jellyfish-entity": "halo-jellyfish",
  "biomech-eye": "sleepy-biomech-orb",
  "spiral-core": "spiral-floater",
};

export const EYE_TYPES = [
  "round",
  "slit",
  "visor",
  "triple",
  "mono",
  "wide",
  "diamond",
  "sleepy",
  "spark",
  "void",
  "ring",
  "glitch",
];

export const HORN_TYPES = [
  "short",
  "long",
  "curved",
  "antenna",
  "forked",
  "halo",
  "spikes",
  "fin",
  "crystal",
  "none",
];

export const AURA_STYLES = [
  "soft",
  "ring",
  "flare",
  "mist",
  "pulse",
  "static",
  "radial",
  "comet",
  "halo",
  "glitch",
];

export const PATTERN_STYLES = [
  "spots",
  "stripes",
  "ridges",
  "veins",
  "scales",
  "rings",
  "chevrons",
  "cells",
  "stars",
  "circuit",
  "cracks",
  "none",
];

export const MUTATION_EFFECTS = [
  "drip",
  "spark",
  "smoke",
  "orbit",
  "scan",
  "shimmer",
  "glitch",
  "flare",
  "dust",
  "ripple",
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
  "Kael",
  "Sova",
  "Rift",
  "Mire",
  "Talo",
  "Juno",
  "Hexa",
  "Voro",
  "Pryx",
  "Eon",
  "Coda",
  "Silex",
  "Axiom",
  "Vanta",
  "Cyra",
  "Boro",
];

export const NAME_SUFFIXES = [
  "pod",
  "byte",
  "morph",
  "coil",
  "rift",
  "loom",
  "spark",
  "shade",
  "pulse",
  "drift",
  "nova",
  "flux",
  "thorn",
  "mire",
  "quake",
  "wisp",
  "node",
  "arc",
  "spore",
  "gaze",
  "coil",
  "rift",
  "bloom",
  "flare",
  "spike",
  "veil",
  "glyph",
];

export const RARITY_NAME_TITLES: Record<Rarity, string[]> = {
  Common: ["Sprout", "Drifter", "Mote", "Pod"],
  Rare: ["Neon", "Chrome", "Prism", "Ion"],
  Epic: ["Alpha", "Nova", "Viral", "Apex"],
  Legendary: ["Prime", "Ancient", "Vector", "Titan"],
  Mythic: ["Astral", "Eclipse", "Genesis", "Celestial"],
  Secret: ["Anomaly", "Null", "Omega", "Paradox"],
};

export const SECRET_NAME_CORES = [
  "Null-9",
  "Parallax",
  "ZeroBloom",
  "GhostCircuit",
  "OmegaDrift",
  "NoSignal",
  "WhiteNoise",
  "VoidSaint",
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

export const UPGRADE_BASE_COST = 96;

export const BREED_COIN_COST = 320;

export const BREED_GEM_COST = 1;

export const FUSION_BASE_COIN_COST = 220;

export const FUSION_BASE_SHARD_COST = 8;

export const FREE_CAPSULE_COOLDOWN_MS = 20 * 60 * 1000;

export const HATCH_STREAK_TIMEOUT_MS = 30 * 60 * 1000;

export const HATCH_STREAK_LUCK_PER_HATCH = 0.55;

export const HATCH_STREAK_MAX_LUCK = 12;

export const EVENT_ROTATION_INTERVAL_MS = 45 * 60 * 1000;

export const DAILY_LOGIN_REWARDS = [
  { day: 1, reward: { coins: 90, eggs: 1 }, label: "90 coins + capsule" },
  { day: 2, reward: { coins: 140, gems: 1 }, label: "140 coins + gem" },
  { day: 3, reward: { coins: 190, eggs: 2 }, label: "190 coins + 2 capsules" },
  { day: 4, reward: { coins: 260, gems: 2 }, label: "260 coins + 2 gems" },
  { day: 5, reward: { coins: 340, eggs: 2 }, label: "340 coins + 2 capsules" },
  { day: 6, reward: { coins: 450, gems: 4, luckyBoostMinutes: 30 }, label: "450 coins + 30m luck" },
  { day: 7, reward: { gems: 8, premiumCapsules: 1, incomeBoostMinutes: 60 }, label: "Day 7 neon jackpot" },
] as const;

export const DAILY_REWARD = DAILY_LOGIN_REWARDS[0].reward;

export const SESSION_REWARDS: Array<{
  id: SessionRewardId;
  minutes: number;
  title: string;
  reward: { coins?: number; gems?: number; eggs?: number; premiumCapsules?: number; incomeBoostMinutes?: number; luckyBoostMinutes?: number };
}> = [
  { id: "session_5", minutes: 5, title: "5 minute lab check", reward: { gems: 1, eggs: 1 } },
  { id: "session_15", minutes: 15, title: "15 minute surge", reward: { gems: 2, eggs: 2 } },
  { id: "session_30", minutes: 30, title: "30 minute deep run", reward: { gems: 4, eggs: 3, luckyBoostMinutes: 20 } },
];

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
    description: "Fuse creatures once.",
    progress: 0,
    target: 1,
    claimed: false,
    reward: { coins: 500, gems: 2 },
  },
  {
    id: "breed_5",
    title: "Fusion Routine",
    description: "Fuse creatures 5 times.",
    progress: 0,
    target: 5,
    claimed: false,
    reward: { gems: 10, premiumCapsules: 2 },
  },
  {
    id: "breed_20",
    title: "Gene Architect",
    description: "Fuse creatures 20 times.",
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
    title: "Fuse creatures",
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
    id: "double_hatch_luck",
    title: "Double Hatch Luck",
    description: "Hatch streak luck counts double while the lab is hot.",
    durationMs: 25 * 60 * 1000,
  },
  {
    id: "radiant_surge",
    title: "Radiant Surge",
    description: "Idle income is doubled for a short lab surge.",
    durationMs: 22 * 60 * 1000,
  },
  {
    id: "mutation_storm",
    title: "Mutation Storm",
    description: "Epic+ odds and mission rewards feel extra charged.",
    durationMs: 20 * 60 * 1000,
  },
  {
    id: "secret_hour",
    title: "Secret Hour",
    description: "Secret rarity odds get a tiny unstable spike.",
    durationMs: 15 * 60 * 1000,
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
