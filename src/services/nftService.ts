import { loadGameState } from "../storage";
import type { Creature } from "../types";

export const buildCreatureMetadata = (creature: Creature) => ({
  name: creature.name,
  description: `Neon Mutant Hatchery ${creature.rarity} creature. Prototype metadata only.`,
  attributes: [
    { trait_type: "Rarity", value: creature.rarity },
    { trait_type: "Generation", value: creature.generation },
    { trait_type: "Level", value: creature.level },
    { trait_type: "Power", value: creature.powerScore },
    ...creature.passiveTraits.map((trait) => ({ trait_type: "Passive", value: trait })),
    ...creature.traits.map((trait) => ({ trait_type: "Mutation", value: trait })),
  ],
  properties: {
    colors: creature.colors,
    createdAt: creature.createdAt,
  },
});

export const mockMintCreature = (creatureId: string) => {
  // Blockchain needed: connect wallet, upload metadata, mint token, and persist token id server-side.
  const creature = loadGameState().creatures.find((item) => item.id === creatureId);
  if (!creature) {
    return null;
  }

  return {
    creatureId,
    mockTokenId: `mock_${creatureId}`,
    metadata: buildCreatureMetadata(creature),
    mintedAt: Date.now(),
  };
};
