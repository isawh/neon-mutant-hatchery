export type MockProductId =
  | "premium_capsules_3"
  | "premium_capsules_10"
  | "gems_100"
  | "gems_500"
  | "double_income_24h"
  | "lucky_hatch_1h"
  | "mutation_storm_ticket";

export type MockProduct = {
  id: MockProductId;
  section: "capsules" | "gems" | "boosts" | "limited";
  title: string;
  description: string;
  starsPrice: number;
  rewardLabel: string;
  enabled: boolean;
  badge?: "Best Value" | "Limited";
  reward: {
    gems?: number;
    premiumCapsules?: number;
    incomeBoostMinutes?: number;
    luckyBoostMinutes?: number;
    mutationStormTickets?: number;
  };
};

const PRODUCTS: MockProduct[] = [
  {
    id: "premium_capsules_3",
    section: "capsules",
    title: "3 Premium Capsules",
    description: "Boosted hatch odds with stronger Epic+ chances.",
    starsPrice: 99,
    rewardLabel: "3 premium capsules",
    enabled: true,
    reward: { premiumCapsules: 3 },
  },
  {
    id: "premium_capsules_10",
    section: "capsules",
    title: "10 Premium Capsules",
    description: "Best for collection pushes without making free play obsolete.",
    starsPrice: 279,
    rewardLabel: "10 premium capsules",
    enabled: true,
    badge: "Best Value",
    reward: { premiumCapsules: 10 },
  },
  {
    id: "gems_100",
    section: "gems",
    title: "100 Gems",
    description: "A clean gem refill for breeding and upgrades.",
    starsPrice: 149,
    rewardLabel: "100 gems",
    enabled: true,
    reward: { gems: 100 },
  },
  {
    id: "gems_500",
    section: "gems",
    title: "500 Gems",
    description: "Large gem bundle for long breeding sessions.",
    starsPrice: 599,
    rewardLabel: "500 gems",
    enabled: true,
    badge: "Best Value",
    reward: { gems: 500 },
  },
  {
    id: "double_income_24h",
    section: "boosts",
    title: "Double Income 24h",
    description: "Doubles idle output for a day. Helpful, never mandatory.",
    starsPrice: 229,
    rewardLabel: "24h income boost",
    enabled: true,
    reward: { incomeBoostMinutes: 24 * 60 },
  },
  {
    id: "lucky_hatch_1h",
    section: "boosts",
    title: "Lucky Hatch 1h",
    description: "Raises rare odds during focused hatching.",
    starsPrice: 179,
    rewardLabel: "1h lucky hatch",
    enabled: true,
    reward: { luckyBoostMinutes: 60 },
  },
  {
    id: "mutation_storm_ticket",
    section: "limited",
    title: "Mutation Storm Ticket",
    description: "Triggers a local Mutation Storm event for better Epic+ odds.",
    starsPrice: 249,
    rewardLabel: "1 storm ticket",
    enabled: true,
    badge: "Limited",
    reward: { mutationStormTickets: 1 },
  },
];

export const getProducts = () => PRODUCTS.filter((product) => product.enabled);

export const purchaseProduct = (productId: string) => {
  // Local fallback only. Real Telegram Stars purchases go through backend payment endpoints.
  const product = PRODUCTS.find((item) => item.id === productId);
  if (!product) {
    return null;
  }
  return {
    product,
    purchasedAt: Date.now(),
  };
};
