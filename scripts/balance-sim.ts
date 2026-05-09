type Rarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Secret";

type Creature = {
  rarity: Rarity;
  level: number;
  incomePerMinute: number;
  multiplier: number;
};

type SimState = {
  coins: number;
  gems: number;
  eggs: number;
  premiumCapsules: number;
  creatures: Creature[];
  totalHatches: number;
  hatchStreak: number;
  capsulesOpened: number;
  upgradesBought: number;
  breedsCompleted: number;
  firstUpgradeAt: number | null;
  firstBreedAt: number | null;
  coinsEarned: number;
  rarityCounts: Record<Rarity, number>;
  tutorial: {
    firstHatch: boolean;
    collection: boolean;
    upgrade: boolean;
    daily: boolean;
    shop: boolean;
  };
};

const RARITY_ORDER: Rarity[] = ["Common", "Rare", "Epic", "Legendary", "Mythic", "Secret"];

const RARITY_CONFIG: Record<Rarity, { chance: number; minIncome: number; maxIncome: number }> = {
  Common: { chance: 72, minIncome: 7, maxIncome: 10 },
  Rare: { chance: 22, minIncome: 12, maxIncome: 18 },
  Epic: { chance: 5, minIncome: 24, maxIncome: 36 },
  Legendary: { chance: 0.8, minIncome: 46, maxIncome: 72 },
  Mythic: { chance: 0.18, minIncome: 92, maxIncome: 140 },
  Secret: { chance: 0.02, minIncome: 220, maxIncome: 320 },
};

const PREMIUM_RARITY_CHANCES: Record<Rarity, number> = {
  Common: 45,
  Rare: 35,
  Epic: 15,
  Legendary: 4,
  Mythic: 0.9,
  Secret: 0.1,
};

const PASSIVE_MULTIPLIERS = [1.08, 1.14, 1.22, 1.3, 1.45];
const STARTER_REWARD = { coins: 100, gems: 5, eggs: 3 };
const HATCH_BASE_COST = 26;
const UPGRADE_BASE_COST = 96;
const BREED_COIN_COST = 320;
const BREED_GEM_COST = 1;
const DAILY_REWARD = { coins: 90, gems: 1, eggs: 1 };

const createRng = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const minutes = (seconds: number | null) => (seconds === null ? "not reached" : `${(seconds / 60).toFixed(1)}m`);

const format = (value: number) => Math.round(value).toLocaleString("en-US");

const getHatchCost = (state: SimState) =>
  Math.round(HATCH_BASE_COST * Math.pow(1.16, Math.max(0, state.totalHatches)) + state.hatchStreak * 4);

const getUpgradeCost = (creature: Creature) =>
  Math.round(
    UPGRADE_BASE_COST *
      Math.pow(creature.level, 1.42) *
      (1 + RARITY_ORDER.indexOf(creature.rarity) * 0.62) *
      (1 + (creature.multiplier > 1 ? 1 : 0) * 0.08),
  );

const getIncome = (creature: Creature) => Math.round(creature.incomePerMinute * creature.level * creature.multiplier);

const totalIncome = (state: SimState) => state.creatures.reduce((sum, creature) => sum + getIncome(creature), 0);

const getRarityChances = (premium: boolean) => {
  const source = premium ? PREMIUM_RARITY_CHANCES : RARITY_CONFIG;
  return RARITY_ORDER.map((rarity) => ({
    rarity,
    chance: premium ? (source as Record<Rarity, number>)[rarity] : RARITY_CONFIG[rarity].chance,
  }));
};

const pickRarity = (rng: () => number, premium: boolean): Rarity => {
  const roll = rng() * 100;
  let cursor = 0;
  for (const item of getRarityChances(premium)) {
    cursor += item.chance;
    if (roll <= cursor) {
      return item.rarity;
    }
  }
  return "Common";
};

const pickHatchRarity = (state: SimState, rng: () => number, premium: boolean): Rarity => {
  if (state.totalHatches === 0) {
    return "Rare";
  }
  const rarity = pickRarity(rng, premium);
  if (state.totalHatches < 3 && RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf("Legendary")) {
    return rng() > 0.32 ? "Rare" : "Epic";
  }
  return rarity;
};

const passiveMultiplier = (rng: () => number, rarity: Rarity) => {
  const rank = RARITY_ORDER.indexOf(rarity);
  const count = rank === 0 ? (rng() > 0.7 ? 1 : 0) : rank === 1 ? 1 : rank <= 2 ? (rng() > 0.55 ? 2 : 1) : 2;
  let multiplier = 1;
  for (let index = 0; index < count; index += 1) {
    multiplier *= PASSIVE_MULTIPLIERS[Math.floor(rng() * PASSIVE_MULTIPLIERS.length)];
  }
  return multiplier;
};

const hatch = (state: SimState, rng: () => number) => {
  const premium = state.premiumCapsules > 0;
  const cost = getHatchCost(state);
  if (!premium && (state.eggs <= 0 || state.coins < cost)) {
    return false;
  }

  const rarity = pickHatchRarity(state, rng, premium);
  const income = RARITY_CONFIG[rarity];
  const creature: Creature = {
    rarity,
    level: 1,
    incomePerMinute: Math.round(income.minIncome + rng() * (income.maxIncome - income.minIncome)),
    multiplier: passiveMultiplier(rng, rarity),
  };

  state.coins -= premium ? 0 : cost;
  state.eggs -= premium ? 0 : 1;
  state.premiumCapsules -= premium ? 1 : 0;
  state.totalHatches += 1;
  state.hatchStreak += 1;
  state.capsulesOpened += 1;
  state.creatures.unshift(creature);
  state.rarityCounts[rarity] += 1;

  if (!state.tutorial.firstHatch) {
    state.tutorial.firstHatch = true;
    state.coins += 35;
  }
  return true;
};

const upgradeBestAffordable = (state: SimState, elapsedSeconds: number, keepBreedReserve: boolean) => {
  const affordable = state.creatures
    .map((creature, index) => ({ creature, index, cost: getUpgradeCost(creature), roi: getIncome(creature) / getUpgradeCost(creature) }))
    .filter((item) => state.coins >= item.cost && (!keepBreedReserve || state.coins - item.cost >= BREED_COIN_COST * 0.45))
    .sort((a, b) => b.roi - a.roi)[0];

  if (!affordable) {
    return false;
  }

  state.coins -= affordable.cost;
  state.creatures[affordable.index] = { ...affordable.creature, level: affordable.creature.level + 1 };
  state.upgradesBought += 1;
  if (state.firstUpgradeAt === null) {
    state.firstUpgradeAt = elapsedSeconds;
  }
  if (!state.tutorial.upgrade) {
    state.tutorial.upgrade = true;
    state.coins += 75;
  }
  return true;
};

const breedIfReady = (state: SimState, elapsedSeconds: number) => {
  if (state.creatures.length < 2 || state.coins < BREED_COIN_COST || state.gems < BREED_GEM_COST) {
    return false;
  }
  state.coins -= BREED_COIN_COST;
  state.gems -= BREED_GEM_COST;
  state.breedsCompleted += 1;
  if (state.firstBreedAt === null) {
    state.firstBreedAt = elapsedSeconds;
  }
  return true;
};

const createInitialState = (premiumCapsules: number): SimState => ({
  coins: STARTER_REWARD.coins,
  gems: STARTER_REWARD.gems,
  eggs: STARTER_REWARD.eggs,
  premiumCapsules,
  creatures: [],
  totalHatches: 0,
  hatchStreak: 0,
  capsulesOpened: 0,
  upgradesBought: 0,
  breedsCompleted: 0,
  firstUpgradeAt: null,
  firstBreedAt: null,
  coinsEarned: 0,
  rarityCounts: { Common: 0, Rare: 0, Epic: 0, Legendary: 0, Mythic: 0, Secret: 0 },
  tutorial: { firstHatch: false, collection: false, upgrade: false, daily: false, shop: false },
});

const runActiveSim = (label: string, durationMinutes: number, premiumCapsules = 0, seed = 42) => {
  const rng = createRng(seed);
  const state = createInitialState(premiumCapsules);

  hatch(state, rng);
  state.tutorial.collection = true;
  state.gems += 1;

  for (let second = 1; second <= durationMinutes * 60; second += 1) {
    const earned = totalIncome(state) / 60;
    state.coins += earned;
    state.coinsEarned += earned;

    if (second === 240 && !state.tutorial.daily) {
      state.tutorial.daily = true;
      state.coins += DAILY_REWARD.coins + 25;
      state.gems += DAILY_REWARD.gems;
      state.eggs += DAILY_REWARD.eggs + 1;
    }

    if (second === 300 && !state.tutorial.shop) {
      state.tutorial.shop = true;
      state.coins += 50;
      state.gems += 1;
    }

    if (state.creatures.length < 2 || state.premiumCapsules > 0) {
      hatch(state, rng);
    }

    if (state.creatures.length < 3 && state.eggs > 0 && state.coins >= getHatchCost(state) && state.firstBreedAt === null) {
      hatch(state, rng);
    }

    if (state.firstUpgradeAt === null) {
      upgradeBestAffordable(state, second, false);
    } else if (second % 30 === 0) {
      upgradeBestAffordable(state, second, state.firstBreedAt === null);
    }

    if (state.firstBreedAt === null) {
      breedIfReady(state, second);
    }
  }

  return { label, durationMinutes, state };
};

const runOfflineSim = (label: string, premiumCapsules = 0, seed = 77) => {
  const active = runActiveSim(label, 10, premiumCapsules, seed).state;
  const offlineEarned = totalIncome(active) * 12 * 60;
  return {
    label,
    durationMinutes: 24 * 60,
    state: {
      ...active,
      coins: active.coins + offlineEarned,
      coinsEarned: active.coinsEarned + offlineEarned,
    },
  };
};

const printResult = (result: ReturnType<typeof runActiveSim>) => {
  const { label, durationMinutes, state } = result;
  const avgIncome = state.creatures.length ? totalIncome(state) / state.creatures.length : 0;
  console.log(`\n${label} (${durationMinutes} minutes)`);
  console.log("----------------------------------------");
  console.log(`Coins balance: ${format(state.coins)}`);
  console.log(`Coins earned: ${format(state.coinsEarned)}`);
  console.log(`Capsules opened: ${state.capsulesOpened}`);
  console.log(`Upgrades bought: ${state.upgradesBought}`);
  console.log(`Average creature income: ${avgIncome.toFixed(1)} coins/min`);
  console.log(`Time to first upgrade: ${minutes(state.firstUpgradeAt)}`);
  console.log(`Time to first breed: ${minutes(state.firstBreedAt)}`);
  console.log(
    `Rarity distribution: ${RARITY_ORDER.map((rarity) => `${rarity} ${state.rarityCounts[rarity]}`).join(", ")}`,
  );
};

[
  runActiveSim("Free player", 10, 0, 11),
  runActiveSim("Free player", 30, 0, 12),
  runOfflineSim("Free player after 10m + offline cap", 0, 13),
  runActiveSim("Premium capsule player", 10, 3, 21),
  runActiveSim("Premium capsule player", 30, 3, 22),
  runOfflineSim("Premium player after 10m + offline cap", 3, 23),
].forEach(printResult);
