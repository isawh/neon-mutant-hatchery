import {
  DAILY_MISSION_POOL,
  FREE_CAPSULE_COOLDOWN_MS,
  HATCH_BASE_COST,
  LIMITED_OFFERS,
  MAX_OFFLINE_MS,
  NAME_PREFIXES,
  NAME_SUFFIXES,
  PALETTE,
  PASSIVE_TRAIT_CONFIG,
  PASSIVE_TRAITS,
  RARE_EVENTS,
  RARITY_CONFIG,
  RARITY_ORDER,
  TRAITS,
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
  Rarity,
} from "./types";

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const sample = <T,>(items: T[]): T => items[randomInt(0, items.length - 1)];

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const todayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

const getMissionRotation = (now = Date.now()): DailyMission[] => {
  const ids = Object.keys(DAILY_MISSION_POOL) as MissionId[];
  const daySeed = Math.floor(now / 86400000);
  return [0, 1, 2].map((offset) => {
    const mission = DAILY_MISSION_POOL[ids[(daySeed + offset) % ids.length]];
    return { ...mission, progress: 0, claimed: false };
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

const rollRareEvent = (state: GameState, now = Date.now()): ActiveRareEvent | null => {
  if (state.activeEvent && state.activeEvent.endsAt > now) {
    return state.activeEvent;
  }
  if (new Date(state.lastRareEventRollAt).toDateString() === new Date(now).toDateString()) {
    return state.activeEvent && state.activeEvent.endsAt > now ? state.activeEvent : null;
  }
  if (Math.random() > 0.12) {
    return null;
  }

  const event = sample([...RARE_EVENTS]);
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    endsAt: now + event.durationMs,
  };
};

export const ensureLiveOpsState = (state: GameState, now = Date.now()): GameState => {
  const date = todayKey(now);
  const needsMissions = state.dailyMissionDate !== date || state.dailyMissions.length === 0;
  const activeEvent = rollRareEvent(state, now);

  return {
    ...state,
    activeEvent,
    lastRareEventRollAt:
      state.lastRareEventRollAt && new Date(state.lastRareEventRollAt).toDateString() === new Date(now).toDateString()
        ? state.lastRareEventRollAt
        : now,
    dailyMissionDate: needsMissions ? date : state.dailyMissionDate,
    dailyMissions: needsMissions ? getMissionRotation(now) : state.dailyMissions,
    limitedOfferDate: state.limitedOfferDate === date ? state.limitedOfferDate : date,
    purchasedOfferIds: state.limitedOfferDate === date ? state.purchasedOfferIds : [],
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

export const getUpgradeCost = (creature: Creature) =>
  Math.round(
    42 *
      Math.pow(creature.level, 1.42) *
      (1 + RARITY_ORDER.indexOf(creature.rarity) * 0.62) *
      (1 + creature.passiveTraits.length * 0.08),
  );

export const getRarityChances = (state?: GameState, premium = false) => {
  const now = Date.now();
  const bonus =
    (premium ? 8 : 0) +
    (state?.rareChanceBonus ?? 0) +
    (state?.luckyBoostUntil && state.luckyBoostUntil > now ? 6 : 0) +
    (state?.activeEvent?.id === "glitched_capsule" && state.activeEvent.endsAt > now ? 7 : 0) +
    (state?.activeEvent?.id === "mutation_storm" && state.activeEvent.endsAt > now ? 10 : 0);

  const weights = RARITY_ORDER.map((rarity) => {
    const rank = RARITY_ORDER.indexOf(rarity);
    if (rarity === "Secret") {
      return Math.min(0.35, RARITY_CONFIG[rarity].chance + bonus * 0.012);
    }
    if (rank === 0) {
      return Math.max(20, RARITY_CONFIG[rarity].chance - bonus * 1.9);
    }
    if (rank === 1) {
      return RARITY_CONFIG[rarity].chance + bonus * 0.75;
    }
    return RARITY_CONFIG[rarity].chance + bonus * (rank * 0.42);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  return RARITY_ORDER.map((rarity, index) => ({
    rarity,
    chance: Number(((weights[index] / total) * 100).toFixed(1)),
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

export const createRandomCreature = (
  generation = 1,
  parents: Creature[] = [],
  knownNames: string[] = [],
  state?: GameState,
  premium = false,
): Creature => {
  const rarity = parents.length ? inheritRarity(parents) : pickRarity(state, premium);
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
  const name = `${sample(NAME_PREFIXES)}-${sample(NAME_SUFFIXES)}`;
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

export const hatchEgg = (state: GameState): HatchResult | null => {
  const cost = getHatchCost(state);
  const usesPremium = state.premiumCapsules > 0;
  if (!usesPremium && (state.eggs <= 0 || state.coins < cost)) {
    return null;
  }

  const creature = createRandomCreature(1, [], state.discoveredCreatureNames, state, usesPremium);
  const nextState = progressMission(
    {
      ...state,
      coins: usesPremium ? state.coins : state.coins - cost,
      eggs: usesPremium ? state.eggs : state.eggs - 1,
      premiumCapsules: usesPremium ? state.premiumCapsules - 1 : state.premiumCapsules,
      hatchStreak: state.hatchStreak + 1,
      totalHatches: state.totalHatches + 1,
      discoveredCreatureNames: Array.from(new Set([...state.discoveredCreatureNames, creature.name])),
      creatures: [creature, ...state.creatures],
      lastActiveAt: Date.now(),
    },
    "hatch_3",
  );

  return {
    creature,
    state: nextState,
  };
};

export const breedCreatures = (
  state: GameState,
  firstId: string,
  secondId: string,
): HatchResult | null => {
  if (firstId === secondId || state.coins < 95 || state.gems < 1) {
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
  const creature = createRandomCreature(generation, parents as Creature[], state.discoveredCreatureNames, state);
  const nextState = progressMission(
    {
      ...state,
      coins: state.coins - 95,
      gems: state.gems - 1,
      hatchStreak: 0,
      discoveredCreatureNames: Array.from(new Set([...state.discoveredCreatureNames, creature.name])),
      creatures: [creature, ...state.creatures],
      lastActiveAt: Date.now(),
    },
    "breed_1",
  );

  return {
    creature,
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
  if (state.coins < cost) {
    return null;
  }

  return progressMission({
    ...state,
    coins: state.coins - cost,
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
  const last = state.lastDailyRewardAt ? new Date(state.lastDailyRewardAt).toDateString() : "";
  return last !== new Date(now).toDateString();
};

export const claimDailyReward = (state: GameState, now = Date.now()): GameState | null => {
  if (!canClaimDailyReward(state, now)) {
    return null;
  }

  const streakBonus = Math.min(7, state.loginStreak);
  return {
    ...state,
    coins: state.coins + 160 + streakBonus * 35,
    gems: state.gems + 1,
    eggs: state.eggs + 1,
    lastDailyRewardAt: now,
    lastActiveAt: now,
  };
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
  const today = new Date(now).toDateString();
  if (state.lastLoginDate === today) {
    return state;
  }

  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toDateString();
  const loginStreak = state.lastLoginDate === yesterday ? state.loginStreak + 1 : 1;

  return {
    ...state,
    loginStreak,
    lastLoginDate: today,
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
