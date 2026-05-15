import {
  ACHIEVEMENTS,
  AURA_STYLES,
  BODY_SHAPES,
  BREED_COIN_COST,
  CREATURE_ARCHETYPES,
  CREATURE_ARCHETYPE_LABELS,
  DAILY_LOGIN_REWARDS,
  DAILY_MISSION_POOL,
  DEV_SAVE_RESET_VERSION,
  DUPLICATE_SHARDS_BY_RARITY,
  EYE_TYPES,
  EVENT_ROTATION_INTERVAL_MS,
  FUSION_BASE_COIN_COST,
  FUSION_BASE_SHARD_COST,
  HATCH_BASE_COST,
  HORN_TYPES,
  INITIAL_STATE,
  MUTATION_EFFECTS,
  PATTERN_STYLES,
  PREMIUM_RARITY_CHANCES,
  RARE_EVENTS,
  RARITY_CHANCE_CAPS,
  RARITY_ALBUM_GOALS,
  RARITY_CONFIG,
  RARITY_ORDER,
  SESSION_REWARDS,
  STORAGE_KEY,
  TABS,
  TUTORIAL_TASKS,
  UPGRADE_BASE_COST,
} from "../src/constants.js";
import { getProducts } from "../src/services/paymentService.js";

declare const process: any;

type Check = {
  name: string;
  run: () => void;
};

const nodeImport = (specifier: string) => import(specifier);
const fs = (await nodeImport("node:fs")) as any;
const path = (await nodeImport("node:path")) as any;
const childProcess = (await nodeImport("node:child_process")) as any;

const root = process.cwd();

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const unique = <T,>(items: T[]) => new Set(items).size === items.length;

const hasReward = (reward: Record<string, unknown>) =>
  Object.values(reward).some((value) => typeof value === "number" && value > 0);

const expectedProductIds = new Set([
  "premium_capsules_3",
  "premium_capsules_10",
  "gems_100",
  "gems_500",
  "double_income_24h",
  "lucky_hatch_1h",
  "mutation_storm_ticket",
]);

const checkFiles = () => {
  [
    "index.html",
    "package.json",
    "src/App.tsx",
    "src/constants.ts",
    "src/game.ts",
    "src/storage.ts",
    "src/telegram.ts",
    "src/services/soundService.ts",
    "src/services/paymentService.ts",
    "scripts/balance-sim.ts",
    "scripts/smoke-test.ts",
    "QA.md",
    "BALANCE.md",
  ].forEach((filePath) => {
    assert(fs.existsSync(path.join(root, filePath)), `Missing required file: ${filePath}`);
  });
};

const checkBuild = () => {
  childProcess.execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
};

const checks: Check[] = [
  {
    name: "important files exist",
    run: checkFiles,
  },
  {
    name: "localStorage keys are defined",
    run: () => {
      assert(typeof STORAGE_KEY === "string" && STORAGE_KEY.includes("neon-mutant-hatchery"), "Invalid STORAGE_KEY");
      assert(
        typeof DEV_SAVE_RESET_VERSION === "string" && DEV_SAVE_RESET_VERSION.length >= 6,
        "Invalid DEV_SAVE_RESET_VERSION",
      );
    },
  },
  {
    name: "constants are valid",
    run: () => {
      assert(HATCH_BASE_COST > 0, "HATCH_BASE_COST must be positive");
      assert(UPGRADE_BASE_COST > HATCH_BASE_COST, "UPGRADE_BASE_COST should be higher than hatch base cost");
      assert(BREED_COIN_COST > UPGRADE_BASE_COST, "BREED_COIN_COST should be a medium-term goal");
      assert(FUSION_BASE_COIN_COST > HATCH_BASE_COST, "FUSION_BASE_COIN_COST should be a resource sink");
      assert(FUSION_BASE_SHARD_COST > 0, "FUSION_BASE_SHARD_COST should be positive");
      assert(INITIAL_STATE.coins >= 0 && INITIAL_STATE.gems >= 0 && INITIAL_STATE.eggs >= 0, "Initial resources invalid");
      assert(INITIAL_STATE.mutantShards === 0, "Initial mutant shards should start at zero");
      assert(TABS.length === 5 && unique(TABS.map((tab) => tab.id)), "Tabs must contain five unique ids");
      assert(TUTORIAL_TASKS.length > 0 && unique(TUTORIAL_TASKS.map((task) => task.id)), "Tutorial task ids invalid");
      assert(DAILY_LOGIN_REWARDS.length === 7, "Daily login calendar must have seven days");
      assert(unique(SESSION_REWARDS.map((reward) => reward.id)), "Session reward ids must be unique");
      assert(EVENT_ROTATION_INTERVAL_MS > 0, "Event rotation interval must be positive");
      assert(RARE_EVENTS.length >= 4 && unique(RARE_EVENTS.map((event) => event.id)), "Live event ids invalid");
      assert(BODY_SHAPES.length >= 12 && unique(BODY_SHAPES), "Body shape variety invalid");
      assert(CREATURE_ARCHETYPES.length >= 12 && unique(CREATURE_ARCHETYPES), "Creature archetype variety invalid");
      CREATURE_ARCHETYPES.forEach((archetype) => {
        assert(CREATURE_ARCHETYPE_LABELS[archetype], `Missing archetype label for ${archetype}`);
      });
      assert(EYE_TYPES.length >= 12 && unique(EYE_TYPES), "Eye type variety invalid");
      assert(HORN_TYPES.length >= 10 && unique(HORN_TYPES), "Horn type variety invalid");
      assert(AURA_STYLES.length >= 10 && unique(AURA_STYLES), "Aura style variety invalid");
      assert(PATTERN_STYLES.length >= 12 && unique(PATTERN_STYLES), "Pattern style variety invalid");
      assert(MUTATION_EFFECTS.length >= 10 && unique(MUTATION_EFFECTS), "Mutation effect variety invalid");
      SESSION_REWARDS.forEach((reward) => {
        assert(reward.minutes > 0, `Session reward minutes invalid for ${reward.id}`);
        assert(hasReward(reward.reward), `Session reward missing for ${reward.id}`);
      });
      RARE_EVENTS.forEach((event) => {
        assert(event.durationMs > 0 && event.durationMs <= EVENT_ROTATION_INTERVAL_MS, `Event duration invalid for ${event.id}`);
      });
    },
  },
  {
    name: "rarity odds sum correctly",
    run: () => {
      const totalChance = RARITY_ORDER.reduce((sum, rarity) => sum + RARITY_CONFIG[rarity].chance, 0);
      const premiumTotalChance = RARITY_ORDER.reduce((sum, rarity) => sum + PREMIUM_RARITY_CHANCES[rarity], 0);
      assert(Math.abs(totalChance - 100) < 0.001, `Rarity odds must sum to 100, got ${totalChance}`);
      assert(
        Math.abs(premiumTotalChance - 100) < 0.001,
        `Premium rarity odds must sum to 100, got ${premiumTotalChance}`,
      );
      assert(RARITY_CONFIG.Common.chance === 72, "Common base odds must be 72%");
      assert(RARITY_CONFIG.Rare.chance === 22, "Rare base odds must be 22%");
      assert(RARITY_CONFIG.Epic.chance === 5, "Epic base odds must be 5%");
      assert(RARITY_CONFIG.Legendary.chance === 0.8, "Legendary base odds must be 0.8%");
      assert(RARITY_CONFIG.Mythic.chance === 0.18, "Mythic base odds must be 0.18%");
      assert(RARITY_CONFIG.Secret.chance === 0.02, "Secret base odds must be 0.02%");
      assert(RARITY_CHANCE_CAPS.Legendary === 6, "Legendary odds cap must be 6%");
      assert(RARITY_CHANCE_CAPS.Mythic === 1.5, "Mythic odds cap must be 1.5%");
      assert(RARITY_CHANCE_CAPS.Secret === 0.2, "Secret odds cap must be 0.2%");
      RARITY_ORDER.forEach((rarity) => {
        const config = RARITY_CONFIG[rarity];
        assert(config.minIncome > 0 && config.maxIncome >= config.minIncome, `Invalid income range for ${rarity}`);
        assert(DUPLICATE_SHARDS_BY_RARITY[rarity] > 0, `Duplicate shard reward missing for ${rarity}`);
        assert(RARITY_ALBUM_GOALS[rarity].total > 0, `Invalid album total for ${rarity}`);
        assert(hasReward(RARITY_ALBUM_GOALS[rarity].reward), `Missing album reward for ${rarity}`);
      });
    },
  },
  {
    name: "products have valid ids and prices",
    run: () => {
      const products = getProducts();
      assert(products.length > 0, "No mock products configured");
      assert(unique(products.map((product) => product.id)), "Product ids must be unique");
      products.forEach((product) => {
        assert(expectedProductIds.has(product.id), `Unexpected product id: ${product.id}`);
        assert(Number.isInteger(product.starsPrice) && product.starsPrice > 0, `Invalid Stars price for ${product.id}`);
        assert(hasReward(product.reward), `Product reward missing for ${product.id}`);
      });
    },
  },
  {
    name: "achievements have unique ids and rewards",
    run: () => {
      assert(ACHIEVEMENTS.length > 0, "No achievements configured");
      assert(unique(ACHIEVEMENTS.map((achievement) => achievement.id)), "Achievement ids must be unique");
      ACHIEVEMENTS.forEach((achievement) => {
        assert(achievement.target > 0, `Achievement target invalid for ${achievement.id}`);
        assert(hasReward(achievement.reward), `Achievement reward missing for ${achievement.id}`);
      });
    },
  },
  {
    name: "missions have unique ids and rewards",
    run: () => {
      const missions = Object.values(DAILY_MISSION_POOL);
      assert(missions.length > 0, "No daily missions configured");
      assert(unique(missions.map((mission: any) => mission.id)), "Daily mission ids must be unique");
      missions.forEach((mission: any) => {
        assert(mission.target > 0, `Mission target invalid for ${mission.id}`);
        assert(hasReward(mission.reward), `Mission reward missing for ${mission.id}`);
      });
    },
  },
  {
    name: "app builds",
    run: checkBuild,
  },
];

console.log("Running smoke checks...");

for (const check of checks) {
  check.run();
  console.log(`PASS ${check.name}`);
}

console.log("Smoke checks passed.");
