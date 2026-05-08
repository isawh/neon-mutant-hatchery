# Balance Notes

## Current Assumptions

This is still a local prototype economy. The first session assumes onboarding grants the one-time starter kit:

- 3 capsules
- 100 coins
- 5 gems

The temporary development reset mode remains active. Increase `DEV_SAVE_RESET_VERSION` in `src/constants.ts` when test devices need a fresh local save after deploy.

## Early Game Pacing

Current tuned targets from `npm run sim:balance`:

- First hatch: immediate from starter capsules and coins.
- First upgrade: around 1-2 minutes for free players, depending on first creature rarity and passive trait.
- First breed: around 5-8 minutes for guided free play.
- Premium capsules: speed up early income and reduce hatch friction, but still hit first breed around 5 minutes in the simulation.

Latest deterministic sim output:

| Scenario | First upgrade | First breed | 10m capsules | 10m upgrades |
| --- | ---: | ---: | ---: | ---: |
| Free player, 10m | 1.8m | 7.0m | 3 | 3 |
| Free player, 30m seed | 0.8m | 5.9m | 3 | 10 |
| Premium player, 10m | 0.0m | 5.0m | 3 | 4 |
| Premium player, 30m seed | 0.0m | 5.0m | 3 | 10 |

Premium can upgrade immediately because paid capsules avoid the first coin spend and create more income right away. That is intentional for testing, but the breed gate keeps it from collapsing the whole loop.

## Tuned Values

- Base hatch cost: `26` coins, scaling by total hatches and hatch streak.
- Base upgrade cost: `82` coins, scaling by level, rarity, and passive traits.
- Breed cost: `320` coins + `1` gem.
- Daily reward: `90` coins + `1` gem + `1` capsule, plus login streak coin bonus.

These values make the first hatch instant, keep the first upgrade close to the 1-2 minute target, and make breeding feel like the first meaningful medium goal.

## Rarity Odds

Base hatch odds remain:

- Common: 61.95%
- Rare: 24%
- Epic: 10%
- Legendary: 3.5%
- Mythic: 0.5%
- Secret: 0.05%

Premium capsules add a rarity bonus rather than guaranteeing high rarity. This makes premium feel better over several hatches without making free hatch outcomes irrelevant.

## Income Curve

Creature base income was raised so idle income is visible in the first minutes:

- Common: 7-10 coins/min
- Rare: 12-18 coins/min
- Epic: 24-36 coins/min
- Legendary: 46-72 coins/min
- Mythic: 92-140 coins/min
- Secret: 220-320 coins/min

Passive traits still multiply income, so high-rarity pulls and lucky trait rolls can create exciting variance. Upgrade costs scale with rarity and trait count to keep those rolls from becoming too cheap to level.

## Offline Income

Offline income is capped by the existing app logic. The simulator models 24 hours away as the current 12-hour offline cap after a 10-minute active start.

The 24-hour/offline scenarios produce large coin totals because offline income is meant to reward returning players. That value should mainly fund later upgrades and hatches, not bypass collection goals.

## Running The Sim

Run:

```bash
npm run sim:balance
```

The script prints:

- coins earned
- capsules opened
- upgrades bought
- average creature income
- time to first upgrade
- time to first breed
- rarity distribution
