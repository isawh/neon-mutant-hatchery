import {
  DAILY_MISSION_POOL,
  DEV_SAVE_RESET_VERSION,
  INITIAL_STATE,
  PASSIVE_TRAIT_CONFIG,
  RARITY_ORDER,
  STORAGE_KEY,
  TUTORIAL_TASKS,
} from "./constants";
import { clearAnalyticsEvents } from "./services/analyticsService";
import type {
  ActiveRareEvent,
  Creature,
  DailyMission,
  GameState,
  LimitedOfferId,
  MissionId,
  PassiveTrait,
  TutorialTask,
  TutorialTaskId,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const DEV_SAVE_RESET_VERSION_KEY = `${STORAGE_KEY}:dev-reset-version`;

export const getStoredDevSaveResetVersion = () => {
  try {
    return localStorage.getItem(DEV_SAVE_RESET_VERSION_KEY) ?? "";
  } catch {
    return "";
  }
};

const writeStoredDevSaveResetVersion = () => {
  try {
    localStorage.setItem(DEV_SAVE_RESET_VERSION_KEY, DEV_SAVE_RESET_VERSION);
  } catch {
    // Storage can fail inside restrictive in-app browsers. The game should remain playable.
  }
};

const clearLocalSaveForDevReset = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures and continue with an in-memory fresh state.
  }
  clearAnalyticsEvents();
};

const ensureDevSaveResetVersion = () => {
  const storedVersion = getStoredDevSaveResetVersion();
  if (storedVersion === DEV_SAVE_RESET_VERSION) {
    return false;
  }

  clearLocalSaveForDevReset();
  writeStoredDevSaveResetVersion();
  return true;
};

const isPassiveTrait = (value: unknown): value is PassiveTrait =>
  typeof value === "string" && value in PASSIVE_TRAIT_CONFIG;

const isMissionId = (value: unknown): value is MissionId =>
  typeof value === "string" && value in DAILY_MISSION_POOL;

const isLimitedOfferId = (value: unknown): value is LimitedOfferId =>
  value === "premium_capsule" || value === "double_income" || value === "lucky_hatch";

const isTutorialTaskId = (value: unknown): value is TutorialTaskId =>
  typeof value === "string" && TUTORIAL_TASKS.some((task) => task.id === value);

const getTraitMultiplier = (creature: Creature) =>
  creature.passiveTraits.reduce(
    (multiplier, trait) => multiplier * PASSIVE_TRAIT_CONFIG[trait].multiplier,
    1,
  );

const getPowerScore = (creature: Creature) =>
  Math.round(
    creature.incomePerMinute * creature.level * getTraitMultiplier(creature) * 11 +
      creature.level * 28 +
      creature.generation * 14 +
      (RARITY_ORDER.indexOf(creature.rarity) + 1) * 70 +
      creature.passiveTraits.length * 34,
  );

const normalizeCreature = (value: unknown): Creature | null => {
  if (!isRecord(value)) {
    return null;
  }

  const rarity = RARITY_ORDER.includes(value.rarity as Creature["rarity"])
    ? (value.rarity as Creature["rarity"])
    : "Common";
  const colors = isRecord(value.colors)
    ? {
        body: typeof value.colors.body === "string" ? value.colors.body : "#1df7ff",
        accent: typeof value.colors.accent === "string" ? value.colors.accent : "#ff4fd8",
        glow: typeof value.colors.glow === "string" ? value.colors.glow : "#64ff73",
        eye: typeof value.colors.eye === "string" ? value.colors.eye : "#f7f05a",
      }
    : { body: "#1df7ff", accent: "#ff4fd8", glow: "#64ff73", eye: "#f7f05a" };

  const creature: Creature = {
    id: typeof value.id === "string" ? value.id : `${Date.now()}-${Math.random()}`,
    name: typeof value.name === "string" ? value.name : "Zyn-pod",
    rarity,
    generation: typeof value.generation === "number" ? value.generation : 1,
    level: typeof value.level === "number" ? value.level : 1,
    incomePerMinute: typeof value.incomePerMinute === "number" ? value.incomePerMinute : 2,
    traits: Array.isArray(value.traits) ? value.traits.filter((trait) => typeof trait === "string") : [],
    passiveTraits: Array.isArray(value.passiveTraits)
      ? value.passiveTraits.filter(isPassiveTrait)
      : [],
    powerScore: 0,
    isNew: typeof value.isNew === "boolean" ? value.isNew : false,
    colors,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
  };

  return {
    ...creature,
    powerScore: typeof value.powerScore === "number" ? value.powerScore : getPowerScore(creature),
  };
};

const normalizeMission = (value: unknown): DailyMission | null => {
  if (!isRecord(value) || !isMissionId(value.id)) {
    return null;
  }
  const base = DAILY_MISSION_POOL[value.id];
  return {
    ...base,
    progress: typeof value.progress === "number" ? value.progress : 0,
    claimed: typeof value.claimed === "boolean" ? value.claimed : false,
  };
};

const normalizeTutorialTasks = (value: unknown): TutorialTask[] => {
  const parsedTasks = Array.isArray(value) ? value : [];
  const taskMap = new Map<TutorialTaskId, TutorialTask>();

  parsedTasks.forEach((item) => {
    if (!isRecord(item) || !isTutorialTaskId(item.id)) {
      return;
    }
    const base = TUTORIAL_TASKS.find((task) => task.id === item.id);
    if (!base) {
      return;
    }
    taskMap.set(item.id, {
      ...base,
      completed: typeof item.completed === "boolean" ? item.completed : false,
      claimed: typeof item.claimed === "boolean" ? item.claimed : false,
    });
  });

  return TUTORIAL_TASKS.map((task) => taskMap.get(task.id) ?? { ...task });
};

const normalizeActiveEvent = (value: unknown): ActiveRareEvent | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (
    value.id !== "glitched_capsule" &&
    value.id !== "radiant_surge" &&
    value.id !== "mutation_storm"
  ) {
    return null;
  }
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Rare event",
    description: typeof value.description === "string" ? value.description : "Temporary lab boost.",
    endsAt: typeof value.endsAt === "number" ? value.endsAt : 0,
  };
};

export const loadGameState = (): GameState => {
  try {
    if (ensureDevSaveResetVersion()) {
      return { ...INITIAL_STATE, lastActiveAt: Date.now() };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return INITIAL_STATE;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return INITIAL_STATE;
    }

    const creatures = Array.isArray(parsed.creatures)
      ? parsed.creatures.map(normalizeCreature).filter((creature): creature is Creature => Boolean(creature))
      : INITIAL_STATE.creatures;
    const discoveredCreatureNames = Array.isArray(parsed.discoveredCreatureNames)
      ? parsed.discoveredCreatureNames.filter((name) => typeof name === "string")
      : creatures.map((creature) => creature.name);
    const hasLegacyProgress =
      creatures.length > 0 ||
      (typeof parsed.totalHatches === "number" && parsed.totalHatches > 0) ||
      (typeof parsed.lastDailyRewardAt === "number" && parsed.lastDailyRewardAt > 0) ||
      (typeof parsed.inviteCount === "number" && parsed.inviteCount > 0);

    return {
      coins: typeof parsed.coins === "number" ? parsed.coins : INITIAL_STATE.coins,
      gems: typeof parsed.gems === "number" ? parsed.gems : INITIAL_STATE.gems,
      eggs: typeof parsed.eggs === "number" ? parsed.eggs : INITIAL_STATE.eggs,
      premiumCapsules:
        typeof parsed.premiumCapsules === "number" ? parsed.premiumCapsules : INITIAL_STATE.premiumCapsules,
      creatures,
      hatchStreak: typeof parsed.hatchStreak === "number" ? parsed.hatchStreak : INITIAL_STATE.hatchStreak,
      totalHatches: typeof parsed.totalHatches === "number" ? parsed.totalHatches : creatures.length,
      discoveredCreatureNames,
      favoriteCreatureIds: Array.isArray(parsed.favoriteCreatureIds)
        ? parsed.favoriteCreatureIds.filter((id) => typeof id === "string")
        : INITIAL_STATE.favoriteCreatureIds,
      referralCode: typeof parsed.referralCode === "string" ? parsed.referralCode : INITIAL_STATE.referralCode,
      referredBy: typeof parsed.referredBy === "string" ? parsed.referredBy : INITIAL_STATE.referredBy,
      referralRewardClaimed:
        typeof parsed.referralRewardClaimed === "boolean"
          ? parsed.referralRewardClaimed
          : INITIAL_STATE.referralRewardClaimed,
      inviteCount: typeof parsed.inviteCount === "number" ? parsed.inviteCount : INITIAL_STATE.inviteCount,
      claimedInviteMilestones: Array.isArray(parsed.claimedInviteMilestones)
        ? parsed.claimedInviteMilestones.filter((invite) => typeof invite === "number")
        : INITIAL_STATE.claimedInviteMilestones,
      exclusiveColors: Array.isArray(parsed.exclusiveColors)
        ? parsed.exclusiveColors.filter((color) => typeof color === "string")
        : INITIAL_STATE.exclusiveColors,
      rareChanceBonus:
        typeof parsed.rareChanceBonus === "number" ? parsed.rareChanceBonus : INITIAL_STATE.rareChanceBonus,
      dailyMissionDate:
        typeof parsed.dailyMissionDate === "string" ? parsed.dailyMissionDate : INITIAL_STATE.dailyMissionDate,
      dailyMissions: Array.isArray(parsed.dailyMissions)
        ? parsed.dailyMissions.map(normalizeMission).filter((mission): mission is DailyMission => Boolean(mission))
        : INITIAL_STATE.dailyMissions,
      activeEvent: normalizeActiveEvent(parsed.activeEvent),
      lastRareEventRollAt:
        typeof parsed.lastRareEventRollAt === "number"
          ? parsed.lastRareEventRollAt
          : INITIAL_STATE.lastRareEventRollAt,
      limitedOfferDate:
        typeof parsed.limitedOfferDate === "string" ? parsed.limitedOfferDate : INITIAL_STATE.limitedOfferDate,
      purchasedOfferIds: Array.isArray(parsed.purchasedOfferIds)
        ? parsed.purchasedOfferIds.filter(isLimitedOfferId)
        : INITIAL_STATE.purchasedOfferIds,
      incomeBoostUntil:
        typeof parsed.incomeBoostUntil === "number" ? parsed.incomeBoostUntil : INITIAL_STATE.incomeBoostUntil,
      luckyBoostUntil:
        typeof parsed.luckyBoostUntil === "number" ? parsed.luckyBoostUntil : INITIAL_STATE.luckyBoostUntil,
      mutationStormTickets:
        typeof parsed.mutationStormTickets === "number"
          ? parsed.mutationStormTickets
          : INITIAL_STATE.mutationStormTickets,
      lastDailyRewardAt:
        typeof parsed.lastDailyRewardAt === "number" ? parsed.lastDailyRewardAt : INITIAL_STATE.lastDailyRewardAt,
      loginStreak: typeof parsed.loginStreak === "number" ? parsed.loginStreak : INITIAL_STATE.loginStreak,
      lastLoginDate: typeof parsed.lastLoginDate === "string" ? parsed.lastLoginDate : INITIAL_STATE.lastLoginDate,
      freeCapsuleReadyAt:
        typeof parsed.freeCapsuleReadyAt === "number"
          ? parsed.freeCapsuleReadyAt
          : INITIAL_STATE.freeCapsuleReadyAt,
      onboardingCompleted:
        typeof parsed.onboardingCompleted === "boolean" ? parsed.onboardingCompleted : hasLegacyProgress,
      starterRewardsClaimed:
        typeof parsed.starterRewardsClaimed === "boolean" ? parsed.starterRewardsClaimed : hasLegacyProgress,
      tutorialTasks: normalizeTutorialTasks(parsed.tutorialTasks),
      lastActiveAt:
        typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : INITIAL_STATE.lastActiveAt,
    };
  } catch {
    return INITIAL_STATE;
  }
};

export const saveGameState = (state: GameState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail inside restrictive in-app browsers. The game should remain playable.
  }
};

export const resetGameState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures and return a clean in-memory state.
  }
  return { ...INITIAL_STATE, lastActiveAt: Date.now() };
};

export const forceResetGameStateNow = () => {
  clearLocalSaveForDevReset();
  writeStoredDevSaveResetVersion();
  return { ...INITIAL_STATE, lastActiveAt: Date.now() };
};
