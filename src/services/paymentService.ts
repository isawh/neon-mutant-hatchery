import type { LimitedOfferId } from "../types";

export type MockProductId =
  | "stars_premium_capsules_3"
  | "stars_premium_capsules_10"
  | "stars_gems_100"
  | "stars_gems_500"
  | "stars_double_income_24h"
  | "stars_lucky_hatch_1h"
  | "stars_mutation_storm_ticket";

export type MockProduct = {
  id: MockProductId;
  section: "capsules" | "gems" | "boosts" | "limited";
  title: string;
  description: string;
  stars: number;
  rewardLabel: string;
  badge?: "Best Value" | "Limited";
  reward: {
    gems?: number;
    premiumCapsules?: number;
    incomeBoostMinutes?: number;
    luckyBoostMinutes?: number;
    mutationStormTickets?: number;
    limitedOfferId?: LimitedOfferId;
  };
};

const PRODUCTS: MockProduct[] = [
  {
    id: "stars_premium_capsules_3",
    section: "capsules",
    title: "3 Premium Capsules",
    description: "Boosted hatch odds with stronger Epic+ chances.",
    stars: 99,
    rewardLabel: "3 premium capsules",
    reward: { premiumCapsules: 3 },
  },
  {
    id: "stars_premium_capsules_10",
    section: "capsules",
    title: "10 Premium Capsules",
    description: "Best for collection pushes without making free play obsolete.",
    stars: 279,
    rewardLabel: "10 premium capsules",
    badge: "Best Value",
    reward: { premiumCapsules: 10 },
  },
  {
    id: "stars_gems_100",
    section: "gems",
    title: "100 Gems",
    description: "A clean gem refill for breeding and upgrades.",
    stars: 149,
    rewardLabel: "100 gems",
    reward: { gems: 100 },
  },
  {
    id: "stars_gems_500",
    section: "gems",
    title: "500 Gems",
    description: "Large gem bundle for long breeding sessions.",
    stars: 599,
    rewardLabel: "500 gems",
    badge: "Best Value",
    reward: { gems: 500 },
  },
  {
    id: "stars_double_income_24h",
    section: "boosts",
    title: "Double Income 24h",
    description: "Doubles idle output for a day. Helpful, never mandatory.",
    stars: 229,
    rewardLabel: "24h income boost",
    reward: { incomeBoostMinutes: 24 * 60, limitedOfferId: "double_income" },
  },
  {
    id: "stars_lucky_hatch_1h",
    section: "boosts",
    title: "Lucky Hatch 1h",
    description: "Raises rare odds during focused hatching.",
    stars: 179,
    rewardLabel: "1h lucky hatch",
    reward: { luckyBoostMinutes: 60, limitedOfferId: "lucky_hatch" },
  },
  {
    id: "stars_mutation_storm_ticket",
    section: "limited",
    title: "Mutation Storm Ticket",
    description: "Triggers a local Mutation Storm event for better Epic+ odds.",
    stars: 249,
    rewardLabel: "1 storm ticket",
    badge: "Limited",
    reward: { mutationStormTickets: 1 },
  },
];

export const getProducts = () => PRODUCTS;

export const purchaseProduct = (productId: MockProductId) => {
  // Backend needed: create Telegram Stars invoice, validate payment webhook, then grant rewards.
  const product = PRODUCTS.find((item) => item.id === productId);
  if (!product) {
    return null;
  }
  return {
    product,
    purchasedAt: Date.now(),
  };
};
