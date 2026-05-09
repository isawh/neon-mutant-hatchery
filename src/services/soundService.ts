import type { Rarity } from "../types";

const SOUND_ENABLED_KEY = "neon-mutant-hatchery:sound-enabled";

const readSoundSetting = () => {
  try {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
};

const writeSoundSetting = (enabled: boolean) => {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // Restrictive Telegram WebViews can block storage. Sound hooks should stay harmless.
  }
};

const playPlaceholder = (eventName: string, payload: Record<string, unknown> = {}) => {
  if (!readSoundSetting()) {
    return;
  }

  // Placeholder for future WebAudio/audio-sprite implementation.
  // Keep this side-effect tiny so Telegram mobile performance is unaffected.
  console.debug("[sound-placeholder]", eventName, payload);
};

export const playHatchStart = () => playPlaceholder("hatch_start");

export const playHatchReveal = (rarity: Rarity) => playPlaceholder("hatch_reveal", { rarity });

export const playButtonTap = () => playPlaceholder("button_tap");

export const playRewardClaim = () => playPlaceholder("reward_claim");

export const playPurchaseSuccess = () => playPlaceholder("purchase_success");

export const toggleSound = () => {
  const next = !readSoundSetting();
  writeSoundSetting(next);
  return next;
};

export const isSoundEnabled = () => readSoundSetting();
