# QA Checklist

Run this before deploying:

```bash
npm run build
npm run test:smoke
```

Deploy only if both commands pass.

## Manual Checks

### First Launch

- Open the app with a fresh local save.
- Confirm the Telegram SDK warning only appears outside Telegram.
- Confirm starter rewards are applied once after onboarding.
- Confirm no blank or clipped screen on load.

### Onboarding

- Confirm the first-open onboarding sequence appears.
- Step through all onboarding screens.
- Confirm the game remains playable after onboarding.
- Use Profile dev panel reset onboarding and confirm it appears again.

### Hatch

- Confirm the first hatch is immediately affordable.
- Confirm hatch animation, rarity reveal, screen flash for rare pulls, and haptics.
- Confirm coins/capsules decrement correctly for normal capsules.
- Confirm premium capsules are consumed before normal capsules.

### Collection

- Open Collection after a hatch.
- Confirm creature cards render with procedural visuals.
- Confirm rarity sorting, favorite button, and creature details modal.
- Confirm Album section shows rarity groups, progress bars, and claim buttons.
- Confirm claimed album rewards persist after refresh.

### Upgrade

- Upgrade an affordable creature.
- Confirm coins decrease, level increases, power/income update, and upgrade animation plays.
- Confirm level achievements progress and rewards can be claimed.

### Breed

- Select two different creatures.
- Confirm breed cost is shown as `320 coins + 1 gem`.
- Confirm breeding creates a child, increments breed achievements, and resets selection.
- Confirm invalid breed states are disabled.

### Daily Reward

- Claim the daily reward when available.
- Confirm coins, gems, and capsule rewards are added.
- Confirm daily reward cannot be claimed twice on the same day.
- Confirm beginner quest and daily mission progress update.

### Shop Mock Purchase

- Open Shop.
- Tap a Stars product.
- Confirm confirmation modal opens with product, Stars price, and reward.
- Confirm mock purchase grants local rewards and tracks analytics.
- Confirm no real invoice/payment is created.

### Referral Link

- Open Profile.
- Confirm referral code and referral link are visible.
- Copy referral link and confirm a success toast.
- Tap Telegram share and confirm it opens a Telegram share URL where available.
- Confirm invite count/reward behavior remains local-only.

### Fullscreen Mobile

- Launch inside Telegram mobile.
- Confirm the app requests fullscreen immediately.
- Confirm content respects top/bottom safe areas.
- Confirm bottom nav is visible and content does not hide behind it.
- Close/reopen the Mini App and wait 3 seconds; hatch chamber should remain stable.

### Fullscreen Desktop

- Launch inside desktop Telegram.
- Confirm fullscreen background uses the whole viewport.
- Confirm game content remains centered and readable.
- Wait 3 seconds; hatch chamber should not collapse or clip.
- Confirm desktop layout uses stable browser height, not a smaller delayed Telegram viewport height.

### Save Reset Mode

- Confirm Profile dev panel shows `DEV_SAVE_RESET_VERSION` and stored reset version.
- Use `Force Reset Save Now` and confirm save, onboarding, and analytics reset.
- Bump `DEV_SAVE_RESET_VERSION` in `src/constants.ts`, reload, and confirm all devices start fresh after deploy.

## Automated Smoke Test Coverage

`npm run test:smoke` checks:

- app builds
- important files exist
- constants are valid
- localStorage keys are defined
- rarity odds sum to 100
- mock products have valid ids, prices, and rewards
- achievements have unique ids and rewards
- daily missions have unique ids and rewards
