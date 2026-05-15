import {
  ACHIEVEMENTS,
  AURA_STYLES,
  BODY_SHAPES,
  CREATURE_ARCHETYPES,
  FULL_COLLECTION_REWARD,
  RARITY_ALBUM_GOALS,
  DAILY_MISSION_POOL,
  DAILY_LOGIN_REWARDS,
  DUPLICATE_SHARDS_BY_RARITY,
  EYE_TYPES,
  EVENT_ROTATION_INTERVAL_MS,
  FUSION_BASE_COIN_COST,
  FUSION_BASE_SHARD_COST,
  FREE_CAPSULE_COOLDOWN_MS,
  HATCH_BASE_COST,
  HATCH_STREAK_LUCK_PER_HATCH,
  HATCH_STREAK_MAX_LUCK,
  HATCH_STREAK_TIMEOUT_MS,
  HORN_TYPES,
  LIMITED_OFFERS,
  MAX_OFFLINE_MS,
  MUTATION_EFFECTS,
  NAME_PREFIXES,
  NAME_SUFFIXES,
  PALETTE,
  PASSIVE_TRAIT_CONFIG,
  PASSIVE_TRAITS,
  PATTERN_STYLES,
  PREMIUM_RARITY_CHANCES,
  RARE_EVENTS,
  RARITY_CHANCE_CAPS,
  RARITY_CONFIG,
  RARITY_NAME_TITLES,
  RARITY_ORDER,
  SESSION_REWARDS,
  SECRET_NAME_CORES,
  STARTER_REWARD,
  TRAITS,
  TUTORIAL_TASKS,
  UPGRADE_BASE_COST,
} from "./constants";
import type {
  ActiveRareEvent,
  Creature,
  DailyMission,
  GameState,
  HatchResult,
  LimitedOfferId,
  MissionId,
  PassiveTrait,
  ProgressionReward,
  Rarity,
  AchievementId,
  SessionRewardId,
  TutorialTaskId,
} from "./types";

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const sample = <T,>(items: T[]): T => items[randomInt(0, items.length - 1)];

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

const dateKeyFromDateString = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? todayKey(parsed) : value;
};

const getMissionRotation = (now = Date.now()): DailyMission[] => {
  const ids = Object.keys(DAILY_MISSION_POOL) as MissionId[];
  const daySeed = Math.floor(now / 86400000);
  return [0, 1, 2].map((offset) => {
    const mission = DAILY_MISSION_POOL[ids[(daySeed + offset) % ids.length]];
    return { ...mission, progress: 0, claimed: false };
  });
};

export const ensureTutorialState = (state: GameState): GameState => {
  const existingTasks = new Map(state.tutorialTasks.map((task) => [task.id, task]));
  return {
    ...state,
    tutorialTasks: TUTORIAL_TASKS.map((task) => {
      const existing = existingTasks.get(task.id);
      return {
        ...task,
        completed: existing?.completed ?? task.completed,
        claimed: existing?.claimed ?? task.claimed,
      };
    }),
  };
};

export const applyStarterRewards = (state: GameState): GameState => {
  const tutorialState = ensureTutorialState(state);
  if (tutorialState.starterRewardsClaimed) {
    return tutorialState;
  }

  return {
    ...tutorialState,
    coins: tutorialState.coins + STARTER_REWARD.coins,
    gems: tutorialState.gems + STARTER_REWARD.gems,
    eggs: tutorialState.eggs + STARTER_REWARD.eggs,
    starterRewardsClaimed: true,
    lastActiveAt: Date.now(),
  };
};

export const completeTutorialTask = (state: GameState, taskId: TutorialTaskId): GameState => {
  const tutorialState = ensureTutorialState(state);
  if (tutorialState.tutorialTasks.find((task) => task.id === taskId)?.completed) {
    return tutorialState;
  }

  return {
    ...tutorialState,
    tutorialTasks: tutorialState.tutorialTasks.map((task) =>
      task.id === taskId ? { ...task, completed: true } : task,
    ),
    lastActiveAt: Date.now(),
  };
};

export const claimTutorialReward = (state: GameState, taskId: TutorialTaskId): GameState | null => {
  const tutorialState = ensureTutorialState(state);
  const task = tutorialState.tutorialTasks.find((item) => item.id === taskId);
  if (!task || !task.completed || task.claimed) {
    return null;
  }

  return {
    ...tutorialState,
    coins: tutorialState.coins + (task.reward.coins ?? 0),
    gems: tutorialState.gems + (task.reward.gems ?? 0),
    eggs: tutorialState.eggs + (task.reward.eggs ?? 0),
    premiumCapsules: tutorialState.premiumCapsules + (task.reward.premiumCapsules ?? 0),
    tutorialTasks: tutorialState.tutorialTasks.map((item) =>
      item.id === taskId ? { ...item, claimed: true } : item,
    ),
    lastActiveAt: Date.now(),
  };
};

export const resetOnboardingProgress = (state: GameState): GameState => ({
  ...state,
  onboardingCompleted: false,
  tutorialTasks: TUTORIAL_TASKS.map((task) => ({ ...task })),
  lastActiveAt: Date.now(),
});

const getAchievementProgress = (state: GameState, achievementId: AchievementId) => {
  const maxLevel = Math.max(0, ...state.creatures.map((creature) => creature.level));
  const hasRarity = (rarity: Rarity) => (state.creatures.some((creature) => creature.rarity === rarity) ? 1 : 0);

  switch (achievementId) {
    case "hatch_10":
    case "hatch_50":
    case "hatch_100":
      return state.totalHatches;
    case "own_5":
    case "own_20":
    case "own_50":
      return state.creatures.length;
    case "first_rare":
      return hasRarity("Rare");
    case "first_epic":
      return hasRarity("Epic");
    case "first_legendary":
      return hasRarity("Legendary");
    case "first_mythic":
      return hasRarity("Mythic");
    case "first_secret":
      return hasRarity("Secret");
    case "level_5":
    case "level_10":
    case "level_25":
      return maxLevel;
    case "breed_1":
    case "breed_5":
    case "breed_20":
      return state.totalBreeds;
    case "invite_1":
    case "invite_3":
    case "invite_10":
      return state.inviteCount;
    default:
      return 0;
  }
};

export const ensureProgressionState = (state: GameState): GameState => {
  const existingAchievements = new Map(state.achievements.map((achievement) => [achievement.id, achievement]));
  return {
    ...state,
    mutantShards: typeof state.mutantShards === "number" ? state.mutantShards : 0,
    equippedCreatureIds: Array.isArray(state.equippedCreatureIds) ? state.equippedCreatureIds : [],
    achievements: ACHIEVEMENTS.map((achievement) => {
      const existing = existingAchievements.get(achievement.id);
      return {
        ...achievement,
        progress: Math.min(achievement.target, getAchievementProgress(state, achievement.id)),
        claimed: existing?.claimed ?? false,
      };
    }),
    claimedAlbumRewards: state.claimedAlbumRewards.filter((rarity) => RARITY_ORDER.includes(rarity)),
    fullAlbumRewardClaimed: Boolean(state.fullAlbumRewardClaimed),
  };
};

export const getRarityAlbumProgress = (state: GameState, rarity: Rarity) => {
  const discovered = new Set(
    state.creatures.filter((creature) => creature.rarity === rarity).map((creature) => creature.name),
  ).size;
  const total = RARITY_ALBUM_GOALS[rarity].total;
  return {
    rarity,
    discovered: Math.min(discovered, total),
    total,
    complete: discovered >= total,
    claimed: state.claimedAlbumRewards.includes(rarity),
    reward: RARITY_ALBUM_GOALS[rarity].reward,
  };
};

export const getFullAlbumProgress = (state: GameState) => {
  const groups = RARITY_ORDER.map((rarity) => getRarityAlbumProgress(state, rarity));
  const discovered = groups.reduce((sum, group) => sum + group.discovered, 0);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  return {
    discovered,
    total,
    complete: groups.every((group) => group.complete),
    claimed: state.fullAlbumRewardClaimed,
    reward: FULL_COLLECTION_REWARD,
  };
};

const applyProgressionReward = (state: GameState, reward: ProgressionReward, now = Date.now()): GameState => ({
  ...state,
  coins: state.coins + (reward.coins ?? 0),
  gems: state.gems + (reward.gems ?? 0),
  eggs: state.eggs + (reward.eggs ?? 0),
  premiumCapsules: state.premiumCapsules + (reward.premiumCapsules ?? 0),
  incomeBoostUntil: reward.incomeBoostMinutes
    ? Math.max(state.incomeBoostUntil, now) + reward.incomeBoostMinutes * 60 * 1000
    : state.incomeBoostUntil,
  luckyBoostUntil: reward.luckyBoostMinutes
    ? Math.max(state.luckyBoostUntil, now) + reward.luckyBoostMinutes * 60 * 1000
    : state.luckyBoostUntil,
  lastActiveAt: now,
});

export const claimAchievementReward = (
  state: GameState,
  achievementId: AchievementId,
  now = Date.now(),
): GameState | null => {
  const progressionState = ensureProgressionState(state);
  const achievement = progressionState.achievements.find((item) => item.id === achievementId);
  if (!achievement || achievement.claimed || achievement.progress < achievement.target) {
    return null;
  }

  const rewarded = applyProgressionReward(progressionState, achievement.reward, now);
  return ensureProgressionState({
    ...rewarded,
    achievements: rewarded.achievements.map((item) =>
      item.id === achievementId ? { ...item, claimed: true } : item,
    ),
  });
};

export const claimAlbumReward = (state: GameState, rarity: Rarity, now = Date.now()): GameState | null => {
  const progressionState = ensureProgressionState(state);
  const album = getRarityAlbumProgress(progressionState, rarity);
  if (!album.complete || album.claimed) {
    return null;
  }

  return ensureProgressionState({
    ...applyProgressionReward(progressionState, album.reward, now),
    claimedAlbumRewards: [...progressionState.claimedAlbumRewards, rarity],
  });
};

export const claimFullAlbumReward = (state: GameState, now = Date.now()): GameState | null => {
  const progressionState = ensureProgressionState(state);
  const album = getFullAlbumProgress(progressionState);
  if (!album.complete || album.claimed) {
    return null;
  }

  return ensureProgressionState({
    ...applyProgressionReward(progressionState, album.reward, now),
    fullAlbumRewardClaimed: true,
  });
};

const progressMission = (state: GameState, missionId: MissionId, amount = 1): GameState => ({
  ...state,
  dailyMissions: state.dailyMissions.map((mission) =>
    mission.id === missionId
      ? { ...mission, progress: Math.min(mission.target, mission.progress + amount) }
      : mission,
  ),
});

const getRotatingEvent = (now = Date.now()): ActiveRareEvent | null => {
  const events = [...RARE_EVENTS];
  const slot = Math.floor(now / EVENT_ROTATION_INTERVAL_MS);
  const startsAt = slot * EVENT_ROTATION_INTERVAL_MS;
  const event = events[slot % events.length];
  const endsAt = startsAt + event.durationMs;
  if (endsAt <= now) {
    return null;
  }
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt,
    endsAt,
  };
};

export const ensureLiveOpsState = (state: GameState, now = Date.now()): GameState => {
  const date = todayKey(now);
  const needsMissions = state.dailyMissionDate !== date || state.dailyMissions.length === 0;
  const manualEvent =
    state.activeEvent && state.activeEvent.endsAt > now && !state.activeEvent.startsAt ? state.activeEvent : null;
  const activeEvent = manualEvent ?? getRotatingEvent(now);
  const hatchStreakActive = state.hatchStreak > 0 && state.hatchStreakExpiresAt > now;

  return {
    ...state,
    hatchStreak: hatchStreakActive ? state.hatchStreak : 0,
    hatchStreakExpiresAt: hatchStreakActive ? state.hatchStreakExpiresAt : 0,
    activeEvent,
    lastRareEventRollAt: activeEvent?.startsAt ?? state.lastRareEventRollAt,
    dailyMissionDate: needsMissions ? date : state.dailyMissionDate,
    dailyMissions: needsMissions ? getMissionRotation(now) : state.dailyMissions,
    limitedOfferDate: state.limitedOfferDate === date ? state.limitedOfferDate : date,
    purchasedOfferIds: state.limitedOfferDate === date ? state.purchasedOfferIds : [],
    sessionStartedAt: state.sessionStartedAt || now,
    claimedSessionRewards: state.claimedSessionRewards ?? [],
  };
};

export const getTraitMultiplier = (creature: Creature) =>
  creature.passiveTraits.reduce(
    (multiplier, trait) => multiplier * PASSIVE_TRAIT_CONFIG[trait].multiplier,
    1,
  );

export const getCreatureIncomePerMinute = (creature: Creature) =>
  Math.round(creature.incomePerMinute * creature.level * getTraitMultiplier(creature));

export const getBoostedIncomePerMinute = (state: GameState) => {
  const base = getTotalIncomePerMinute(state.creatures);
  const now = Date.now();
  const eventBoost = state.activeEvent?.id === "radiant_surge" && state.activeEvent.endsAt > now ? 2 : 1;
  const shopBoost = state.incomeBoostUntil > now ? 2 : 1;
  return Math.round(base * eventBoost * shopBoost);
};

export const getPowerScore = (creature: Creature) =>
  Math.round(
    getCreatureIncomePerMinute(creature) * 11 +
      creature.level * 28 +
      creature.generation * 14 +
      (RARITY_ORDER.indexOf(creature.rarity) + 1) * 70 +
      creature.passiveTraits.length * 34,
  );

export const getTotalIncomePerMinute = (creatures: Creature[]) =>
  creatures.reduce((sum, creature) => sum + getCreatureIncomePerMinute(creature), 0);

export const getHatchCost = (state: GameState) =>
  Math.round(HATCH_BASE_COST * Math.pow(1.16, Math.max(0, state.totalHatches)) + state.hatchStreak * 4);

export const getHatchStreakRemaining = (state: GameState, now = Date.now()) =>
  Math.max(0, state.hatchStreakExpiresAt - now);

export const getHatchStreakLuckBonus = (state: GameState, now = Date.now()) => {
  if (!state.hatchStreak || state.hatchStreakExpiresAt <= now) {
    return 0;
  }
  const eventMultiplier = state.activeEvent?.id === "double_hatch_luck" && state.activeEvent.endsAt > now ? 2 : 1;
  return Math.min(HATCH_STREAK_MAX_LUCK, state.hatchStreak * HATCH_STREAK_LUCK_PER_HATCH * eventMultiplier);
};

export const getUpgradeCost = (creature: Creature) =>
  Math.round(
    UPGRADE_BASE_COST *
      Math.pow(creature.level, 1.42) *
      (1 + RARITY_ORDER.indexOf(creature.rarity) * 0.62) *
      (1 + creature.passiveTraits.length * 0.08),
  );

export const getUpgradeShardCost = (creature: Creature) =>
  Math.max(4, Math.round((creature.level + 1) * (RARITY_ORDER.indexOf(creature.rarity) + 1) * 3.2));

export const getRarityChances = (state?: GameState, premium = false) => {
  const now = Date.now();
  const hatchStreakBonus = state ? getHatchStreakLuckBonus(state, now) : 0;
  const bonus =
    (state?.rareChanceBonus ?? 0) +
    hatchStreakBonus +
    (state?.luckyBoostUntil && state.luckyBoostUntil > now ? 6 : 0) +
    (state?.activeEvent?.id === "glitched_capsule" && state.activeEvent.endsAt > now ? 7 : 0) +
    (state?.activeEvent?.id === "mutation_storm" && state.activeEvent.endsAt > now ? 10 : 0) +
    (state?.activeEvent?.id === "secret_hour" && state.activeEvent.endsAt > now ? 4 : 0);

  const base = premium
    ? PREMIUM_RARITY_CHANCES
    : RARITY_ORDER.reduce(
        (record, rarity) => ({ ...record, [rarity]: RARITY_CONFIG[rarity].chance }),
        {} as Record<Rarity, number>,
      );

  const boosted: Record<Rarity, number> = {
    Common: base.Common,
    Rare: base.Rare + bonus * 0.42,
    Epic: base.Epic + bonus * 0.16,
    Legendary: Math.min(RARITY_CHANCE_CAPS.Legendary ?? base.Legendary, base.Legendary + bonus * 0.035),
    Mythic: Math.min(RARITY_CHANCE_CAPS.Mythic ?? base.Mythic, base.Mythic + bonus * 0.007),
    Secret: Math.min(RARITY_CHANCE_CAPS.Secret ?? base.Secret, base.Secret + bonus * 0.001),
  };

  const rareTotal = RARITY_ORDER.filter((rarity) => rarity !== "Common").reduce(
    (sum, rarity) => sum + boosted[rarity],
    0,
  );
  boosted.Common = Math.max(0, 100 - rareTotal);
  const total = RARITY_ORDER.reduce((sum, rarity) => sum + boosted[rarity], 0);

  return RARITY_ORDER.map((rarity) => ({
    rarity,
    chance: Number(((boosted[rarity] / total) * 100).toFixed(rarity === "Secret" ? 2 : 1)),
  }));
};

export const pickRarity = (state?: GameState, premium = false): Rarity => {
  const roll = Math.random() * 100;
  let cursor = 0;

  for (const { rarity, chance } of getRarityChances(state, premium)) {
    cursor += chance;
    if (roll <= cursor) {
      return rarity;
    }
  }

  return "Common";
};

const pickHatchRarity = (state: GameState, premium = false): Rarity => {
  if (state.totalHatches === 0) {
    return "Rare";
  }

  const rarity = pickRarity(state, premium);
  if (state.totalHatches < 3 && RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf("Legendary")) {
    return Math.random() > 0.32 ? "Rare" : "Epic";
  }

  return rarity;
};

const getPassiveTraitCount = (rarity: Rarity) => {
  const rank = RARITY_ORDER.indexOf(rarity);
  if (rank === 0) {
    return Math.random() > 0.7 ? 1 : 0;
  }
  if (rank === 1) {
    return 1;
  }
  if (rank === 2) {
    return Math.random() > 0.55 ? 2 : 1;
  }
  if (rank === 3) {
    return 2;
  }
  return 3;
};

const pickPassiveTraits = (rarity: Rarity, inheritedTraits: PassiveTrait[]) => {
  const traitCount = getPassiveTraitCount(rarity);
  const traits = new Set<PassiveTrait>();

  if (inheritedTraits.length && Math.random() > 0.35) {
    traits.add(sample(inheritedTraits));
  }

  while (traits.size < traitCount) {
    traits.add(sample(PASSIVE_TRAITS));
  }

  return Array.from(traits);
};

const ARCHETYPE_DNA: Record<
  string,
  {
    bodyShape: string[];
    eyeType: string[];
    hornType: string[];
    auraStyle: string[];
    patternStyle: string[];
    mutationEffect: string[];
  }
> = {
  orb: {
    bodyShape: ["orb", "disc", "bud"],
    eyeType: ["round", "wide", "mono"],
    hornType: ["none", "short", "antenna"],
    auraStyle: ["soft", "ring"],
    patternStyle: ["spots", "ridges", "none"],
    mutationEffect: ["ripple", "dust", "spark"],
  },
  "tall-parasite": {
    bodyShape: ["spindle", "tendril", "asym"],
    eyeType: ["slit", "mono", "void"],
    hornType: ["antenna", "curved", "forked"],
    auraStyle: ["mist", "static", "pulse"],
    patternStyle: ["veins", "cells", "ridges"],
    mutationEffect: ["drip", "scan", "ripple"],
  },
  "segmented-worm": {
    bodyShape: ["spindle", "helix", "tendril"],
    eyeType: ["slit", "wide", "triple"],
    hornType: ["none", "short", "antenna"],
    auraStyle: ["soft", "mist", "pulse"],
    patternStyle: ["rings", "stripes", "cells"],
    mutationEffect: ["ripple", "drip", "smoke"],
  },
  "floating-prism": {
    bodyShape: ["crystal", "poly", "vector"],
    eyeType: ["diamond", "spark", "ring"],
    hornType: ["crystal", "spikes", "forked"],
    auraStyle: ["flare", "radial", "halo"],
    patternStyle: ["cracks", "veins", "chevrons"],
    mutationEffect: ["shimmer", "flare", "spark"],
  },
  "asymmetrical-blob": {
    bodyShape: ["asym", "blob", "node"],
    eyeType: ["triple", "slit", "mono"],
    hornType: ["antenna", "forked", "short"],
    auraStyle: ["static", "mist", "pulse"],
    patternStyle: ["cells", "veins", "spots"],
    mutationEffect: ["drip", "scan", "ripple"],
  },
  "crystalline-cluster": {
    bodyShape: ["crystal", "poly", "spindle"],
    eyeType: ["diamond", "ring", "spark"],
    hornType: ["crystal", "spikes", "halo"],
    auraStyle: ["radial", "flare", "comet"],
    patternStyle: ["cracks", "chevrons", "stars"],
    mutationEffect: ["shimmer", "orbit", "flare"],
  },
  "tripod-reactor": {
    bodyShape: ["orb", "disc", "helix"],
    eyeType: ["ring", "visor", "spark"],
    hornType: ["halo", "fin", "crystal"],
    auraStyle: ["radial", "flare", "pulse"],
    patternStyle: ["rings", "circuit", "stars"],
    mutationEffect: ["shimmer", "flare", "scan"],
  },
  "split-body-mutant": {
    bodyShape: ["vector", "asym", "poly"],
    eyeType: ["visor", "void", "diamond"],
    hornType: ["forked", "spikes", "crystal"],
    auraStyle: ["static", "radial", "glitch"],
    patternStyle: ["cracks", "circuit", "chevrons"],
    mutationEffect: ["glitch", "ripple", "scan"],
  },
  "halo-organism": {
    bodyShape: ["disc", "orb", "spindle"],
    eyeType: ["ring", "mono", "visor"],
    hornType: ["halo", "long", "crystal"],
    auraStyle: ["halo", "comet", "flare"],
    patternStyle: ["stars", "rings", "veins"],
    mutationEffect: ["shimmer", "orbit", "flare"],
  },
  "jellyfish-entity": {
    bodyShape: ["blob", "disc", "tendril"],
    eyeType: ["wide", "ring", "void"],
    hornType: ["none", "antenna", "halo"],
    auraStyle: ["mist", "pulse", "soft"],
    patternStyle: ["veins", "cells", "spots"],
    mutationEffect: ["drip", "orbit", "ripple"],
  },
  "biomech-eye": {
    bodyShape: ["disc", "vector", "poly"],
    eyeType: ["visor", "slit", "diamond"],
    hornType: ["fin", "spikes", "short"],
    auraStyle: ["ring", "static", "pulse"],
    patternStyle: ["circuit", "scales", "ridges"],
    mutationEffect: ["scan", "spark", "shimmer"],
  },
  "spiral-core": {
    bodyShape: ["helix", "orb", "disc"],
    eyeType: ["glitch", "void", "mono"],
    hornType: ["halo", "none", "antenna"],
    auraStyle: ["glitch", "static", "radial"],
    patternStyle: ["circuit", "cracks", "rings"],
    mutationEffect: ["glitch", "scan", "ripple"],
  },
};

const pickArchetype = (rarity: Rarity, parents: Creature[]) => {
  const inherited = parents
    .map((parent) => parent.visualDna?.archetype)
    .filter((archetype): archetype is string => Boolean(archetype));
  if (inherited.length && Math.random() > 0.48) {
    return sample(inherited);
  }

  if (rarity === "Secret") {
    return sample(["spiral-core", "split-body-mutant", "halo-organism"]);
  }
  if (rarity === "Mythic") {
    return sample(["tripod-reactor", "halo-organism", "floating-prism", "spiral-core"]);
  }
  if (rarity === "Legendary") {
    return sample(["crystalline-cluster", "tripod-reactor", "split-body-mutant", "halo-organism", "biomech-eye"]);
  }
  if (rarity === "Epic") {
    return sample(["floating-prism", "segmented-worm", "biomech-eye", "jellyfish-entity", "spiral-core"]);
  }
  if (rarity === "Rare") {
    return sample(["tall-parasite", "floating-prism", "biomech-eye", "asymmetrical-blob"]);
  }
  return sample(["orb", "segmented-worm", "asymmetrical-blob", "jellyfish-entity"]);
};

const pickVisualDna = (rarity: Rarity, parents: Creature[]) => {
  const inherited = parents.map((parent) => parent.visualDna).filter(Boolean);
  const inherit = <T,>(items: T[], getter: (dna: NonNullable<Creature["visualDna"]>) => T) =>
    inherited.length && Math.random() > 0.42 ? getter(sample(inherited)) : sample(items);

  const rarityRankValue = RARITY_ORDER.indexOf(rarity);
  const archetype = pickArchetype(rarity, parents);
  const archetypeDna = ARCHETYPE_DNA[archetype] ?? ARCHETYPE_DNA.orb;
  if (rarity === "Secret") {
    return {
      archetype,
      bodyShape: sample(archetypeDna.bodyShape),
      eyeType: sample(["glitch", "void", "ring"]),
      hornType: sample(archetypeDna.hornType),
      auraStyle: "glitch",
      patternStyle: sample(["circuit", "cracks", "rings"]),
      mutationEffect: "glitch",
    };
  }

  if (rarity === "Mythic") {
    return {
      archetype,
      bodyShape: sample(archetypeDna.bodyShape),
      eyeType: sample(archetypeDna.eyeType),
      hornType: sample(archetypeDna.hornType),
      auraStyle: sample(["flare", "halo", "comet", "radial", "pulse", ...archetypeDna.auraStyle]),
      patternStyle: sample(["circuit", "cracks", "stars", "rings", "veins", ...archetypeDna.patternStyle]),
      mutationEffect: sample(["shimmer", "scan", "orbit", "flare", ...archetypeDna.mutationEffect]),
    };
  }

  if (rarity === "Legendary") {
    return {
      archetype,
      bodyShape: sample(archetypeDna.bodyShape),
      eyeType: sample(archetypeDna.eyeType),
      hornType: sample(archetypeDna.hornType),
      auraStyle: sample(["flare", "halo", "comet", "radial", ...archetypeDna.auraStyle]),
      patternStyle: sample(archetypeDna.patternStyle.filter((type) => type !== "none")),
      mutationEffect: sample(["spark", "orbit", "scan", "shimmer", "flare", "ripple", ...archetypeDna.mutationEffect]),
    };
  }

  return {
    archetype,
    bodyShape:
      rarity === "Common"
        ? inherit(archetypeDna.bodyShape.filter((shape) => shape !== "crystal"), (dna) => dna.bodyShape)
        : rarity === "Rare"
          ? inherit(archetypeDna.bodyShape, (dna) => dna.bodyShape)
          : inherit([...archetypeDna.bodyShape, ...BODY_SHAPES.filter((shape) => shape !== "slug")], (dna) => dna.bodyShape),
    eyeType:
      rarity === "Common"
        ? inherit(["round", "wide", "mono", "spark"], (dna) => dna.eyeType)
        : inherit(archetypeDna.eyeType, (dna) => dna.eyeType),
    hornType:
      rarity === "Common"
        ? inherit(["none", "short", "antenna"], (dna) => dna.hornType)
        : rarityRankValue >= 3
        ? sample(archetypeDna.hornType.filter((type) => type !== "none"))
        : inherit(archetypeDna.hornType, (dna) => dna.hornType),
    auraStyle:
      rarity === "Common"
        ? sample(["soft", "ring"])
        : rarity === "Rare"
          ? sample(archetypeDna.auraStyle)
          : sample([...archetypeDna.auraStyle, "flare", "mist", "pulse", "static", "radial"]),
    patternStyle:
      rarity === "Common"
        ? sample(["none", "spots", "ridges"])
        : rarityRankValue >= 2
        ? sample(archetypeDna.patternStyle.filter((type) => type !== "none"))
        : inherit(archetypeDna.patternStyle, (dna) => dna.patternStyle),
    mutationEffect:
      rarity === "Common"
        ? sample(["dust", "ripple", "spark"])
        : rarity === "Rare"
          ? sample(archetypeDna.mutationEffect)
          : sample([...archetypeDna.mutationEffect, "spark", "orbit", "scan", "shimmer", "flare", "ripple"]),
  };
};

const createCreatureName = (rarity: Rarity) => {
  if (rarity === "Secret") {
    return `${sample(RARITY_NAME_TITLES.Secret)} ${sample(SECRET_NAME_CORES)}-${randomInt(10, 99)}`;
  }
  const title = sample(RARITY_NAME_TITLES[rarity]);
  return `${title} ${sample(NAME_PREFIXES)}-${sample(NAME_SUFFIXES)}`;
};

export const createRandomCreature = (
  generation = 1,
  parents: Creature[] = [],
  knownNames: string[] = [],
  state?: GameState,
  premium = false,
  forcedRarity?: Rarity,
): Creature => {
  const rarity = forcedRarity ?? (parents.length ? inheritRarity(parents) : pickRarity(state, premium));
  const incomeConfig = RARITY_CONFIG[rarity];
  const inheritedColors = parents.flatMap((parent) => [
    parent.colors.body,
    parent.colors.accent,
    parent.colors.glow,
  ]);
  const parentTraits = parents.flatMap((parent) => parent.traits);
  const parentPassiveTraits = parents.flatMap((parent) => parent.passiveTraits);

  const palette = state?.exclusiveColors.length ? [...PALETTE, ...state.exclusiveColors] : PALETTE;
  const body = inheritedColors.length && Math.random() > 0.35 ? sample(inheritedColors) : sample(palette);
  const accent = inheritedColors.length && Math.random() > 0.5 ? sample(inheritedColors) : sample(palette);
  const glowChoices = palette.filter((color) => color !== body);
  const eyeChoices = PALETTE.filter((color) => color !== accent);
  const glow = sample(glowChoices.length ? glowChoices : PALETTE);
  const eye = sample(eyeChoices.length ? eyeChoices : palette);
  const traits = Array.from(
    new Set([
      ...(parentTraits.length && Math.random() > 0.25 ? [sample(parentTraits)] : []),
      sample(TRAITS),
      sample(TRAITS),
    ]),
  ).slice(0, rarity === "Common" ? 2 : 3);

  const passiveTraits = pickPassiveTraits(rarity, parentPassiveTraits);
  const knownSameRarityNames = state?.creatures
    .filter((existing) => existing.rarity === rarity)
    .map((existing) => existing.name) ?? [];
  const duplicateChance = Math.min(0.28, knownSameRarityNames.length * 0.035);
  const name =
    knownSameRarityNames.length && Math.random() < duplicateChance
      ? sample(knownSameRarityNames)
      : createCreatureName(rarity);
  const creature: Creature = {
    id: createId(),
    name,
    rarity,
    generation,
    level: 1,
    incomePerMinute: randomInt(incomeConfig.minIncome, incomeConfig.maxIncome),
    traits,
    passiveTraits,
    powerScore: 0,
    isNew: !knownNames.includes(name),
    colors: { body, accent, glow, eye },
    visualDna: pickVisualDna(rarity, parents),
    createdAt: Date.now(),
  };

  return {
    ...creature,
    powerScore: getPowerScore(creature),
  };
};

const inheritRarity = (parents: Creature[]): Rarity => {
  const parentBest = Math.max(...parents.map((parent) => RARITY_ORDER.indexOf(parent.rarity)));
  const upgradeChance = parentBest >= 3 ? 0.08 : 0.18;
  const downgradeChance = 0.18;
  let rarityIndex = parentBest;

  if (Math.random() < upgradeChance) {
    rarityIndex += 1;
  } else if (Math.random() < downgradeChance) {
    rarityIndex -= 1;
  }

  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, rarityIndex))];
};

export const getFusionCost = (parents: Creature[]) => {
  if (parents.length < 2) {
    return { coins: FUSION_BASE_COIN_COST, shards: FUSION_BASE_SHARD_COST };
  }

  const rarityWeight = parents.reduce((sum, parent) => sum + RARITY_ORDER.indexOf(parent.rarity), 0);
  const levelWeight = parents.reduce((sum, parent) => sum + parent.level, 0);
  return {
    coins: Math.round(FUSION_BASE_COIN_COST * (1 + rarityWeight * 0.42) + levelWeight * 18),
    shards: Math.round(FUSION_BASE_SHARD_COST * (1 + rarityWeight * 0.32) + levelWeight * 1.6),
  };
};

export const getFusionBlockReason = (state: GameState, firstId?: string, secondId?: string) => {
  if (!firstId || !secondId) {
    return "Select two mutants to fuse.";
  }
  if (firstId === secondId) {
    return "Choose two different mutants.";
  }
  if (state.creatures.length <= 2) {
    return "Keep at least one spare mutant before fusion.";
  }
  if (state.favoriteCreatureIds.includes(firstId) || state.favoriteCreatureIds.includes(secondId)) {
    return "Favorited mutants are locked. Unfavorite them before fusion.";
  }
  if (state.equippedCreatureIds.includes(firstId) || state.equippedCreatureIds.includes(secondId)) {
    return "Active equipped mutants are locked. Unequip them before fusion.";
  }

  const parents = [
    state.creatures.find((creature) => creature.id === firstId),
    state.creatures.find((creature) => creature.id === secondId),
  ].filter((creature): creature is Creature => Boolean(creature));
  if (parents.length < 2) {
    return "Selected mutant is no longer available.";
  }

  const cost = getFusionCost(parents);
  if (state.coins < cost.coins || state.mutantShards < cost.shards) {
    return `Fusion needs ${cost.coins} coins and ${cost.shards} shards.`;
  }

  return "";
};

const pickFusionRarity = (parents: Creature[], unstable: boolean): Rarity => {
  const ranks = parents.map((parent) => RARITY_ORDER.indexOf(parent.rarity));
  const bestRank = Math.max(...ranks);
  const averageRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
  const powerBonus = Math.min(0.18, parents.reduce((sum, parent) => sum + getPowerScore(parent), 0) / 6500);
  const traitBonus = Math.min(0.12, new Set(parents.flatMap((parent) => parent.traits)).size * 0.012);
  const upgradeChance = Math.min(0.34, 0.1 + bestRank * 0.035 + powerBonus + traitBonus + (unstable ? 0.04 : 0));
  const downgradeChance = Math.max(0.08, 0.28 - averageRank * 0.035);
  const roll = Math.random();
  let nextRank = Math.round(averageRank);

  if (roll < downgradeChance) {
    nextRank -= 1;
  } else if (roll > 1 - upgradeChance) {
    nextRank += Math.random() > 0.88 && unstable ? 2 : 1;
  } else if (roll > 0.5 + upgradeChance * 0.35) {
    nextRank = bestRank;
  }

  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, nextRank))];
};

const mutateFusionCreature = (creature: Creature, parents: Creature[], unstable: boolean): Creature => {
  if (!unstable) {
    return creature;
  }

  const unstableName = `VX-${creature.name.replace(/\s+/g, "-").replace(/[aeiou]/gi, "0")}`;
  const incomeBonus = 1.08 + Math.random() * 0.12;
  const mutated: Creature = {
    ...creature,
    name: unstableName,
    incomePerMinute: Math.round(creature.incomePerMinute * incomeBonus),
    traits: Array.from(new Set(["Unstable Core", "Void Tears", ...parents.flatMap((parent) => parent.traits).slice(0, 2)])).slice(0, 3),
    colors: {
      body: "#f2f7ff",
      accent: sample([parents[0].colors.accent, parents[1].colors.accent, "#ff4fd8"]),
      glow: sample(["#ffffff", "#1df7ff", "#ff4fd8"]),
      eye: "#050713",
    },
    visualDna: {
      archetype: sample(["spiral-core", "split-body-mutant", "halo-organism"]),
      bodyShape: sample(["asym", "poly", "crystal"]),
      eyeType: sample(["glitch", "void", "ring"]),
      hornType: sample(["halo", "forked", "crystal"]),
      auraStyle: "glitch",
      patternStyle: sample(["circuit", "cracks"]),
      mutationEffect: "glitch",
    },
  };

  return { ...mutated, powerScore: getPowerScore(mutated) };
};

export const hatchEgg = (state: GameState): HatchResult | null => {
  const now = Date.now();
  const liveState = ensureLiveOpsState(state, now);
  const cost = getHatchCost(liveState);
  const usesPremium = liveState.premiumCapsules > 0;
  if (!usesPremium && (liveState.eggs <= 0 || liveState.coins < cost)) {
    return null;
  }

  const rarity = pickHatchRarity(liveState, usesPremium);
  const creature = createRandomCreature(1, [], liveState.discoveredCreatureNames, liveState, usesPremium, rarity);
  const duplicate = liveState.discoveredCreatureNames.includes(creature.name);
  const shardsGained = duplicate ? DUPLICATE_SHARDS_BY_RARITY[creature.rarity] : 0;
  const nextState = progressMission(
    {
      ...liveState,
      coins: usesPremium ? liveState.coins : liveState.coins - cost,
      eggs: usesPremium ? liveState.eggs : liveState.eggs - 1,
      premiumCapsules: usesPremium ? liveState.premiumCapsules - 1 : liveState.premiumCapsules,
      hatchStreak: liveState.hatchStreak + 1,
      lastHatchAt: now,
      hatchStreakExpiresAt: now + HATCH_STREAK_TIMEOUT_MS,
      totalHatches: liveState.totalHatches + 1,
      mutantShards: liveState.mutantShards + shardsGained,
      discoveredCreatureNames: duplicate
        ? liveState.discoveredCreatureNames
        : Array.from(new Set([...liveState.discoveredCreatureNames, creature.name])),
      creatures: duplicate ? liveState.creatures : [creature, ...liveState.creatures],
      lastActiveAt: now,
    },
    "hatch_3",
  );

  return {
    creature,
    duplicate,
    shardsGained,
    state: nextState,
  };
};

export const breedCreatures = (
  state: GameState,
  firstId: string,
  secondId: string,
): HatchResult | null => {
  const blockReason = getFusionBlockReason(state, firstId, secondId);
  if (blockReason) {
    return null;
  }

  const parents = [
    state.creatures.find((creature) => creature.id === firstId),
    state.creatures.find((creature) => creature.id === secondId),
  ];
  if (!parents[0] || !parents[1]) {
    return null;
  }

  const generation = Math.max(parents[0].generation, parents[1].generation) + 1;
  const fusionCost = getFusionCost(parents as Creature[]);
  const parentPower = parents.reduce((sum, parent) => sum + getPowerScore(parent!), 0);
  const unstableChance =
    0.04 +
    Math.min(0.07, parentPower / 9000) +
    (parents.some((parent) => parent?.passiveTraits.includes("Glitched")) ? 0.035 : 0);
  const unstable = Math.random() < unstableChance;
  const rarity = pickFusionRarity(parents as Creature[], unstable);
  const rawCreature = mutateFusionCreature(
    createRandomCreature(generation, parents as Creature[], state.discoveredCreatureNames, state, false, rarity),
    parents as Creature[],
    unstable,
  );
  const creature = state.discoveredCreatureNames.includes(rawCreature.name)
    ? {
        ...rawCreature,
        name: `${rawCreature.name}-M${randomInt(10, 99)}`,
        isNew: true,
      }
    : rawCreature;
  const shardsGained = 0;
  const consumedIds = [firstId, secondId];
  const nextState = progressMission(
    {
      ...state,
      coins: state.coins - fusionCost.coins,
      mutantShards: state.mutantShards - fusionCost.shards + shardsGained,
      hatchStreak: 0,
      hatchStreakExpiresAt: 0,
      totalBreeds: state.totalBreeds + 1,
      discoveredCreatureNames: Array.from(new Set([...state.discoveredCreatureNames, creature.name])),
      favoriteCreatureIds: state.favoriteCreatureIds.filter((id) => !consumedIds.includes(id)),
      equippedCreatureIds: state.equippedCreatureIds.filter((id) => !consumedIds.includes(id)),
      creatures: [creature, ...state.creatures.filter((existing) => !consumedIds.includes(existing.id))],
      lastActiveAt: Date.now(),
    },
    "breed_1",
  );

  return {
    creature,
    duplicate: false,
    shardsGained,
    unstable,
    consumedCreatureIds: consumedIds,
    state: nextState,
  };
};

export const calculateOfflineIncome = (
  state: GameState,
  now = Date.now(),
): { state: GameState; earned: number; elapsedMs: number } => {
  const elapsedMs = Math.max(0, Math.min(MAX_OFFLINE_MS, now - state.lastActiveAt));
  const earned = Math.floor((getBoostedIncomePerMinute(state) / 60000) * elapsedMs);

  return {
    earned,
    elapsedMs,
    state: {
      ...state,
      coins: state.coins + earned,
      lastActiveAt: now,
    },
  };
};

export const collectTickIncome = (state: GameState, elapsedMs: number): GameState => {
  const income = (getBoostedIncomePerMinute(state) / 60000) * elapsedMs;
  return progressMission({
    ...state,
    coins: state.coins + income,
    lastActiveAt: Date.now(),
  }, "collect_250", Math.floor(income));
};

export const upgradeCreature = (state: GameState, creatureId: string): GameState | null => {
  const creature = state.creatures.find((item) => item.id === creatureId);
  if (!creature) {
    return null;
  }

  const cost = getUpgradeCost(creature);
  const shardCost = getUpgradeShardCost(creature);
  const usesCoins = state.coins >= cost;
  const usesShards = !usesCoins && state.mutantShards >= shardCost;
  if (!usesCoins && !usesShards) {
    return null;
  }

  return progressMission({
    ...state,
    coins: usesCoins ? state.coins - cost : state.coins,
    mutantShards: usesShards ? state.mutantShards - shardCost : state.mutantShards,
    creatures: state.creatures.map((item) => {
      if (item.id !== creatureId) {
        return item;
      }
      const upgraded = { ...item, level: item.level + 1 };
      return { ...upgraded, powerScore: getPowerScore(upgraded) };
    }),
    lastActiveAt: Date.now(),
  }, "upgrade_1");
};

export const toggleFavoriteCreature = (state: GameState, creatureId: string): GameState => {
  const exists = state.favoriteCreatureIds.includes(creatureId);
  return {
    ...state,
    favoriteCreatureIds: exists
      ? state.favoriteCreatureIds.filter((id) => id !== creatureId)
      : [...state.favoriteCreatureIds, creatureId],
    lastActiveAt: Date.now(),
  };
};

export const canClaimDailyReward = (state: GameState, now = Date.now()) => {
  const today = todayKey(now);
  const claimedDate =
    state.claimedLoginRewardDate || (state.lastDailyRewardAt ? todayKey(state.lastDailyRewardAt) : "");
  return claimedDate !== today;
};

export const getDailyLoginReward = (state: GameState) => {
  const day = Math.max(1, Math.min(7, state.loginStreak || 1));
  return DAILY_LOGIN_REWARDS[day - 1];
};

export const claimDailyReward = (state: GameState, now = Date.now()): GameState | null => {
  if (!canClaimDailyReward(state, now)) {
    return null;
  }

  const reward = getDailyLoginReward(state).reward;
  return applyProgressionReward({
    ...state,
    claimedLoginRewardDate: todayKey(now),
    lastDailyRewardAt: now,
  }, reward, now);
};

export const claimFreeCapsule = (state: GameState, now = Date.now()): GameState | null => {
  if (state.freeCapsuleReadyAt > now) {
    return null;
  }

  return {
    ...state,
    eggs: state.eggs + 1,
    freeCapsuleReadyAt: now + FREE_CAPSULE_COOLDOWN_MS,
    lastActiveAt: now,
  };
};

export const applyLoginStreak = (state: GameState, now = Date.now()): GameState => {
  const today = todayKey(now);
  if (dateKeyFromDateString(state.lastLoginDate) === today) {
    return state;
  }

  const yesterday = todayKey(now - 24 * 60 * 60 * 1000);
  const loginStreak = dateKeyFromDateString(state.lastLoginDate) === yesterday ? state.loginStreak + 1 : 1;

  return {
    ...state,
    loginStreak,
    lastLoginDate: today,
    sessionStartedAt: now,
    claimedSessionRewards: [],
    lastActiveAt: now,
  };
};

export const recordInviteShare = (state: GameState): GameState => ({
  ...state,
  inviteCount: state.inviteCount + 1,
  gems: state.gems + 1,
  lastActiveAt: Date.now(),
});

export const claimMissionReward = (state: GameState, missionId: MissionId): GameState | null => {
  const mission = state.dailyMissions.find((item) => item.id === missionId);
  if (!mission || mission.claimed || mission.progress < mission.target) {
    return null;
  }

  return {
    ...state,
    coins: state.coins + (mission.reward.coins ?? 0),
    gems: state.gems + (mission.reward.gems ?? 0),
    eggs: state.eggs + (mission.reward.eggs ?? 0),
    premiumCapsules: state.premiumCapsules + (mission.reward.premiumCapsules ?? 0),
    dailyMissions: state.dailyMissions.map((item) =>
      item.id === missionId ? { ...item, claimed: true } : item,
    ),
    lastActiveAt: Date.now(),
  };
};

export const getSessionRewardProgress = (state: GameState, now = Date.now()) => {
  const elapsedMs = Math.max(0, now - (state.sessionStartedAt || now));
  return SESSION_REWARDS.map((reward) => {
    const requiredMs = reward.minutes * 60 * 1000;
    return {
      ...reward,
      elapsedMs,
      requiredMs,
      progress: Math.min(1, elapsedMs / requiredMs),
      ready: elapsedMs >= requiredMs,
      claimed: state.claimedSessionRewards.includes(reward.id),
    };
  });
};

export const claimSessionReward = (
  state: GameState,
  rewardId: SessionRewardId,
  now = Date.now(),
): GameState | null => {
  const reward = getSessionRewardProgress(state, now).find((item) => item.id === rewardId);
  if (!reward || !reward.ready || reward.claimed) {
    return null;
  }

  return applyProgressionReward({
    ...state,
    claimedSessionRewards: [...state.claimedSessionRewards, rewardId],
  }, reward.reward, now);
};

export const buyLimitedOffer = (
  state: GameState,
  offerId: LimitedOfferId,
  now = Date.now(),
): GameState | null => {
  const offer = LIMITED_OFFERS[offerId];
  if (!offer || state.purchasedOfferIds.includes(offerId)) {
    return null;
  }
  if ((offer.cost.coins ?? 0) > state.coins || (offer.cost.gems ?? 0) > state.gems) {
    return null;
  }

  const base = {
    ...state,
    coins: state.coins - (offer.cost.coins ?? 0),
    gems: state.gems - (offer.cost.gems ?? 0),
    purchasedOfferIds: [...state.purchasedOfferIds, offerId],
    lastActiveAt: now,
  };

  if (offerId === "premium_capsule") {
    return { ...base, premiumCapsules: base.premiumCapsules + 1 };
  }
  if (offerId === "double_income") {
    return { ...base, incomeBoostUntil: now + 30 * 60 * 1000 };
  }
  return { ...base, luckyBoostUntil: now + 20 * 60 * 1000 };
};
