import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  DEV_SAVE_RESET_VERSION,
  BREED_COIN_COST,
  BREED_GEM_COST,
  DAILY_LOGIN_REWARDS,
  INITIAL_STATE,
  INVITE_MILESTONES,
  LIMITED_OFFERS,
  NAME_PREFIXES,
  NAME_SUFFIXES,
  PASSIVE_TRAIT_CONFIG,
  RARITY_CONFIG,
  RARITY_ORDER,
  TABS,
} from "./constants";
import {
  applyLoginStreak,
  applyStarterRewards,
  breedCreatures,
  buyLimitedOffer,
  calculateOfflineIncome,
  claimAchievementReward,
  claimAlbumReward,
  canClaimDailyReward,
  claimDailyReward,
  claimFullAlbumReward,
  claimFreeCapsule,
  claimMissionReward,
  claimSessionReward,
  claimTutorialReward,
  collectTickIncome,
  completeTutorialTask,
  ensureTutorialState,
  ensureLiveOpsState,
  ensureProgressionState,
  getFullAlbumProgress,
  getRarityAlbumProgress,
  getBoostedIncomePerMinute,
  getCreatureIncomePerMinute,
  getDailyLoginReward,
  getHatchCost,
  getHatchStreakLuckBonus,
  getHatchStreakRemaining,
  getPowerScore,
  getRarityChances,
  getSessionRewardProgress,
  getTotalIncomePerMinute,
  getUpgradeCost,
  hatchEgg,
  resetOnboardingProgress,
  toggleFavoriteCreature,
  upgradeCreature,
} from "./game";
import {
  forceResetGameStateNow,
  getStoredDevSaveResetVersion,
  loadGameState,
  resetGameState,
  saveGameState,
} from "./storage";
import {
  getTelegramStartParam,
  getTelegramViewportState,
  haptic,
  initTelegramFullscreen,
  openTelegramInvoice,
  shareTelegramInvite,
} from "./telegram";
import { getAnalyticsEventCount, trackEvent } from "./services/analyticsService";
import {
  authenticateWithTelegram,
  checkBackendHealth,
  claimReferralMilestoneWithBackend,
  completeMockPayment,
  createPaymentInvoice,
  getApiBaseUrl,
  getRawApiUrl,
  isBackendConfigured,
  loadBackendProducts,
  loadCloudSave,
  loadPurchaseStatus,
  loadReferralStats,
  registerReferralWithBackend,
  saveCloudSave,
  simulateReferralWithBackend,
  type BackendProduct,
  type BackendReferralStats,
  type MockCompletePaymentResponse,
  type ReferralReward,
} from "./services/apiClient";
import { getCurrentPlayer, isTelegramEnvironment } from "./services/authService";
import { buildCreatureMetadata, mockMintCreature } from "./services/nftService";
import { getProducts, purchaseProduct } from "./services/paymentService";
import {
  buildReferralLink,
  ensureReferralCode,
  syncReferralStats,
} from "./services/referralService";
import type {
  AchievementId,
  Creature,
  GameState,
  LimitedOfferId,
  MissionId,
  Rarity,
  SessionRewardId,
  TabId,
  TutorialTaskId,
} from "./types";
import "./styles.css";

const formatNumber = (value: number) => Math.floor(value).toLocaleString("en-US");

const formatDuration = (ms: number) => {
  if (ms <= 0) {
    return "Ready";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatReward = (reward: GameState["tutorialTasks"][number]["reward"]) =>
  [
    reward.coins ? `${formatNumber(reward.coins)} coins` : "",
    reward.gems ? `${formatNumber(reward.gems)} gems` : "",
    reward.eggs ? `${formatNumber(reward.eggs)} capsules` : "",
    reward.premiumCapsules ? `${formatNumber(reward.premiumCapsules)} premium` : "",
    reward.incomeBoostMinutes ? `${formatNumber(reward.incomeBoostMinutes)}m income` : "",
    reward.luckyBoostMinutes ? `${formatNumber(reward.luckyBoostMinutes)}m luck` : "",
  ]
    .filter(Boolean)
    .join(" + ");

const ONBOARDING_STEPS = [
  {
    title: "Welcome to Neon Hatch",
    body: "You are running a compact mutant capsule lab inside Telegram.",
  },
  {
    title: "Hatch capsules to discover mutants",
    body: "Every hatch creates a procedural creature with rarity, traits, colors, and income.",
  },
  {
    title: "Mutants generate coins over time",
    body: "Coins keep building while you play and after you leave.",
  },
  {
    title: "Upgrade and breed stronger mutants",
    body: "Level up your best pulls, then combine parents to chase better generations.",
  },
  {
    title: "Invite friends to earn rewards",
    body: "Share your Telegram invite code for gems, capsules, colors, and rare boosts.",
  },
];

const rarityRank = (rarity: Rarity) => RARITY_ORDER.indexOf(rarity);

const isRareOrBetter = (rarity: Rarity) => rarityRank(rarity) >= rarityRank("Rare");

const isFlexRarity = (rarity: Rarity) => rarityRank(rarity) >= rarityRank("Epic");

const getRevealClass = (rarity: Rarity) => {
  if (rarity === "Secret") {
    return "reveal-secret";
  }
  if (rarity === "Common") {
    return "reveal-fast";
  }
  if (rarity === "Rare") {
    return "reveal-glow";
  }
  return "reveal-dramatic";
};

const getRevealDelay = (rarity: Rarity) => {
  if (rarity === "Secret") {
    return 1480;
  }
  if (rarity === "Common") {
    return 420;
  }
  if (rarity === "Rare") {
    return 720;
  }
  return 1080;
};

const hapticForRarity = (rarity: Rarity) => {
  if (rarity === "Common") {
    haptic.impact("light");
  } else if (rarity === "Rare") {
    haptic.impact("medium");
  } else if (rarity === "Secret") {
    haptic.impact("heavy");
    window.setTimeout(() => haptic.impact("heavy"), 120);
  } else {
    haptic.impact("heavy");
  }
};

const playSecretSoundPlaceholder = (creature: Creature) => {
  console.log("[sound-placeholder] secret_hatch", {
    creatureId: creature.id,
    name: creature.name,
    rarity: creature.rarity,
  });
};

type SaveSource = "local" | "cloud";
type PaymentsMode = "local" | "mock" | "backend";
type BackendHealthStatus = "off" | "checking" | "ok" | "failed";
type ShopProduct = BackendProduct;

const getIncomingReferralCode = () => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("ref") ?? url.searchParams.get("startapp") ?? getTelegramStartParam() ?? "";
  } catch {
    return getTelegramStartParam() ?? "";
  }
};

const preparePlayableState = (baseState: GameState, incomingReferral = "") => {
  const loaded = calculateOfflineIncome(baseState);
  const state = ensureProgressionState(
    applyStarterRewards(ensureReferralCode(ensureLiveOpsState(syncReferralStats(applyLoginStreak(loaded.state))))),
  );

  return {
    state,
    offlineEarned: loaded.earned,
  };
};

const loadPlayableState = () => {
  try {
    const playable = preparePlayableState(loadGameState());
    return {
      state: playable.state,
      error: false,
    };
  } catch {
    return {
      state: ensureProgressionState(applyStarterRewards({ ...INITIAL_STATE, lastActiveAt: Date.now() })),
      error: true,
    };
  }
};

function CreatureVisual({
  creature,
  large = false,
  reveal = false,
}: {
  creature: Creature;
  large?: boolean;
  reveal?: boolean;
}) {
  const visualDna = creature.visualDna ?? {
    bodyShape: "blob",
    eyeType: "round",
    hornType: "antenna",
    auraStyle: "soft",
    patternStyle: "spots",
    mutationEffect: "spark",
  };

  return (
    <div
      className={`creature-visual creature-${creature.rarity.toLowerCase()} body-${visualDna.bodyShape} eyes-${visualDna.eyeType} horns-${visualDna.hornType} aura-${visualDna.auraStyle} pattern-${visualDna.patternStyle} mutation-${visualDna.mutationEffect} ${
        large ? "creature-visual-large" : ""
      } ${reveal ? getRevealClass(creature.rarity) : ""}`}
      style={
        {
          "--body": creature.colors.body,
          "--accent": creature.colors.accent,
          "--glow": creature.colors.glow,
          "--eye": creature.colors.eye,
          "--tilt": `${(creature.id.charCodeAt(0) % 12) - 6}deg`,
        } as CSSProperties
      }
    >
      <div className="creature-aura" />
      <div className="creature-aura creature-aura-outer" />
      <div className="creature-particles">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="creature-horn creature-horn-left" />
      <div className="creature-horn creature-horn-right" />
      <div className="creature-body">
        <span className="creature-eye creature-eye-left" />
        <span className="creature-eye creature-eye-right" />
        <span className="creature-mouth" />
        <span className="creature-spot creature-spot-one" />
        <span className="creature-spot creature-spot-two" />
        <span className="creature-ridge creature-ridge-one" />
        <span className="creature-ridge creature-ridge-two" />
      </div>
      <div className="creature-tentacle creature-tentacle-one" />
      <div className="creature-tentacle creature-tentacle-two" />
      <div className="creature-tentacle creature-tentacle-three" />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AnimatedStatPill({ label, value }: { label: string; value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    const start = previousValue.current;
    const delta = value - start;
    const startedAt = performance.now();
    const duration = Math.min(900, Math.max(280, Math.abs(delta) * 8));
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + delta * eased);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        previousValue.current = value;
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [value]);

  return <StatPill label={label} value={formatNumber(displayValue)} />;
}

function CreatureCard({
  creature,
  selected,
  compact,
  onClick,
  onUpgrade,
  onFavorite,
  canUpgrade,
  isFavorite,
  upgrading,
  highlightUpgrade,
}: {
  creature: Creature;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onUpgrade?: () => void;
  onFavorite?: () => void;
  canUpgrade?: boolean;
  isFavorite?: boolean;
  upgrading?: boolean;
  highlightUpgrade?: boolean;
}) {
  const income = getCreatureIncomePerMinute(creature);

  return (
    <article
      className={`creature-card ${RARITY_CONFIG[creature.rarity].className} ${
        selected ? "selected" : ""
      } ${compact ? "compact" : ""} ${upgrading ? "upgrading" : ""}`}
      onClick={onClick}
    >
      <div className="card-topline">
        <span>{creature.rarity}</span>
        <div className="card-badges">
          {creature.isNew ? <span className="new-badge">NEW</span> : null}
          <span>Gen {creature.generation}</span>
        </div>
      </div>
      {onFavorite ? (
        <button
          className={`favorite-button ${isFavorite ? "active" : ""}`}
          aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          onClick={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
        >
          {isFavorite ? "FAV" : "PIN"}
        </button>
      ) : null}
      <CreatureVisual creature={creature} />
      <div className="creature-info">
        <h3>{creature.name}</h3>
        <p>{formatNumber(income)} coins/min</p>
      </div>
      <div className="card-stat-grid">
        <span>
          <strong>{creature.level}</strong>
          Level
        </span>
        <span>
          <strong>{creature.generation}</strong>
          Gen
        </span>
        <span>
          <strong>{formatNumber(getPowerScore(creature))}</strong>
          Power
        </span>
      </div>
      {creature.passiveTraits.length ? (
        <div className="passive-row">
          {creature.passiveTraits.map((trait) => (
            <span key={trait}>{trait}</span>
          ))}
        </div>
      ) : null}
      <div className="trait-row">
        {creature.traits.map((trait) => (
          <span key={trait}>{trait}</span>
        ))}
      </div>
      {onUpgrade ? (
        <button
          className={`mini-button ${highlightUpgrade ? "tutorial-glow" : ""}`}
          disabled={!canUpgrade}
          onClick={(event) => {
            event.stopPropagation();
            onUpgrade();
          }}
        >
          Upgrade - {formatNumber(getUpgradeCost(creature))}
        </button>
      ) : null}
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <div className="empty-orb" />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("hatch");
  const initialLoad = useMemo(loadPlayableState, []);
  const [state, setState] = useState<GameState>(initialLoad.state);
  const [stateLoadError, setStateLoadError] = useState(initialLoad.error);
  const [lastHatched, setLastHatched] = useState<Creature | null>(null);
  const [offlineEarned, setOfflineEarned] = useState(0);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [breedSelection, setBreedSelection] = useState<string[]>([]);
  const [isHatching, setIsHatching] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [floatingCoins, setFloatingCoins] = useState<Array<{ id: number; amount: number }>>([]);
  const [collectionSort, setCollectionSort] = useState<"rarity" | "power" | "income">("rarity");
  const [detailCreatureId, setDetailCreatureId] = useState<string | null>(null);
  const [upgradingCreatureId, setUpgradingCreatureId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notifications, setNotifications] = useState<Array<{ id: number; text: string; tone: "good" | "event" }>>([]);
  const [analyticsCount, setAnalyticsCount] = useState(() => getAnalyticsEventCount());
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [revealRarity, setRevealRarity] = useState<Rarity | null>(null);
  const [screenFlash, setScreenFlash] = useState<Rarity | null>(null);
  const [recentRareHatch, setRecentRareHatch] = useState<Creature | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [backendConnected, setBackendConnected] = useState(false);
  const [cloudPlayerId, setCloudPlayerId] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState("");
  const [saveSource, setSaveSource] = useState<SaveSource>("local");
  const [cloudSyncBusy, setCloudSyncBusy] = useState(false);
  const [backendReferralStats, setBackendReferralStats] = useState<BackendReferralStats | null>(null);
  const [referralBusy, setReferralBusy] = useState(false);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>(() => getProducts());
  const [paymentsMode, setPaymentsMode] = useState<PaymentsMode>("local");
  const [lastPurchaseStatus, setLastPurchaseStatus] = useState("None");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [pendingMockProductId, setPendingMockProductId] = useState<string | null>(null);
  const [shopMockEnabled, setShopMockEnabled] = useState(false);
  const [lastInvoiceMode, setLastInvoiceMode] = useState("none");
  const [lastInvoiceStatus, setLastInvoiceStatus] = useState("none");
  const [lastInvoiceLinkExists, setLastInvoiceLinkExists] = useState(false);
  const [backendHealthStatus, setBackendHealthStatus] = useState<BackendHealthStatus>("off");
  const [lastBackendError, setLastBackendError] = useState("");
  const floatingCoinId = useRef(0);
  const notificationId = useRef(0);
  const didInitRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const cloudSaveTimerRef = useRef<number | null>(null);
  const pendingCloudStateRef = useRef<GameState>(initialLoad.state);
  const lastCloudSavedJsonRef = useRef("");
  const player = useMemo(() => getCurrentPlayer(), []);
  const pendingProduct = pendingProductId ? shopProducts.find((product) => product.id === pendingProductId) ?? null : null;
  const currentOrigin = typeof window === "undefined" ? import.meta.env.VITE_PUBLIC_APP_URL : window.location.origin;
  const environmentMode = import.meta.env.MODE;
  const backendConfigured = isBackendConfigured();
  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get("debug") === "1";
  }, []);
  const rawApiUrl = getRawApiUrl();
  const resolvedApiBaseUrl = getApiBaseUrl();
  const currentPlayerId = cloudPlayerId ?? player.id;
  const lastCloudSyncLabel = lastCloudSyncAt ? new Date(lastCloudSyncAt).toLocaleTimeString() : "Never";
  const telegramViewport = getTelegramViewportState();
  const storedDevResetVersion = getStoredDevSaveResetVersion();
  const totalSpecies = NAME_PREFIXES.length * NAME_SUFFIXES.length;
  const discoveredCount = new Set(state.discoveredCreatureNames).size;
  const undiscoveredCount = Math.max(0, totalSpecies - discoveredCount);
  const collectionPercent = totalSpecies ? Math.min(100, Math.round((discoveredCount / totalSpecies) * 100)) : 0;
  const progressionState = useMemo(() => ensureProgressionState(state), [state]);
  const albumGroups = useMemo(
    () => RARITY_ORDER.map((rarity) => getRarityAlbumProgress(progressionState, rarity)),
    [progressionState],
  );
  const fullAlbum = useMemo(() => getFullAlbumProgress(progressionState), [progressionState]);
  const visibleAchievements = useMemo(
    () =>
      [...progressionState.achievements].sort((a, b) => {
        const readyDelta =
          Number(b.progress >= b.target && !b.claimed) - Number(a.progress >= a.target && !a.claimed);
        if (readyDelta) {
          return readyDelta;
        }
        const claimedDelta = Number(a.claimed) - Number(b.claimed);
        if (claimedDelta) {
          return claimedDelta;
        }
        return b.progress / b.target - a.progress / a.target;
      }),
    [progressionState.achievements],
  );
  const unclaimedAchievementCount = visibleAchievements.filter(
    (achievement) => achievement.progress >= achievement.target && !achievement.claimed,
  ).length;

  const totalIncome = useMemo(() => getTotalIncomePerMinute(state.creatures), [state.creatures]);
  const boostedIncome = useMemo(() => getBoostedIncomePerMinute(state), [state, now]);
  const hatchCost = useMemo(() => getHatchCost(state), [state]);
  const canClaimDaily = useMemo(() => canClaimDailyReward(state, now), [state, now]);
  const dailyLoginReward = useMemo(() => getDailyLoginReward(state), [state]);
  const freeCapsuleRemaining = Math.max(0, state.freeCapsuleReadyAt - now);
  const hatchStreakRemaining = getHatchStreakRemaining(state, now);
  const hatchLuckBonus = getHatchStreakLuckBonus(state, now);
  const sessionRewards = useMemo(() => getSessionRewardProgress(state, now), [state, now]);
  const nextSessionReward = sessionRewards.find((reward) => !reward.claimed);
  const activeEventRemaining = state.activeEvent?.endsAt ? Math.max(0, state.activeEvent.endsAt - now) : 0;
  const currentTutorialTask = state.tutorialTasks.find((task) => !task.claimed) ?? null;
  const tutorialTaskReady = Boolean(currentTutorialTask?.completed && !currentTutorialTask.claimed);
  const referralLink = useMemo(() => {
    return buildReferralLink(backendReferralStats?.referralCode ?? state.referralCode);
  }, [backendReferralStats?.referralCode, state.referralCode]);
  const detailCreature = detailCreatureId
    ? state.creatures.find((creature) => creature.id === detailCreatureId) ?? null
    : null;
  const sortedCreatures = useMemo(() => {
    const favoriteIds = new Set(state.favoriteCreatureIds);
    return [...state.creatures].sort((a, b) => {
      const favoriteDelta = Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id));
      if (favoriteDelta) {
        return favoriteDelta;
      }
      if (collectionSort === "power") {
        return getPowerScore(b) - getPowerScore(a);
      }
      if (collectionSort === "income") {
        return getCreatureIncomePerMinute(b) - getCreatureIncomePerMinute(a);
      }
      return rarityRank(b.rarity) - rarityRank(a.rarity) || getPowerScore(b) - getPowerScore(a);
    });
  }, [collectionSort, state.creatures, state.favoriteCreatureIds]);
  const strongestCreature = useMemo(
    () =>
      [...state.creatures].sort((a, b) => {
        const rarityDelta = rarityRank(b.rarity) - rarityRank(a.rarity);
        return rarityDelta || getPowerScore(b) - getPowerScore(a);
      })[0],
    [state.creatures],
  );

  const notify = (text: string, tone: "good" | "event" = "good") => {
    const id = notificationId.current + 1;
    notificationId.current = id;
    setNotifications((items) => [...items.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setNotifications((items) => items.filter((item) => item.id !== id));
    }, 2400);
  };

  const track = (name: Parameters<typeof trackEvent>[0], payload?: Record<string, unknown>) => {
    trackEvent(name, { playerId: player.id, ...payload });
    setAnalyticsCount(getAnalyticsEventCount());
  };

  const applyBackendReferralReward = (reward: ReferralReward) => {
    setState((current) =>
      ensureProgressionState({
        ...current,
        gems: current.gems + (reward.gems ?? 0),
        eggs: current.eggs + (reward.eggs ?? 0),
        premiumCapsules: current.premiumCapsules + (reward.premiumCapsules ?? 0),
        rareChanceBonus: current.rareChanceBonus + (reward.rareChanceBonus ?? 0),
        exclusiveColors: reward.exclusiveColor
          ? Array.from(new Set([...current.exclusiveColors, reward.exclusiveColor]))
          : current.exclusiveColors,
        lastActiveAt: Date.now(),
      }),
    );
  };

  const applyProductReward = (reward: ShopProduct["reward"]) => {
    setState((current) =>
      ensureProgressionState({
        ...current,
        gems: current.gems + (reward.gems ?? 0),
        premiumCapsules: current.premiumCapsules + (reward.premiumCapsules ?? 0),
        mutationStormTickets: current.mutationStormTickets + (reward.mutationStormTickets ?? 0),
        activeEvent: reward.mutationStormTickets
          ? {
              id: "mutation_storm",
              title: "Mutation Storm",
              description: "Ticket activated: Epic+ odds are boosted for this session.",
              endsAt: now + 60 * 60 * 1000,
            }
          : current.activeEvent,
        incomeBoostUntil: reward.incomeBoostMinutes
          ? now + reward.incomeBoostMinutes * 60 * 1000
          : current.incomeBoostUntil,
        luckyBoostUntil: reward.luckyBoostMinutes ? now + reward.luckyBoostMinutes * 60 * 1000 : current.luckyBoostUntil,
        lastActiveAt: now,
      }),
    );
  };

  const completeBackendMockPurchase = async (productId: string): Promise<MockCompletePaymentResponse | null> => {
    if (!cloudPlayerId) {
      return null;
    }

    return completeMockPayment(cloudPlayerId, productId);
  };

  const applyCompletedMockPurchase = (completed: MockCompletePaymentResponse) => {
    applyProductReward(completed.reward);
    setLastPurchaseStatus(`${completed.purchase.id.slice(0, 8)} ${completed.purchase.status}`);
    setPaymentsMode("mock");
    setShopMockEnabled(true);
    setPendingMockProductId(null);
    setPendingProductId(null);
    notify(`${completed.product.title} added`, "good");
    track("shop_purchase_mocked", {
      productId: completed.product.id,
      purchaseId: completed.purchase.id,
      source: "backend_mock",
    });
    haptic.success();
  };

  const refreshCompletedPurchase = async (purchaseId: string) => {
    const status = await loadPurchaseStatus(purchaseId);
    if (!status?.purchase) {
      return;
    }

    setLastPurchaseStatus(`${status.purchase.id.slice(0, 8)} ${status.purchase.status}`);
    if (status.purchase.status === "completed") {
      if (cloudPlayerId) {
        const cloudSave = await loadCloudSave(cloudPlayerId);
        if (cloudSave?.gameState) {
          const playable = preparePlayableState(cloudSave.gameState, getIncomingReferralCode());
          applyLoadedState(
            playable.state,
            playable.offlineEarned,
            "cloud",
            "",
            cloudSave.updatedAt ?? new Date().toISOString(),
          );
        }
      }
      setPendingProductId(null);
      notify(`${status.product.title} payment confirmed`, "good");
      haptic.success();
    }
  };

  const applyBackendReferralStats = (stats: BackendReferralStats) => {
    setBackendReferralStats(stats);
    setState((current) =>
      ensureProgressionState({
        ...current,
        referralCode: stats.referralCode,
        referredBy: stats.referredBy ?? current.referredBy,
        inviteCount: stats.inviteCount,
        claimedInviteMilestones: stats.claimedMilestones,
        lastActiveAt: Date.now(),
      }),
    );
  };

  const refreshBackendReferralStats = async (playerId: string) => {
    if (!backendConfigured) {
      return null;
    }

    const stats = await loadReferralStats(playerId);
    if (stats) {
      applyBackendReferralStats(stats);
    }
    return stats;
  };

  const applyLoadedState = (
    nextState: GameState,
    earned: number,
    source: SaveSource,
    incomingReferral = "",
    cloudSyncedAt = "",
  ) => {
    setState(nextState);
    saveGameState(nextState);
    setOfflineEarned(earned);
    setShowOfflineModal(earned > 0);
    setSaveSource(source);
    if (source === "cloud") {
      lastCloudSavedJsonRef.current = JSON.stringify(nextState);
    }
    if (cloudSyncedAt) {
      setLastCloudSyncAt(cloudSyncedAt);
    }
    if (nextState.activeEvent?.endsAt && nextState.activeEvent.endsAt > Date.now()) {
      notify(nextState.activeEvent.title, "event");
    }
  };

  const forceCloudSave = async () => {
    if (!backendConfigured || !cloudPlayerId) {
      notify("Backend is not configured", "event");
      return;
    }

    setCloudSyncBusy(true);
    try {
      const saved = await saveCloudSave(cloudPlayerId, state);
      const syncedAt = saved?.updatedAt ?? new Date().toISOString();
      lastCloudSavedJsonRef.current = JSON.stringify(state);
      setLastCloudSyncAt(syncedAt);
      setBackendConnected(true);
      notify("Cloud save synced", "good");
      haptic.impact("medium");
    } catch (error) {
      console.warn("[cloud-save] Force cloud save failed; continuing with localStorage.", error);
      setLastBackendError(error instanceof Error ? error.message : String(error));
      setBackendConnected(false);
      notify("Cloud save failed", "event");
      haptic.error();
    } finally {
      setCloudSyncBusy(false);
    }
  };

  const forceCloudLoad = async () => {
    if (!backendConfigured || !cloudPlayerId) {
      notify("Backend is not configured", "event");
      return;
    }

    setCloudSyncBusy(true);
    try {
      const cloudSave = await loadCloudSave(cloudPlayerId);
      if (!cloudSave?.gameState) {
        notify("No cloud save found", "event");
        return;
      }

      const playable = preparePlayableState(cloudSave.gameState, getIncomingReferralCode());
      applyLoadedState(playable.state, playable.offlineEarned, "cloud", "", cloudSave.updatedAt ?? new Date().toISOString());
      setBackendConnected(true);
      setStateLoadError(false);
      notify("Cloud save loaded", "good");
      haptic.impact("medium");
    } catch (error) {
      console.warn("[cloud-save] Force cloud load failed; continuing with localStorage.", error);
      setLastBackendError(error instanceof Error ? error.message : String(error));
      setBackendConnected(false);
      notify("Cloud load failed", "event");
      haptic.error();
    } finally {
      setCloudSyncBusy(false);
    }
  };

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }
    didInitRef.current = true;
    initTelegramFullscreen();
    track("app_open", { telegram: player.isTelegram });

    const startup = async () => {
      const incomingReferral = getIncomingReferralCode();
      let localPlayable: ReturnType<typeof preparePlayableState>;
      let localSavedAt = 0;

      try {
        const localState = loadGameState();
        localSavedAt = localState.lastActiveAt || 0;
        localPlayable = preparePlayableState(localState, incomingReferral);
        applyLoadedState(localPlayable.state, localPlayable.offlineEarned, "local", incomingReferral);
        setStateLoadError(false);
      } catch (error) {
        console.warn("[cloud-save] Local save load failed; using fresh state.", error);
        localSavedAt = Date.now();
        localPlayable = {
          state: ensureProgressionState(applyStarterRewards({ ...INITIAL_STATE, lastActiveAt: Date.now() })),
          offlineEarned: 0,
        };
        applyLoadedState(localPlayable.state, 0, "local");
        setStateLoadError(true);
      }

      if (!backendConfigured) {
        cloudReadyRef.current = false;
        setBackendHealthStatus("off");
        return;
      }

      let healthOk = false;
      try {
        setBackendHealthStatus("checking");
        setLastBackendError("");
        const health = await checkBackendHealth();
        if (!health?.ok) {
          throw new Error("Backend health check failed.");
        }
        healthOk = true;
        setBackendHealthStatus("ok");

        const auth = await authenticateWithTelegram();
        if (!auth?.playerId) {
          throw new Error("Backend auth did not return a playerId.");
        }

        setCloudPlayerId(auth.playerId);
        const syncBackendReferrals = async () => {
          if (auth.player?.referralCode) {
            setState((current) =>
              ensureProgressionState({
                ...current,
                referralCode: auth.player?.referralCode ?? current.referralCode,
                referredBy: auth.player?.referredBy ?? current.referredBy,
                lastActiveAt: Date.now(),
              }),
            );
          }

          if (incomingReferral && incomingReferral !== auth.player?.referralCode) {
            const registration = await registerReferralWithBackend(auth.playerId, incomingReferral);
            if (registration?.registered && registration.invitedReward) {
              applyBackendReferralReward(registration.invitedReward);
              notify("Referral activated: premium capsule added", "event");
            }
          }

          await refreshBackendReferralStats(auth.playerId);
        };

        const cloudSave = await loadCloudSave(auth.playerId);
        setBackendConnected(true);
        cloudReadyRef.current = true;

        if (cloudSave?.gameState) {
          const cloudUpdatedAt = cloudSave.updatedAt ? Date.parse(cloudSave.updatedAt) : 0;

          if (cloudUpdatedAt > localSavedAt) {
            const cloudPlayable = preparePlayableState(cloudSave.gameState, incomingReferral);
            applyLoadedState(
              cloudPlayable.state,
              cloudPlayable.offlineEarned,
              "cloud",
              incomingReferral,
              cloudSave.updatedAt ?? new Date().toISOString(),
            );
            setStateLoadError(false);
            await syncBackendReferrals();
            return;
          }
        }

        setSaveSource("local");
        lastCloudSavedJsonRef.current = JSON.stringify(localPlayable.state);
        await syncBackendReferrals();
      } catch (error) {
        console.warn("[cloud-save] Backend unavailable; continuing with localStorage.", error);
        setLastBackendError(error instanceof Error ? error.message : String(error));
        if (!healthOk) {
          setBackendHealthStatus("failed");
        }
        setBackendConnected(false);
        cloudReadyRef.current = false;
      }
    };

    void startup();
  }, []);

  useEffect(() => {
    saveGameState(state);
  }, [state]);

  useEffect(() => {
    if (!backendConfigured) {
      setShopProducts(getProducts());
      setPaymentsMode("local");
      return;
    }

    let cancelled = false;
    void loadBackendProducts()
      .then((products) => {
        if (cancelled || !products?.length) {
          return;
        }
        setShopProducts(products);
        setPaymentsMode("backend");
      })
      .catch((error) => {
        console.warn("[payments] Backend products unavailable; using local mock catalog.", error);
        setLastBackendError(error instanceof Error ? error.message : String(error));
        if (!cancelled) {
          setShopProducts(getProducts());
          setPaymentsMode("local");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [backendConfigured]);

  useEffect(() => {
    pendingCloudStateRef.current = state;

    if (!backendConfigured || !cloudReadyRef.current || !cloudPlayerId) {
      return;
    }

    if (cloudSaveTimerRef.current !== null) {
      return;
    }

    cloudSaveTimerRef.current = window.setTimeout(() => {
      cloudSaveTimerRef.current = null;
      const stateToSave = pendingCloudStateRef.current;
      const serialized = JSON.stringify(stateToSave);
      if (serialized === lastCloudSavedJsonRef.current) {
        return;
      }

      void saveCloudSave(cloudPlayerId, stateToSave)
        .then((saved) => {
          lastCloudSavedJsonRef.current = serialized;
          setLastCloudSyncAt(saved?.updatedAt ?? new Date().toISOString());
          setBackendConnected(true);
        })
        .catch((error) => {
          console.warn("[cloud-save] Auto save failed; continuing with localStorage.", error);
          setBackendConnected(false);
        });
    }, 2000);
  }, [backendConfigured, cloudPlayerId, state]);

  useEffect(() => {
    return () => {
      if (cloudSaveTimerRef.current !== null) {
        window.clearTimeout(cloudSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
      setState((current) => {
        const next = ensureLiveOpsState(collectTickIncome(current, 1000));
        const earned = Math.floor(next.coins) - Math.floor(current.coins);

        if (earned > 0) {
          const id = floatingCoinId.current + 1;
          floatingCoinId.current = id;
          setFloatingCoins((items) => [...items.slice(-3), { id, amount: earned }]);
          window.setTimeout(() => {
            setFloatingCoins((items) => items.filter((item) => item.id !== id));
          }, 1300);
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const spendOrWarn = (next: GameState | null, success: () => void) => {
    if (!next) {
      haptic.error();
      return;
    }
    setState(ensureProgressionState(next));
    success();
  };

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === "collection") {
      setState((current) => completeTutorialTask(current, "open_collection"));
    }
    if (tab === "shop") {
      setState((current) => completeTutorialTask(current, "open_shop"));
    }
    haptic.selection();
  };

  const handleTutorialClaim = (taskId: TutorialTaskId) => {
    spendOrWarn(claimTutorialReward(state, taskId), () => {
      notify("Beginner quest reward claimed", "good");
      haptic.success();
    });
  };

  const handleAchievementClaim = (achievementId: AchievementId) => {
    spendOrWarn(claimAchievementReward(state, achievementId, now), () => {
      notify("Achievement reward claimed", "good");
      haptic.success();
    });
  };

  const handleAlbumClaim = (rarity: Rarity) => {
    spendOrWarn(claimAlbumReward(state, rarity, now), () => {
      notify(`${rarity} album reward claimed`, "good");
      haptic.success();
    });
  };

  const handleFullAlbumClaim = () => {
    spendOrWarn(claimFullAlbumReward(state, now), () => {
      notify("Full collection reward claimed", "event");
      haptic.impact("heavy");
    });
  };

  const handleTutorialFocus = (taskId: TutorialTaskId) => {
    if (taskId === "open_collection") {
      handleTabChange("collection");
      return;
    }
    if (taskId === "open_shop") {
      handleTabChange("shop");
      return;
    }
    if (taskId === "upgrade_creature") {
      handleTabChange("collection");
      return;
    }
    setActiveTab("hatch");
    haptic.selection();
  };

  const handleHatch = () => {
    if (isHatching) {
      return;
    }

    const result = hatchEgg(state);
    if (!result) {
      haptic.error();
      return;
    }

    track("hatch_started", { premium: state.premiumCapsules > 0 });
    setState(ensureProgressionState(completeTutorialTask(result.state, "first_hatch")));
    setLastHatched(null);
    setRevealRarity(result.creature.rarity);
    setScreenFlash(null);
    setActiveTab("hatch");
    setIsHatching(true);
    haptic.impact("light");

    window.setTimeout(() => {
      setLastHatched(result.creature);
      setRevealKey((key) => key + 1);
      setIsHatching(false);
      if (isRareOrBetter(result.creature.rarity)) {
        setScreenFlash(result.creature.rarity);
        window.setTimeout(() => setScreenFlash(null), result.creature.rarity === "Secret" ? 980 : 620);
      }
      window.setTimeout(() => setRevealRarity(null), 1500);
      if (isFlexRarity(result.creature.rarity)) {
        setRecentRareHatch(result.creature);
      }
      if (result.creature.rarity === "Secret") {
        playSecretSoundPlaceholder(result.creature);
        notify("SECRET MUTANT DISCOVERED", "event");
      }
      hapticForRarity(result.creature.rarity);
      track("hatch_completed", { rarity: result.creature.rarity, creatureId: result.creature.id });
    }, getRevealDelay(result.creature.rarity));
  };

  const handleBreed = () => {
    const [firstId, secondId] = breedSelection;
    const result = firstId && secondId ? breedCreatures(state, firstId, secondId) : null;
    if (!result) {
      haptic.error();
      return;
    }
    setState(ensureProgressionState(result.state));
    setLastHatched(result.creature);
    setRevealKey((key) => key + 1);
    if (isFlexRarity(result.creature.rarity)) {
      setRecentRareHatch(result.creature);
    }
    setBreedSelection([]);
    setActiveTab("hatch");
    hapticForRarity(result.creature.rarity);
    track("breed_completed", { rarity: result.creature.rarity, creatureId: result.creature.id });
  };

  const toggleBreedSelection = (creatureId: string) => {
    haptic.selection();
    setBreedSelection((current) => {
      if (current.includes(creatureId)) {
        return current.filter((id) => id !== creatureId);
      }
      return [...current, creatureId].slice(-2);
    });
  };

  const addMockPurchase = (patch: Partial<GameState>) => {
    setState((current) => ensureProgressionState({ ...current, ...patch, lastActiveAt: Date.now() }));
    track("shop_purchase_mocked", { source: "mock_shop" });
    haptic.success();
  };

  const handleUpgrade = (creatureId: string) => {
    const next = upgradeCreature(state, creatureId);
    spendOrWarn(next ? completeTutorialTask(next, "upgrade_creature") : null, () => {
      setUpgradingCreatureId(creatureId);
      window.setTimeout(() => setUpgradingCreatureId(null), 780);
      track("creature_upgraded", { creatureId });
      haptic.impact("medium");
    });
  };

  const handleDailyReward = () => {
    const next = claimDailyReward(state, now);
    spendOrWarn(next ? completeTutorialTask(next, "claim_daily") : null, () => {
      notify("Daily reward claimed", "good");
      track("daily_reward_claimed");
      haptic.success();
    });
  };

  const handleFreeCapsule = () => {
    spendOrWarn(claimFreeCapsule(state, now), () => {
      notify("Free capsule added", "good");
      haptic.success();
    });
  };

  const handleFavorite = (creatureId: string) => {
    setState((current) => ensureProgressionState(toggleFavoriteCreature(current, creatureId)));
    haptic.selection();
  };

  const handleCopyReferral = async () => {
    if (!backendReferralStats) {
      notify("Backend referral sync required", "event");
      haptic.error();
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      notify("Referral link copied", "good");
      haptic.success();
    } catch {
      notify("Copy unavailable", "event");
      haptic.error();
    }
  };

  const handleShareReferral = () => {
    if (!backendReferralStats) {
      notify("Backend referral sync required", "event");
      haptic.error();
      return;
    }

    const text = "Hatch neon mutants with me. Use my invite and get a premium capsule.";
    shareTelegramInvite(referralLink, text);
    notify("Invite link opened", "good");
    track("referral_shared", { code: backendReferralStats?.referralCode ?? state.referralCode });
    haptic.impact("medium");
  };

  const handleShareRareHatch = () => {
    if (!recentRareHatch) {
      return;
    }
    const text = `I just hatched a ${recentRareHatch.rarity} ${recentRareHatch.name} in Neon Mutant Hatchery. Try to beat this pull.`;
    shareTelegramInvite(referralLink, text);
    notify("Rare hatch shared", "good");
    track("rare_hatch_shared", { rarity: recentRareHatch.rarity, creatureId: recentRareHatch.id });
    haptic.impact(recentRareHatch.rarity === "Secret" ? "heavy" : "medium");
  };

  const handleInviteMilestone = async (invites: number) => {
    if (!backendConfigured || !cloudPlayerId) {
      notify("Backend referral sync required", "event");
      haptic.error();
      return;
    }

    setReferralBusy(true);
    try {
      const result = await claimReferralMilestoneWithBackend(cloudPlayerId, invites);
      if (!result?.claimed || !result.reward) {
        notify("Milestone is not ready", "event");
        haptic.error();
        if (result?.stats) {
          applyBackendReferralStats(result.stats);
        }
        return;
      }

      applyBackendReferralReward(result.reward);
      if (result.stats) {
        applyBackendReferralStats(result.stats);
      } else {
        await refreshBackendReferralStats(cloudPlayerId);
      }
      notify(`Invite milestone ${invites} claimed`, "good");
      haptic.success();
    } catch (error) {
      console.warn("[referral] Milestone claim failed.", error);
      notify("Milestone claim failed", "event");
      haptic.error();
    } finally {
      setReferralBusy(false);
    }
  };

  const handleSimulateReferral = async () => {
    if (!backendConfigured || !cloudPlayerId) {
      notify("Backend referral sync required", "event");
      haptic.error();
      return;
    }

    setReferralBusy(true);
    try {
      const result = await simulateReferralWithBackend(cloudPlayerId);
      if (!result?.registered) {
        notify(result?.reason ? `Simulation skipped: ${result.reason}` : "Simulation failed", "event");
        if (result?.stats) {
          applyBackendReferralStats(result.stats);
        }
        haptic.error();
        return;
      }

      if (result.stats) {
        applyBackendReferralStats(result.stats);
      } else {
        await refreshBackendReferralStats(cloudPlayerId);
      }
      notify("Simulated referral added", "good");
      haptic.impact("medium");
    } catch (error) {
      console.warn("[referral] Simulate referral failed.", error);
      notify("Simulation failed", "event");
      haptic.error();
    } finally {
      setReferralBusy(false);
    }
  };

  const handleMissionClaim = (missionId: MissionId) => {
    spendOrWarn(claimMissionReward(state, missionId), () => {
      notify("Mission reward claimed", "good");
      haptic.success();
    });
  };

  const handleSessionReward = (rewardId: SessionRewardId) => {
    spendOrWarn(claimSessionReward(state, rewardId, now), () => {
      notify("Session reward claimed", "good");
      haptic.success();
    });
  };

  const handleLimitedOffer = (offerId: LimitedOfferId) => {
    spendOrWarn(buyLimitedOffer(state, offerId, now), () => {
      notify(LIMITED_OFFERS[offerId].rewardLabel, "good");
      track("shop_purchase_mocked", { offerId });
      haptic.impact("heavy");
    });
  };

  const handleProductPurchase = async (productId: string) => {
    const product = shopProducts.find((item) => item.id === productId);
    if (!product) {
      haptic.error();
      return;
    }

    setPurchaseBusy(true);
    try {
      if (backendConfigured && cloudPlayerId) {
        const invoice = await createPaymentInvoice(cloudPlayerId, productId);
        if (!invoice) {
          throw new Error("Backend invoice unavailable.");
        }

        setLastInvoiceMode(invoice.mode);
        setLastInvoiceLinkExists(Boolean(invoice.invoiceLink ?? invoice.invoice.invoiceLink));
        setShopMockEnabled(Boolean(invoice.mockEnabled));

        if (invoice.mode === "mock") {
          const completed = await completeBackendMockPurchase(productId);
          if (!completed?.ok) {
            throw new Error("Mock payment completion failed.");
          }
          applyCompletedMockPurchase(completed);
        } else if (invoice.mode === "telegram") {
          setLastPurchaseStatus(`${invoice.purchase.id.slice(0, 8)} ${invoice.purchase.status}`);
          setPaymentsMode("backend");
          if (invoice.mockEnabled) {
            setPendingMockProductId(productId);
          }
          const invoiceLink = invoice.invoiceLink ?? invoice.invoice.invoiceLink;
          if (!invoiceLink) {
            throw new Error("Telegram invoice mode returned without invoiceLink.");
          }

          notify("Opening Telegram Stars invoice", "event");
          const invoiceStatus = await openTelegramInvoice(invoiceLink);
          setLastInvoiceStatus(invoiceStatus);
          notify(`Invoice ${invoiceStatus}`, invoiceStatus === "paid" ? "good" : "event");
          await refreshCompletedPurchase(invoice.purchase.id);
          if (invoiceStatus === "paid") {
            window.setTimeout(() => {
              void refreshCompletedPurchase(invoice.purchase.id);
            }, 1800);
          }
          track("shop_purchase_mocked", { productId, purchaseId: invoice.purchase.id, source: "telegram_stars" });
        } else {
          setLastPurchaseStatus(`${invoice.purchase.id.slice(0, 8)} ${invoice.purchase.status}`);
          setPaymentsMode("backend");
          notify("Telegram invoice placeholder returned", "event");
          throw new Error("Telegram invoice placeholder returned instead of real invoice.");
        }
      } else {
        const purchase = purchaseProduct(productId);
        if (!purchase) {
          throw new Error("Local product unavailable.");
        }
        applyProductReward(purchase.product.reward);
        setLastPurchaseStatus(`local ${purchase.purchasedAt}`);
        setPaymentsMode("local");
        notify(`${purchase.product.title} mocked`, "good");
        track("shop_purchase_mocked", { productId, source: "local" });
      }

      setPendingProductId(null);
      haptic.success();
    } catch (error) {
      console.warn("[payments] Purchase flow failed; falling back to local mock when possible.", error);
      setLastBackendError(error instanceof Error ? error.message : String(error));
      setLastInvoiceStatus("error");
      if (backendConfigured && cloudPlayerId) {
        notify("Payment unavailable", "event");
        haptic.error();
        return;
      }
      const purchase = purchaseProduct(productId);
      if (purchase) {
        applyProductReward(purchase.product.reward);
        setPendingProductId(null);
        setLastPurchaseStatus(`local ${purchase.purchasedAt}`);
        setPaymentsMode("local");
        notify(`${purchase.product.title} mocked locally`, "good");
        track("shop_purchase_mocked", { productId, source: "local_fallback" });
        haptic.success();
      } else {
        notify("Purchase unavailable", "event");
        haptic.error();
      }
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleCompleteMockPurchase = async (productId: string) => {
    setPurchaseBusy(true);
    try {
      const completed = await completeBackendMockPurchase(productId);
      if (!completed?.ok) {
        throw new Error("Mock payment completion failed.");
      }
      applyCompletedMockPurchase(completed);
    } catch (error) {
      console.warn("[payments] Mock completion failed.", error);
      setLastBackendError(error instanceof Error ? error.message : String(error));
      notify("Mock completion failed", "event");
      haptic.error();
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleMockMint = (creatureId: string) => {
    const result = mockMintCreature(creatureId);
    const creature = state.creatures.find((item) => item.id === creatureId);
    if (creature) {
      buildCreatureMetadata(creature);
    }
    notify(result ? "Mock mint metadata generated" : "Mint mock unavailable", result ? "good" : "event");
    track("nft_mint_clicked", { creatureId, success: Boolean(result) });
    haptic.impact("medium");
  };

  return (
    <main className={`app-shell ${lastHatched?.rarity === "Secret" ? "secret-distort" : ""}`}>
      <div className="app-content">
        <section className="top-panel">
          <div>
            <p className="eyebrow">Neon Mutant Hatchery</p>
            <h1>Capsule Lab</h1>
          </div>
          {debugEnabled ? (
            <button
              className="icon-button"
              aria-label="Reset game"
              onClick={() => {
                setState(ensureProgressionState(applyStarterRewards(ensureReferralCode(ensureLiveOpsState(resetGameState())))));
                setOnboardingStep(0);
                setLastHatched(null);
                setRevealRarity(null);
                setScreenFlash(null);
                setRecentRareHatch(null);
                setBreedSelection([]);
                setShowOfflineModal(false);
                haptic.impact("heavy");
              }}
            >
              <span className="reset-icon" />
            </button>
          ) : null}
        </section>

        <section className="resource-bar" aria-label="Resources">
          <AnimatedStatPill label="Coins" value={state.coins} />
          <StatPill label="Gems" value={formatNumber(state.gems)} />
          <StatPill label="Capsules" value={`${formatNumber(state.eggs)} / P${state.premiumCapsules}`} />
        </section>

        {stateLoadError ? (
          <section className="startup-warning" role="status">
            <strong>Temporary lab loaded</strong>
            <span>Saved data was unavailable, so a fresh playable session is running.</span>
          </section>
        ) : null}

        <TutorialPanel
          task={currentTutorialTask}
          ready={tutorialTaskReady}
          onClaim={handleTutorialClaim}
          onFocus={handleTutorialFocus}
        />

      <div className="floating-coin-layer" aria-hidden="true">
        {floatingCoins.map((item) => (
          <span key={item.id}>+{formatNumber(item.amount)}</span>
        ))}
      </div>

      <div className="toast-layer" aria-live="polite">
        {notifications.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            {item.text}
          </div>
        ))}
      </div>

      {screenFlash ? <div className={`screen-flash flash-${screenFlash.toLowerCase()}`} aria-hidden="true" /> : null}

      <section className="screen">
        {activeTab === "hatch" ? (
          <div className="hatch-screen">
            {state.activeEvent && state.activeEvent.endsAt > now ? (
              <div className={`event-banner event-${state.activeEvent.id}`}>
                <div>
                  <p className="eyebrow">Limited event</p>
                  <h3>{state.activeEvent.title}</h3>
                  <p>{state.activeEvent.description}</p>
                </div>
                <strong>{formatDuration(activeEventRemaining)}</strong>
              </div>
            ) : null}
            <div className="hatch-layout">
              <div className="hatch-chamber-column">
                <div
                  className={`incubator ${isHatching ? "hatching" : ""} ${
                    revealRarity || lastHatched ? `incubator-${(revealRarity ?? lastHatched!.rarity).toLowerCase()}` : ""
                  }`}
                >
                  <div className="chamber-particles" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="scanline" />
                  <div className={`capsule ${isHatching ? "capsule-hatching" : ""}`}>
                    <span className="capsule-crack capsule-crack-one" />
                    <span className="capsule-crack capsule-crack-two" />
                    <span className="energy-leak energy-leak-one" />
                    <span className="energy-leak energy-leak-two" />
                    <span className="energy-leak energy-leak-three" />
                    {lastHatched ? (
                      <CreatureVisual key={revealKey} creature={lastHatched} large reveal />
                    ) : (
                      <div className="egg-core">
                        <span />
                      </div>
                    )}
                  </div>
                  {(revealRarity || lastHatched) && !isHatching ? (
                    <div
                      key={`${revealKey}-${(revealRarity ?? lastHatched!.rarity).toLowerCase()}`}
                      className={`rarity-reveal-text rarity-text-${(revealRarity ?? lastHatched!.rarity).toLowerCase()}`}
                    >
                      {(revealRarity ?? lastHatched!.rarity).toUpperCase()}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="hatch-side-column">
                <div className="panel hatch-control-panel">
                  <div className="hatch-title">
                    <p className="eyebrow">Incubation bay</p>
                    <h2>{lastHatched ? lastHatched.name : "Unstable capsule ready"}</h2>
                    <p>
                      {lastHatched
                        ? `${lastHatched.rarity} - Gen ${lastHatched.generation} - ${lastHatched.traits.join(", ")}`
                        : "Crack open a capsule to generate a procedural mutant."}
                    </p>
                  </div>
                  {state.totalHatches === 0 ? (
                    <div className="helper-tip">
                      Your starter kit is loaded. Hatch once to unlock your first idle coin generator.
                    </div>
                  ) : null}
                  <button
                    className={`primary-button hatch-cta ${
                      currentTutorialTask?.id === "first_hatch" && !currentTutorialTask.completed ? "tutorial-glow" : ""
                    }`}
                    disabled={
                      (state.premiumCapsules <= 0 && (state.eggs <= 0 || state.coins < hatchCost)) || isHatching
                    }
                    onClick={handleHatch}
                  >
                    <span className="hatch-cta-main">
                      {isHatching
                        ? "Stabilizing..."
                        : state.premiumCapsules > 0
                          ? "Open premium"
                          : state.eggs <= 0
                            ? "No capsules"
                            : state.coins < hatchCost
                              ? "Need coins"
                              : "Hatch capsule"}
                    </span>
                    <span className="hatch-cta-sub">
                      {isHatching
                        ? "Neon pressure rising"
                        : state.premiumCapsules > 0
                          ? `${formatNumber(state.premiumCapsules)} premium ready`
                          : state.eggs <= 0
                            ? "Claim a free capsule"
                            : `${formatNumber(hatchCost)} coins / ${formatNumber(state.eggs)} ready`}
                    </span>
                  </button>
                  <div className="streak-meter">
                    <div>
                      <span>Streak luck</span>
                      <strong>+{hatchLuckBonus.toFixed(1)}%</strong>
                    </div>
                    <div className="completion-bar">
                      <i style={{ width: `${Math.min(100, (hatchLuckBonus / 12) * 100)}%` }} />
                    </div>
                    <p>{hatchStreakRemaining > 0 ? `${formatDuration(hatchStreakRemaining)} before reset` : "Hatch to start a streak"}</p>
                  </div>
                  <details className="hatch-details">
                    <summary>Details</summary>
                    <div className="hatch-meta-grid">
                      <StatPill label="Open cost" value={`${formatNumber(hatchCost)} coins`} />
                      <StatPill
                        label="Next open"
                        value={state.premiumCapsules > 0 ? "Premium" : `${state.hatchStreak} streak`}
                      />
                    </div>
                    <div className="odds-panel" aria-label="Hatch rarity chances">
                      {getRarityChances(state, state.premiumCapsules > 0).map(({ rarity, chance }) => (
                        <div key={rarity} className={`odds-row ${RARITY_CONFIG[rarity].className}`}>
                          <span>{rarity}</span>
                          <div>
                            <i style={{ width: `${chance}%` }} />
                          </div>
                          <strong>{chance}%</strong>
                        </div>
                      ))}
                    </div>
                    <ReturnHooksPanel
                      dailyReady={canClaimDaily}
                      freeCapsuleRemaining={freeCapsuleRemaining}
                      eventTitle={state.activeEvent?.title ?? "Next event"}
                      eventRemaining={activeEventRemaining}
                      hatchStreak={state.hatchStreak}
                      hatchStreakRemaining={hatchStreakRemaining}
                      sessionRewardTitle={nextSessionReward?.title ?? "Session cleared"}
                      sessionRewardRemaining={
                        nextSessionReward ? Math.max(0, nextSessionReward.requiredMs - nextSessionReward.elapsedMs) : 0
                      }
                    />
                    <div className="income-strip">
                      <span>Total idle income</span>
                      <strong>
                        {formatNumber(boostedIncome)} coins/min{boostedIncome > totalIncome ? " boosted" : ""}
                      </strong>
                    </div>
                    {recentRareHatch ? (
                      <div className={`rare-flex-panel ${RARITY_CONFIG[recentRareHatch.rarity].className}`}>
                        <CreatureVisual creature={recentRareHatch} />
                        <div>
                          <p className="eyebrow">Recent rare hatch</p>
                          <h3>
                            {recentRareHatch.rarity} {recentRareHatch.name}
                          </h3>
                          <p>Power {formatNumber(getPowerScore(recentRareHatch))} pull ready to flex.</p>
                        </div>
                        <button className="mini-button" onClick={handleShareRareHatch}>
                          Share
                        </button>
                      </div>
                    ) : null}
                  </details>
                </div>
              </div>
            </div>
            <details className="compact-section hatch-rewards">
              <summary>Rewards & missions</summary>
              <SessionRewardsPanel rewards={sessionRewards} onClaim={handleSessionReward} />
              <MissionPanel missions={state.dailyMissions} onClaim={handleMissionClaim} />
            </details>
          </div>
        ) : null}

        {activeTab === "collection" ? (
          <div className="collection-screen">
            <div className="collection-progress">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Collection index</p>
                  <h2>{collectionPercent}% discovered</h2>
                </div>
                <strong>
                  {discoveredCount}/{totalSpecies}
                </strong>
              </div>
              <div className="completion-bar">
                <i style={{ width: `${collectionPercent}%` }} />
              </div>
              <div className="collection-counts">
                <span>{discoveredCount} discovered</span>
                <span>{undiscoveredCount} undiscovered</span>
              </div>
            </div>
            <AlbumPanel
              groups={albumGroups}
              fullAlbum={fullAlbum}
              onClaimGroup={handleAlbumClaim}
              onClaimFull={handleFullAlbumClaim}
            />
            {state.creatures.length ? (
              <>
                <div className="collection-toolbar">
                  <span>Sort</span>
                  {(["rarity", "power", "income"] as const).map((sort) => (
                    <button
                      key={sort}
                      className={collectionSort === sort ? "active" : ""}
                      onClick={() => setCollectionSort(sort)}
                    >
                      {sort}
                    </button>
                  ))}
                </div>
                <div className="creature-grid">
                  {sortedCreatures.map((creature) => (
                    <CreatureCard
                      key={creature.id}
                      creature={creature}
                      isFavorite={state.favoriteCreatureIds.includes(creature.id)}
                      upgrading={upgradingCreatureId === creature.id}
                      canUpgrade={state.coins >= getUpgradeCost(creature)}
                      highlightUpgrade={
                        currentTutorialTask?.id === "upgrade_creature" &&
                        !currentTutorialTask.completed &&
                        state.coins >= getUpgradeCost(creature)
                      }
                      onClick={() => setDetailCreatureId(creature.id)}
                      onFavorite={() => handleFavorite(creature.id)}
                      onUpgrade={() => handleUpgrade(creature.id)}
                    />
                  ))}
                  {Array.from({ length: Math.min(8, undiscoveredCount) }).map((_, index) => (
                    <article key={`locked-${index}`} className="creature-card silhouette-card" aria-label="Undiscovered creature">
                      <div className="card-topline">
                        <span>Undiscovered</span>
                        <div className="card-badges">
                          <span>???</span>
                        </div>
                      </div>
                      <div className="silhouette-mutant">
                        <span />
                      </div>
                      <div className="creature-info">
                        <h3>Unknown mutant</h3>
                        <p>Hatch capsules to reveal</p>
                      </div>
                      <div className="card-stat-grid">
                        <span>
                          <strong>?</strong>
                          Income
                        </span>
                        <span>
                          <strong>?</strong>
                          Gen
                        </span>
                        <span>
                          <strong>?</strong>
                          Power
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="creature-grid">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <article key={`empty-locked-${index}`} className="creature-card silhouette-card" aria-label="Undiscovered creature">
                      <div className="card-topline">
                        <span>Undiscovered</span>
                        <div className="card-badges">
                          <span>???</span>
                        </div>
                      </div>
                      <div className="silhouette-mutant">
                        <span />
                      </div>
                      <div className="creature-info">
                        <h3>Unknown mutant</h3>
                        <p>Hatch capsules to reveal</p>
                      </div>
                    </article>
                  ))}
                </div>
                <EmptyState title="No mutants yet" body="Hatch your first capsule to start the collection." />
              </>
            )}
          </div>
        ) : null}

        {activeTab === "breed" ? (
          <div className="breed-screen">
            <div className="breed-machine">
              <div className="parent-slot">
                {breedSelection[0] ? (
                  <CreatureVisual creature={state.creatures.find((item) => item.id === breedSelection[0])!} />
                ) : (
                  <span>Parent A</span>
                )}
              </div>
              <div className="fusion-core" />
              <div className="parent-slot">
                {breedSelection[1] ? (
                  <CreatureVisual creature={state.creatures.find((item) => item.id === breedSelection[1])!} />
                ) : (
                  <span>Parent B</span>
                )}
              </div>
            </div>
            <button
              className="primary-button"
              disabled={breedSelection.length < 2 || state.coins < BREED_COIN_COST || state.gems < BREED_GEM_COST}
              onClick={handleBreed}
            >
              Breed - {formatNumber(BREED_COIN_COST)} coins + {formatNumber(BREED_GEM_COST)} gem
            </button>
            <div className="creature-grid compact-grid">
              {state.creatures.map((creature) => (
                <CreatureCard
                  key={creature.id}
                  creature={creature}
                  compact
                  selected={breedSelection.includes(creature.id)}
                  onClick={() => toggleBreedSelection(creature.id)}
                />
              ))}
            </div>
            {!state.creatures.length ? (
              <EmptyState title="Breeding locked" body="You need at least two creatures before the fusion bay can run." />
            ) : null}
          </div>
        ) : null}

        {activeTab === "shop" ? (
          <div className="shop-screen">
            <ShopSection
              title="Capsules"
              eyebrow="Telegram Stars"
              products={shopProducts.filter((product) => product.section === "capsules")}
              onSelect={setPendingProductId}
            />
            <ShopSection
              title="Gems"
              eyebrow="Currency"
              products={shopProducts.filter((product) => product.section === "gems")}
              onSelect={setPendingProductId}
            />
            <ShopSection
              title="Boosts"
              eyebrow="Timed power"
              products={shopProducts.filter((product) => product.section === "boosts")}
              onSelect={setPendingProductId}
            />
            <ShopSection
              title="Limited Offers"
              eyebrow="Rotating"
              products={shopProducts.filter((product) => product.section === "limited")}
              onSelect={setPendingProductId}
            />
            <div className="limited-shop">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Free-to-play</p>
                  <h2>Lab supplies</h2>
                </div>
                <span>Mock</span>
              </div>
              {(Object.keys(LIMITED_OFFERS) as LimitedOfferId[]).map((offerId) => {
                const offer = LIMITED_OFFERS[offerId];
                const cost = [
                  offer.cost.coins ? `${formatNumber(offer.cost.coins)} coins` : "",
                  offer.cost.gems ? `${formatNumber(offer.cost.gems)} gems` : "",
                ]
                  .filter(Boolean)
                  .join(" + ");
                return (
                  <ShopOffer
                    key={offerId}
                    title={offer.title}
                    body={offer.body}
                    price={state.purchasedOfferIds.includes(offerId) ? "Claimed" : cost}
                    disabled={state.purchasedOfferIds.includes(offerId)}
                    onClick={() => handleLimitedOffer(offerId)}
                  />
                );
              })}
            </div>
            <div className="mint-panel">
              <div>
                <p className="eyebrow">NFT / Mint</p>
                <h2>Coming soon</h2>
                <p>Creature minting is intentionally disabled in this prototype.</p>
              </div>
              <span>Locked</span>
            </div>
          </div>
        ) : null}

        {activeTab === "profile" ? (
          <div className="profile-screen">
            <div className="referral-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Referral lab</p>
                  <h2>Invite friends</h2>
                </div>
                <strong>{backendReferralStats ? `${backendReferralStats.inviteCount} invites` : "Backend required"}</strong>
              </div>
              <div className="referral-code">
                <span>{backendReferralStats?.referralCode ?? "Sync required"}</span>
                <button className="mini-button" disabled={!backendReferralStats} onClick={handleCopyReferral}>
                  Copy
                </button>
              </div>
              <button className="primary-button" disabled={!backendReferralStats} onClick={handleShareReferral}>
                Share in Telegram
              </button>
              <div className="milestone-list">
                {(backendReferralStats?.milestones ?? INVITE_MILESTONES.map((milestone) => ({
                  ...milestone,
                  claimed: false,
                  claimable: false,
                }))).map((milestone) => {
                  const claimed = milestone.claimed;
                  const ready = milestone.claimable;
                  return (
                    <button
                      key={milestone.invites}
                      className={`milestone-row ${ready ? "ready" : ""}`}
                      disabled={!ready || referralBusy}
                      onClick={() => handleInviteMilestone(milestone.invites)}
                    >
                      <span>{milestone.invites} invite{milestone.invites === 1 ? "" : "s"}</span>
                      <strong>{claimed ? "Claimed" : milestone.label}</strong>
                    </button>
                  );
                })}
              </div>
              {!backendReferralStats ? (
                <div className="debug-warning">Backend referral data unavailable. Invite progress is paused.</div>
              ) : null}
            </div>
            <section className="daily-profile-panel">
              <section className="retention-strip" aria-label="Daily rewards">
                <button
                  className={`reward-chip ${
                    currentTutorialTask?.id === "claim_daily" && !currentTutorialTask.completed ? "tutorial-glow" : ""
                  }`}
                  disabled={!canClaimDaily}
                  onClick={handleDailyReward}
                >
                  <span>Daily</span>
                  <strong>{canClaimDaily ? `Day ${dailyLoginReward.day}` : `Streak ${state.loginStreak}`}</strong>
                </button>
                <button className="reward-chip" disabled={freeCapsuleRemaining > 0} onClick={handleFreeCapsule}>
                  <span>Free capsule</span>
                  <strong>{formatDuration(freeCapsuleRemaining)}</strong>
                </button>
                <div className="reward-chip passive-chip">
                  <span>Hatch luck</span>
                  <strong>{state.hatchStreak}x +{hatchLuckBonus.toFixed(1)}%</strong>
                </div>
              </section>
              <DailyLoginCalendar
                streak={state.loginStreak}
                claimedToday={!canClaimDaily}
                activeDay={dailyLoginReward.day}
              />
            </section>
            <div className="account-status-line">
              <span>{backendConnected ? "Cloud save active" : "Local save active"}</span>
              <span>{backendConfigured ? backendHealthStatus : "backend off"}</span>
              <span>{paymentsMode}</span>
            </div>
            <details className="compact-section settings-section">
              <summary>Settings</summary>
              <div className="stats-grid">
                <StatPill label="Creatures" value={formatNumber(state.creatures.length)} />
                <StatPill label="Income/min" value={formatNumber(totalIncome)} />
                <StatPill label="Best rarity" value={strongestCreature?.rarity ?? "None"} />
                <StatPill
                  label="Highest gen"
                  value={formatNumber(Math.max(0, ...state.creatures.map((item) => item.generation)))}
                />
              </div>
            </details>
            <details className="compact-section achievements-accordion">
              <summary>Achievements {unclaimedAchievementCount ? `(${unclaimedAchievementCount} ready)` : ""}</summary>
              <AchievementPanel achievements={visibleAchievements} readyCount={unclaimedAchievementCount} onClaim={handleAchievementClaim} />
            </details>
            {debugEnabled ? (
            <div className="debug-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Dev panel</p>
                  <h2>Backend sync</h2>
                </div>
                <span>{backendConnected ? "Cloud" : "Local"}</span>
              </div>
              {!telegramViewport.telegramSdkLoaded ? (
                <div className="debug-warning">Telegram SDK not loaded - fullscreen API unavailable.</div>
              ) : null}
              <div className="debug-grid">
                <StatPill label="Origin" value={currentOrigin || "Unknown"} />
                <StatPill label="Mode" value={environmentMode} />
                <StatPill label="Backend" value={backendConnected ? "Yes" : backendConfigured ? "No" : "Off"} />
                <StatPill label="API env" value={rawApiUrl || "Empty"} />
                <StatPill label="API URL" value={resolvedApiBaseUrl || "None"} />
                <StatPill label="Health" value={backendHealthStatus} />
                <StatPill label="API error" value={lastBackendError || "None"} />
                <StatPill label="Player id" value={currentPlayerId} />
                <StatPill label="Cloud sync" value={lastCloudSyncLabel} />
                <StatPill label="Save source" value={saveSource} />
                <StatPill label="Payments" value={paymentsMode} />
                <StatPill label="Shop mock" value={shopMockEnabled ? "Yes" : "No"} />
                <StatPill label="Last buy" value={lastPurchaseStatus} />
                <StatPill label="Invoice mode" value={lastInvoiceMode} />
                <StatPill label="Invoice stat" value={lastInvoiceStatus} />
                <StatPill label="Invoice link" value={lastInvoiceLinkExists ? "Yes" : "No"} />
                <StatPill label="Telegram" value={isTelegramEnvironment() ? "Yes" : "No"} />
                <StatPill label="SDK loaded" value={telegramViewport.telegramSdkLoaded ? "Yes" : "No"} />
                <StatPill label="TG object" value={telegramViewport.telegramObjectExists ? "Yes" : "No"} />
                <StatPill label="WebApp ver" value={telegramViewport.version} />
                <StatPill label="Platform" value={telegramViewport.platform} />
                <StatPill label="Window h" value={`${telegramViewport.windowInnerHeight}px`} />
                <StatPill label="Client h" value={`${telegramViewport.documentElementClientHeight}px`} />
                <StatPill label="Document h" value={`${telegramViewport.documentHeight}px`} />
                <StatPill label="App h" value={telegramViewport.appHeight || "Unknown"} />
                <StatPill
                  label="Viewport"
                  value={telegramViewport.viewportHeight ? `${Math.round(telegramViewport.viewportHeight)}px` : "Browser"}
                />
                <StatPill
                  label="Stable"
                  value={
                    telegramViewport.viewportStableHeight
                      ? `${Math.round(telegramViewport.viewportStableHeight)}px`
                      : "Browser"
                  }
                />
                <StatPill
                  label="Fullscreen"
                  value={telegramViewport.isFullscreen === null ? "Unknown" : telegramViewport.isFullscreen ? "Yes" : "No"}
                />
                <StatPill
                  label="Expanded"
                  value={telegramViewport.isExpanded === null ? "Unknown" : telegramViewport.isExpanded ? "Yes" : "No"}
                />
                <StatPill label="Events" value={formatNumber(analyticsCount)} />
                <StatPill label="Referral" value={backendReferralStats?.referralCode ?? state.referralCode ?? "Pending"} />
                <StatPill label="Reset ver" value={DEV_SAVE_RESET_VERSION} />
                <StatPill label="Stored ver" value={storedDevResetVersion || "None"} />
              </div>
              <button
                className="mini-button"
                disabled={!backendConfigured || !cloudPlayerId || cloudSyncBusy}
                onClick={forceCloudSave}
              >
                {cloudSyncBusy ? "Syncing..." : "Force Cloud Save"}
              </button>
              <button
                className="mini-button"
                disabled={!backendConfigured || !cloudPlayerId || cloudSyncBusy}
                onClick={forceCloudLoad}
              >
                {cloudSyncBusy ? "Syncing..." : "Force Cloud Load"}
              </button>
              <button
                className="mini-button"
                disabled={!backendConfigured || !cloudPlayerId || referralBusy}
                onClick={handleSimulateReferral}
              >
                {referralBusy ? "Simulating..." : "Simulate Referral"}
              </button>
              <button
                className="mini-button"
                onClick={() => {
                  setState(
                    ensureProgressionState(applyStarterRewards(ensureReferralCode(ensureLiveOpsState(resetGameState())))),
                  );
                  setOnboardingStep(0);
                  setLastHatched(null);
                  setRevealRarity(null);
                  setScreenFlash(null);
                  setRecentRareHatch(null);
                  setBreedSelection([]);
                  setShowOfflineModal(false);
                  notify("Local save reset", "event");
                  haptic.impact("heavy");
                }}
              >
                Reset local save
              </button>
              <button
                className="mini-button"
                onClick={() => {
                  setState(
                    ensureProgressionState(
                      applyStarterRewards(ensureReferralCode(ensureLiveOpsState(forceResetGameStateNow()))),
                    ),
                  );
                  setAnalyticsCount(getAnalyticsEventCount());
                  setOnboardingStep(0);
                  setLastHatched(null);
                  setRevealRarity(null);
                  setScreenFlash(null);
                  setRecentRareHatch(null);
                  setBreedSelection([]);
                  setShowOfflineModal(false);
                  notify("Forced fresh save", "event");
                  haptic.impact("heavy");
                }}
              >
                Force Reset Save Now
              </button>
              <button
                className="mini-button"
                onClick={() => {
                  setState((current) => ensureProgressionState(resetOnboardingProgress(ensureTutorialState(current))));
                  setOnboardingStep(0);
                  notify("Onboarding reset", "event");
                  haptic.impact("medium");
                }}
              >
                Reset onboarding
              </button>
            </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {!state.onboardingCompleted ? (
        <OnboardingModal
          step={onboardingStep}
          onNext={() => {
            if (onboardingStep < ONBOARDING_STEPS.length - 1) {
              setOnboardingStep((step) => step + 1);
              haptic.selection();
              return;
            }
            setState((current) =>
              ensureProgressionState({
                ...applyStarterRewards(ensureTutorialState(current)),
                onboardingCompleted: true,
                lastActiveAt: Date.now(),
              }),
            );
            notify(
              state.starterRewardsClaimed ? "Onboarding completed" : "Starter kit loaded: 3 capsules, 100 coins, 5 gems",
              "good",
            );
            haptic.success();
          }}
          onBack={() => {
            setOnboardingStep((step) => Math.max(0, step - 1));
            haptic.selection();
          }}
        />
      ) : null}

      {showOfflineModal && state.onboardingCompleted ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="offline-title">
          <div className="reward-modal">
            <div className="reward-orb" />
            <p className="eyebrow">Offline reward</p>
            <h2 id="offline-title">You earned {formatNumber(offlineEarned)} coins while away</h2>
            <p>Your mutants kept producing while the lab was closed.</p>
            <button
              className="primary-button"
              onClick={() => {
                setShowOfflineModal(false);
                setOfflineEarned(0);
                haptic.success();
              }}
            >
              Claim coins
            </button>
          </div>
        </div>
      ) : null}

      {detailCreature ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="creature-title">
          <div className={`creature-modal ${RARITY_CONFIG[detailCreature.rarity].className}`}>
            <button className="modal-close" aria-label="Close details" onClick={() => setDetailCreatureId(null)}>
              Close
            </button>
            <CreatureVisual creature={detailCreature} large />
            <div className="modal-heading">
              <p className="eyebrow">{detailCreature.rarity} mutant</p>
              <h2 id="creature-title">{detailCreature.name}</h2>
              <span>Power {formatNumber(getPowerScore(detailCreature))}</span>
            </div>
            <div className="stats-grid">
              <StatPill label="Income/min" value={formatNumber(getCreatureIncomePerMinute(detailCreature))} />
              <StatPill label="Level" value={formatNumber(detailCreature.level)} />
              <StatPill label="Generation" value={formatNumber(detailCreature.generation)} />
              <StatPill label="Upgrade" value={formatNumber(getUpgradeCost(detailCreature))} />
            </div>
            <div className="detail-section">
              <strong>Passive traits</strong>
              <div className="passive-row">
                {detailCreature.passiveTraits.length ? (
                  detailCreature.passiveTraits.map((trait) => (
                    <span key={trait}>
                      {trait} {PASSIVE_TRAIT_CONFIG[trait].label}
                    </span>
                  ))
                ) : (
                  <span>No passive trait</span>
                )}
              </div>
            </div>
            <div className="detail-section">
              <strong>Mutations</strong>
              <div className="trait-row">
                {detailCreature.traits.map((trait) => (
                  <span key={trait}>{trait}</span>
                ))}
              </div>
            </div>
            <button
              className={`primary-button ${
                currentTutorialTask?.id === "upgrade_creature" &&
                !currentTutorialTask.completed &&
                state.coins >= getUpgradeCost(detailCreature)
                  ? "tutorial-glow"
                  : ""
              }`}
              disabled={state.coins < getUpgradeCost(detailCreature)}
              onClick={() => handleUpgrade(detailCreature.id)}
            >
              Level up - {formatNumber(getUpgradeCost(detailCreature))}
            </button>
            <button className="mini-button" onClick={() => handleMockMint(detailCreature.id)}>
              Mock mint metadata
            </button>
          </div>
        </div>
      ) : null}

      {pendingProduct ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
          <div className="purchase-modal">
            <button className="modal-close" aria-label="Close purchase" onClick={() => setPendingProductId(null)}>
              Close
            </button>
            <div className="stars-orb">STAR</div>
            <div className="modal-heading">
              <p className="eyebrow">Telegram Stars mock</p>
              <h2 id="purchase-title">{pendingProduct.title}</h2>
              <span>{pendingProduct.rewardLabel}</span>
            </div>
            <p>{pendingProduct.description}</p>
            <div className="purchase-summary">
              <span>Price</span>
              <strong>{pendingProduct.starsPrice} Stars</strong>
            </div>
            <button className="primary-button" disabled={purchaseBusy} onClick={() => handleProductPurchase(pendingProduct.id)}>
              {purchaseBusy ? "Processing..." : "Buy with Telegram Stars"}
            </button>
            {pendingMockProductId === pendingProduct.id ? (
              <button
                className="mini-button"
                disabled={purchaseBusy}
                onClick={() => handleCompleteMockPurchase(pendingProduct.id)}
              >
                Complete Mock Purchase
              </button>
            ) : null}
            <p className="fine-print">
              {paymentsMode === "local"
                ? "Local mock purchase only. No invoice or real payment is created."
                : shopMockEnabled
                  ? "Temporary mock completion is enabled for Telegram testing. Remove before public launch."
                  : "Telegram Stars invoice placeholder. Rewards wait for real payment confirmation."}
            </p>
          </div>
        </div>
      ) : null}

      <nav className="bottom-nav" aria-label="Game tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${activeTab === tab.id ? "active" : ""} ${
              (currentTutorialTask?.id === "open_collection" && tab.id === "collection" && !currentTutorialTask.completed) ||
              (currentTutorialTask?.id === "open_shop" && tab.id === "shop" && !currentTutorialTask.completed)
                ? "tutorial-glow"
                : ""
            }`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className={`nav-icon nav-${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </nav>
      </div>
    </main>
  );
}

function AlbumPanel({
  groups,
  fullAlbum,
  onClaimGroup,
  onClaimFull,
}: {
  groups: ReturnType<typeof getRarityAlbumProgress>[];
  fullAlbum: ReturnType<typeof getFullAlbumProgress>;
  onClaimGroup: (rarity: Rarity) => void;
  onClaimFull: () => void;
}) {
  return (
    <section className="album-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Collection album</p>
          <h2>Rarity research</h2>
        </div>
        <span>
          {fullAlbum.discovered}/{fullAlbum.total}
        </span>
      </div>
      <div className="album-grid">
        {groups.map((group) => {
          const ready = group.complete && !group.claimed;
          const percent = Math.min(100, Math.round((group.discovered / group.total) * 100));
          return (
            <article key={group.rarity} className={`album-row ${RARITY_CONFIG[group.rarity].className} ${ready ? "ready" : ""}`}>
              <div className="album-row-top">
                <strong>{group.rarity}</strong>
                <span>
                  {group.discovered}/{group.total}
                </span>
              </div>
              <div className="completion-bar">
                <i style={{ width: `${percent}%` }} />
              </div>
              <div className="album-row-bottom">
                <span>{formatReward(group.reward)}</span>
                <button className="mini-button" disabled={!ready} onClick={() => onClaimGroup(group.rarity)}>
                  {group.claimed ? "Claimed" : ready ? "Claim" : `${percent}%`}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <div className={`full-album-row ${fullAlbum.complete && !fullAlbum.claimed ? "ready tutorial-glow" : ""}`}>
        <div>
          <strong>Full collection</strong>
          <p>{formatReward(fullAlbum.reward)}</p>
        </div>
        <button className="mini-button" disabled={!fullAlbum.complete || fullAlbum.claimed} onClick={onClaimFull}>
          {fullAlbum.claimed ? "Claimed" : fullAlbum.complete ? "Claim" : `${fullAlbum.discovered}/${fullAlbum.total}`}
        </button>
      </div>
    </section>
  );
}

function AchievementPanel({
  achievements,
  readyCount,
  onClaim,
}: {
  achievements: GameState["achievements"];
  readyCount: number;
  onClaim: (achievementId: AchievementId) => void;
}) {
  return (
    <section className="achievement-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Achievements</p>
          <h2>Long-term goals</h2>
        </div>
        <span>{readyCount} ready</span>
      </div>
      <div className="achievement-list">
        {achievements.map((achievement) => {
          const ready = achievement.progress >= achievement.target && !achievement.claimed;
          const percent = Math.min(100, Math.round((achievement.progress / achievement.target) * 100));
          return (
            <article key={achievement.id} className={`achievement-row ${ready ? "ready" : ""}`}>
              <div className="achievement-copy">
                <strong>{achievement.title}</strong>
                <p>{achievement.description}</p>
              </div>
              <div className="achievement-progress">
                <div className="completion-bar">
                  <i style={{ width: `${percent}%` }} />
                </div>
                <span>
                  {formatNumber(achievement.progress)}/{formatNumber(achievement.target)}
                </span>
              </div>
              <div className="achievement-reward">
                <span>{formatReward(achievement.reward)}</span>
                <button className="mini-button" disabled={!ready} onClick={() => onClaim(achievement.id)}>
                  {achievement.claimed ? "Claimed" : ready ? "Claim" : `${percent}%`}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DailyLoginCalendar({
  streak,
  claimedToday,
  activeDay,
}: {
  streak: number;
  claimedToday: boolean;
  activeDay: number;
}) {
  return (
    <section className="login-calendar" aria-label="Daily login calendar">
      <div className="calendar-heading">
        <span>Login streak</span>
        <strong>{streak} day{streak === 1 ? "" : "s"}</strong>
      </div>
      <div className="calendar-days">
        {DAILY_LOGIN_REWARDS.map((item) => {
          const isActive = item.day === activeDay;
          const isPast = item.day < activeDay || (isActive && claimedToday);
          return (
            <div
              key={item.day}
              className={`calendar-day ${isActive ? "active" : ""} ${isPast ? "claimed" : ""}`}
              title={item.label}
            >
              <span>D{item.day}</span>
              <strong>{item.day === 7 ? "Jackpot" : formatReward(item.reward)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReturnHooksPanel({
  dailyReady,
  freeCapsuleRemaining,
  eventTitle,
  eventRemaining,
  hatchStreak,
  hatchStreakRemaining,
  sessionRewardTitle,
  sessionRewardRemaining,
}: {
  dailyReady: boolean;
  freeCapsuleRemaining: number;
  eventTitle: string;
  eventRemaining: number;
  hatchStreak: number;
  hatchStreakRemaining: number;
  sessionRewardTitle: string;
  sessionRewardRemaining: number;
}) {
  const hooks = [
    { label: "Daily reward", value: dailyReady ? "Ready" : "Claimed" },
    { label: "Free capsule", value: formatDuration(freeCapsuleRemaining) },
    { label: eventTitle, value: eventRemaining > 0 ? formatDuration(eventRemaining) : "Cooling" },
    { label: "Hatch streak", value: hatchStreak > 0 ? `${hatchStreak}x / ${formatDuration(hatchStreakRemaining)}` : "Inactive" },
    { label: sessionRewardTitle, value: sessionRewardRemaining > 0 ? formatDuration(sessionRewardRemaining) : "Ready" },
  ];

  return (
    <section className="return-hooks" aria-label="Return timers">
      {hooks.map((hook) => (
        <div key={hook.label} className={hook.value === "Ready" ? "ready" : ""}>
          <span>{hook.label}</span>
          <strong>{hook.value}</strong>
        </div>
      ))}
    </section>
  );
}

function SessionRewardsPanel({
  rewards,
  onClaim,
}: {
  rewards: ReturnType<typeof getSessionRewardProgress>;
  onClaim: (rewardId: SessionRewardId) => void;
}) {
  return (
    <section className="session-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Session rewards</p>
          <h2>Stay in the lab</h2>
        </div>
        <span>{rewards.filter((reward) => reward.ready && !reward.claimed).length} ready</span>
      </div>
      <div className="session-reward-list">
        {rewards.map((reward) => {
          const ready = reward.ready && !reward.claimed;
          return (
            <button
              key={reward.id}
              className={`session-reward ${ready ? "ready" : ""}`}
              disabled={!ready}
              onClick={() => onClaim(reward.id)}
            >
              <span>
                <strong>{reward.title}</strong>
                <em>{formatReward(reward.reward)}</em>
              </span>
              <div className="completion-bar">
                <i style={{ width: `${Math.round(reward.progress * 100)}%` }} />
              </div>
              <b>{reward.claimed ? "Claimed" : ready ? "Claim" : formatDuration(reward.requiredMs - reward.elapsedMs)}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TutorialPanel({
  task,
  ready,
  onClaim,
  onFocus,
}: {
  task: GameState["tutorialTasks"][number] | null;
  ready: boolean;
  onClaim: (taskId: TutorialTaskId) => void;
  onFocus: (taskId: TutorialTaskId) => void;
}) {
  if (!task) {
    return null;
  }

  const reward = formatReward(task.reward);

  return (
    <section className={`beginner-panel ${ready ? "ready tutorial-glow" : ""}`} aria-label="Beginner quest">
      <div>
        <p className="eyebrow">Beginner quest</p>
        <h3>{task.title}</h3>
        <p>{task.completed ? `Reward ready: ${reward}` : task.body}</p>
      </div>
      <button
        className="mini-button"
        onClick={() => {
          if (ready) {
            onClaim(task.id);
            return;
          }
          onFocus(task.id);
        }}
      >
        {ready ? "Claim" : "Go"}
      </button>
    </section>
  );
}

function OnboardingModal({
  step,
  onNext,
  onBack,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
}) {
  const content = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div className="modal-backdrop onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-modal">
        <div className="onboarding-orb">
          <span />
        </div>
        <div className="modal-heading">
          <p className="eyebrow">New researcher briefing</p>
          <h2 id="onboarding-title">{content.title}</h2>
          <span>{step + 1}/{ONBOARDING_STEPS.length}</span>
        </div>
        <p>{content.body}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {ONBOARDING_STEPS.map((_, index) => (
            <i key={index} className={index === step ? "active" : ""} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="mini-button" disabled={step === 0} onClick={onBack}>
            Back
          </button>
          <button className="primary-button" onClick={onNext}>
            {isLast ? "Start hatching" : "Next"}
          </button>
        </div>
        <p className="fine-print">Starter kit: 3 capsules, 100 coins, 5 gems.</p>
      </div>
    </div>
  );
}

function ShopOffer({
  title,
  body,
  price,
  onClick,
  disabled,
}: {
  title: string;
  body: string;
  price: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <article className="shop-offer">
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      <button className="mini-button" disabled={disabled} onClick={onClick}>
        {price}
      </button>
    </article>
  );
}

function ShopSection({
  title,
  eyebrow,
  products,
  onSelect,
}: {
  title: string;
  eyebrow: string;
  products: ShopProduct[];
  onSelect: (productId: string) => void;
}) {
  if (!products.length) {
    return null;
  }

  return (
    <section className="shop-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>Stars</span>
      </div>
      <div className="product-grid">
        {products.map((product) => (
          <button key={product.id} className="product-card" onClick={() => onSelect(product.id)}>
            <div className="product-topline">
              <span>{product.section}</span>
              {product.badge ? <strong>{product.badge}</strong> : null}
            </div>
            <h3>{product.title}</h3>
            <p>{product.description}</p>
            <div className="product-footer">
              <span>{product.rewardLabel}</span>
              <strong>{product.starsPrice} STAR</strong>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function MissionPanel({
  missions,
  onClaim,
}: {
  missions: GameState["dailyMissions"];
  onClaim: (missionId: MissionId) => void;
}) {
  if (!missions.length) {
    return null;
  }

  return (
    <section className="mission-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Daily missions</p>
          <h2>Return streak fuel</h2>
        </div>
        <span>{missions.filter((mission) => mission.claimed).length}/{missions.length}</span>
      </div>
      {missions.map((mission) => {
        const ready = mission.progress >= mission.target && !mission.claimed;
        const reward = [
          mission.reward.coins ? `${mission.reward.coins} coins` : "",
          mission.reward.gems ? `${mission.reward.gems} gems` : "",
          mission.reward.eggs ? `${mission.reward.eggs} capsules` : "",
          mission.reward.premiumCapsules ? `${mission.reward.premiumCapsules} premium` : "",
        ]
          .filter(Boolean)
          .join(" + ");

        return (
          <button
            key={mission.id}
            className={`mission-row ${ready ? "ready" : ""}`}
            disabled={!ready}
            onClick={() => onClaim(mission.id)}
          >
            <span>
              <strong>{mission.title}</strong>
              {reward}
            </span>
            <em>{mission.claimed ? "Done" : `${Math.floor(mission.progress)}/${mission.target}`}</em>
          </button>
        );
      })}
    </section>
  );
}
