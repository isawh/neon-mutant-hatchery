import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
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
  canClaimDailyReward,
  claimDailyReward,
  claimFreeCapsule,
  claimMissionReward,
  claimTutorialReward,
  collectTickIncome,
  completeTutorialTask,
  ensureTutorialState,
  ensureLiveOpsState,
  getBoostedIncomePerMinute,
  getCreatureIncomePerMinute,
  getHatchCost,
  getPowerScore,
  getRarityChances,
  getTotalIncomePerMinute,
  getUpgradeCost,
  hatchEgg,
  recordInviteShare,
  resetOnboardingProgress,
  toggleFavoriteCreature,
  upgradeCreature,
} from "./game";
import { loadGameState, resetGameState, saveGameState } from "./storage";
import {
  getTelegramStartParam,
  getTelegramViewportState,
  haptic,
  initTelegramFullscreen,
  shareTelegramInvite,
} from "./telegram";
import { getAnalyticsEventCount, trackEvent } from "./services/analyticsService";
import { getCurrentPlayer, isTelegramEnvironment } from "./services/authService";
import { buildCreatureMetadata, mockMintCreature } from "./services/nftService";
import { getProducts, purchaseProduct, type MockProduct, type MockProductId } from "./services/paymentService";
import {
  buildReferralLink,
  claimReferralMilestone,
  ensureReferralCode,
  registerIncomingReferral,
  syncReferralStats,
} from "./services/referralService";
import type { Creature, GameState, LimitedOfferId, MissionId, Rarity, TabId, TutorialTaskId } from "./types";
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

const loadPlayableState = () => {
  try {
    return {
      state: applyStarterRewards(
        ensureReferralCode(ensureLiveOpsState(applyLoginStreak(calculateOfflineIncome(loadGameState()).state))),
      ),
      error: false,
    };
  } catch {
    return { state: applyStarterRewards({ ...INITIAL_STATE, lastActiveAt: Date.now() }), error: true };
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
  return (
    <div
      className={`creature-visual creature-${creature.rarity.toLowerCase()} ${
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
  const [pendingProductId, setPendingProductId] = useState<MockProductId | null>(null);
  const [revealRarity, setRevealRarity] = useState<Rarity | null>(null);
  const [screenFlash, setScreenFlash] = useState<Rarity | null>(null);
  const [recentRareHatch, setRecentRareHatch] = useState<Creature | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const floatingCoinId = useRef(0);
  const notificationId = useRef(0);
  const didInitRef = useRef(false);
  const player = useMemo(() => getCurrentPlayer(), []);
  const products = useMemo(() => getProducts(), []);
  const pendingProduct = pendingProductId ? products.find((product) => product.id === pendingProductId) ?? null : null;
  const currentOrigin = typeof window === "undefined" ? import.meta.env.VITE_PUBLIC_APP_URL : window.location.origin;
  const environmentMode = import.meta.env.MODE;
  const telegramViewport = getTelegramViewportState();
  const totalSpecies = NAME_PREFIXES.length * NAME_SUFFIXES.length;
  const discoveredCount = new Set(state.discoveredCreatureNames).size;
  const undiscoveredCount = Math.max(0, totalSpecies - discoveredCount);
  const collectionPercent = totalSpecies ? Math.min(100, Math.round((discoveredCount / totalSpecies) * 100)) : 0;

  const totalIncome = useMemo(() => getTotalIncomePerMinute(state.creatures), [state.creatures]);
  const boostedIncome = useMemo(() => getBoostedIncomePerMinute(state), [state, now]);
  const hatchCost = useMemo(() => getHatchCost(state), [state]);
  const canClaimDaily = useMemo(() => canClaimDailyReward(state, now), [state, now]);
  const freeCapsuleRemaining = Math.max(0, state.freeCapsuleReadyAt - now);
  const currentTutorialTask = state.tutorialTasks.find((task) => !task.claimed) ?? null;
  const tutorialTaskReady = Boolean(currentTutorialTask?.completed && !currentTutorialTask.claimed);
  const referralLink = useMemo(() => {
    return buildReferralLink(state.referralCode);
  }, [state.referralCode]);
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

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }
    didInitRef.current = true;
    initTelegramFullscreen();
    track("app_open", { telegram: player.isTelegram });
    try {
      const loaded = calculateOfflineIncome(loadGameState());
      const url = new URL(window.location.href);
      const incomingReferral =
        url.searchParams.get("ref") ?? url.searchParams.get("startapp") ?? getTelegramStartParam();
      const loginState = applyStarterRewards(
        ensureReferralCode(
          ensureLiveOpsState(
            syncReferralStats(registerIncomingReferral(applyLoginStreak(loaded.state), incomingReferral ?? "")),
          ),
        ),
      );
      setState(loginState);
      setOfflineEarned(loaded.earned);
      setShowOfflineModal(loaded.earned > 0);
      if (incomingReferral && loginState.referralRewardClaimed) {
        notify("Referral activated: premium capsule added", "event");
      }
      if (loginState.activeEvent?.endsAt && loginState.activeEvent.endsAt > Date.now()) {
        notify(loginState.activeEvent.title, "event");
      }
      setStateLoadError(false);
    } catch {
      setState(applyStarterRewards({ ...INITIAL_STATE, lastActiveAt: Date.now() }));
      setOfflineEarned(0);
      setShowOfflineModal(false);
      setStateLoadError(true);
    }
  }, []);

  useEffect(() => {
    saveGameState(state);
  }, [state]);

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
    setState(next);
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
    setState(completeTutorialTask(result.state, "first_hatch"));
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
    setState(result.state);
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
    setState((current) => ({ ...current, ...patch, lastActiveAt: Date.now() }));
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
    setState((current) => toggleFavoriteCreature(current, creatureId));
    haptic.selection();
  };

  const handleCopyReferral = async () => {
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
    const text = "Hatch neon mutants with me. Use my invite and get a premium capsule.";
    shareTelegramInvite(referralLink, text);
    setState((current) => recordInviteShare(current));
    notify("Invite sent: +1 gem", "good");
    track("referral_shared", { code: state.referralCode });
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

  const handleInviteMilestone = (invites: number) => {
    spendOrWarn(claimReferralMilestone(state, invites), () => {
      notify(`Invite milestone ${invites} claimed`, "good");
      haptic.success();
    });
  };

  const handleMissionClaim = (missionId: MissionId) => {
    spendOrWarn(claimMissionReward(state, missionId), () => {
      notify("Mission reward claimed", "good");
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

  const handleProductPurchase = (productId: MockProductId) => {
    const purchase = purchaseProduct(productId);
    if (!purchase) {
      haptic.error();
      return;
    }

    setState((current) => ({
      ...current,
      gems: current.gems + (purchase.product.reward.gems ?? 0),
      premiumCapsules: current.premiumCapsules + (purchase.product.reward.premiumCapsules ?? 0),
      mutationStormTickets: current.mutationStormTickets + (purchase.product.reward.mutationStormTickets ?? 0),
      activeEvent: purchase.product.reward.mutationStormTickets
        ? {
            id: "mutation_storm",
            title: "Mutation Storm",
            description: "Ticket activated: Epic+ odds are boosted for this session.",
            endsAt: now + 60 * 60 * 1000,
          }
        : current.activeEvent,
      incomeBoostUntil: purchase.product.reward.incomeBoostMinutes
        ? now + purchase.product.reward.incomeBoostMinutes * 60 * 1000
        : current.incomeBoostUntil,
      luckyBoostUntil: purchase.product.reward.luckyBoostMinutes
        ? now + purchase.product.reward.luckyBoostMinutes * 60 * 1000
        : current.luckyBoostUntil,
      lastActiveAt: now,
    }));
    setPendingProductId(null);
    notify(`${purchase.product.title} mocked`, "good");
    track("shop_purchase_mocked", { productId });
    haptic.success();
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
          <button
            className="icon-button"
            aria-label="Reset game"
            onClick={() => {
              setState(applyStarterRewards(ensureReferralCode(ensureLiveOpsState(resetGameState()))));
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

        <section className="retention-strip" aria-label="Daily rewards">
          <button
            className={`reward-chip ${
              currentTutorialTask?.id === "claim_daily" && !currentTutorialTask.completed ? "tutorial-glow" : ""
            }`}
            disabled={!canClaimDaily}
            onClick={handleDailyReward}
          >
            <span>Daily</span>
            <strong>{canClaimDaily ? "Claim" : `Streak ${state.loginStreak}`}</strong>
          </button>
          <button className="reward-chip" disabled={freeCapsuleRemaining > 0} onClick={handleFreeCapsule}>
            <span>Free capsule</span>
            <strong>{formatDuration(freeCapsuleRemaining)}</strong>
          </button>
          <div className="reward-chip passive-chip">
            <span>Hatch streak</span>
            <strong>{state.hatchStreak}x</strong>
          </div>
        </section>

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
              <div className="event-banner">
                <div>
                  <p className="eyebrow">Rare event</p>
                  <h3>{state.activeEvent.title}</h3>
                  <p>{state.activeEvent.description}</p>
                </div>
                <strong>{formatDuration(state.activeEvent.endsAt - now)}</strong>
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
                <div className="panel">
                  <div>
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
                  <button
                    className={`primary-button ${
                      currentTutorialTask?.id === "first_hatch" && !currentTutorialTask.completed ? "tutorial-glow" : ""
                    }`}
                    disabled={
                      (state.premiumCapsules <= 0 && (state.eggs <= 0 || state.coins < hatchCost)) || isHatching
                    }
                    onClick={handleHatch}
                  >
                    {isHatching
                      ? "Stabilizing..."
                      : state.premiumCapsules > 0
                        ? "Open premium capsule"
                        : `Hatch - ${formatNumber(hatchCost)}`}
                  </button>
                </div>
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
              </div>
            </div>
            <MissionPanel missions={state.dailyMissions} onClaim={handleMissionClaim} />
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
              disabled={breedSelection.length < 2 || state.coins < 95 || state.gems < 1}
              onClick={handleBreed}
            >
              Breed - 95 coins + 1 gem
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
              products={products.filter((product) => product.section === "capsules")}
              onSelect={setPendingProductId}
            />
            <ShopSection
              title="Gems"
              eyebrow="Currency"
              products={products.filter((product) => product.section === "gems")}
              onSelect={setPendingProductId}
            />
            <ShopSection
              title="Boosts"
              eyebrow="Timed power"
              products={products.filter((product) => product.section === "boosts")}
              onSelect={setPendingProductId}
            />
            <ShopSection
              title="Limited Offers"
              eyebrow="Rotating"
              products={products.filter((product) => product.section === "limited")}
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
            <div className="profile-hero">
              {strongestCreature ? <CreatureVisual creature={strongestCreature} large /> : <div className="empty-orb" />}
              <div>
                <p className="eyebrow">Lab profile</p>
                <h2>{strongestCreature ? "Prime mutant active" : "New researcher"}</h2>
                <p>
                  {strongestCreature
                    ? `${strongestCreature.name} leads your hatchery with ${formatNumber(
                        getCreatureIncomePerMinute(strongestCreature),
                      )} coins/min.`
                    : "Start hatching to unlock profile stats."}
                </p>
              </div>
            </div>
            <div className="stats-grid">
              <StatPill label="Creatures" value={formatNumber(state.creatures.length)} />
              <StatPill label="Income/min" value={formatNumber(totalIncome)} />
              <StatPill label="Best rarity" value={strongestCreature?.rarity ?? "None"} />
              <StatPill
                label="Highest gen"
                value={formatNumber(Math.max(0, ...state.creatures.map((item) => item.generation)))}
              />
            </div>
            <div className="referral-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Referral lab</p>
                  <h2>Invite friends</h2>
                </div>
                <strong>{state.inviteCount} invites</strong>
              </div>
              <div className="referral-code">
                <span>{state.referralCode}</span>
                <button className="mini-button" onClick={handleCopyReferral}>
                  Copy
                </button>
              </div>
              <button className="primary-button" onClick={handleShareReferral}>
                Share in Telegram
              </button>
              <div className="milestone-list">
                {INVITE_MILESTONES.map((milestone) => {
                  const claimed = state.claimedInviteMilestones.includes(milestone.invites);
                  const ready = state.inviteCount >= milestone.invites && !claimed;
                  return (
                    <button
                      key={milestone.invites}
                      className={`milestone-row ${ready ? "ready" : ""}`}
                      disabled={!ready}
                      onClick={() => handleInviteMilestone(milestone.invites)}
                    >
                      <span>{milestone.invites} invite{milestone.invites === 1 ? "" : "s"}</span>
                      <strong>{claimed ? "Claimed" : milestone.label}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="debug-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Dev panel</p>
                  <h2>Backend prep</h2>
                </div>
                <span>Local</span>
              </div>
              {!telegramViewport.telegramSdkLoaded ? (
                <div className="debug-warning">Telegram SDK not loaded — fullscreen API unavailable.</div>
              ) : null}
              <div className="debug-grid">
                <StatPill label="Origin" value={currentOrigin || "Unknown"} />
                <StatPill label="Mode" value={environmentMode} />
                <StatPill label="Player id" value={player.id} />
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
                <StatPill label="Referral" value={state.referralCode || "Pending"} />
              </div>
              <button
                className="mini-button"
                onClick={() => {
                  setState(applyStarterRewards(ensureReferralCode(ensureLiveOpsState(resetGameState()))));
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
                  setState((current) => resetOnboardingProgress(ensureTutorialState(current)));
                  setOnboardingStep(0);
                  notify("Onboarding reset", "event");
                  haptic.impact("medium");
                }}
              >
                Reset onboarding
              </button>
            </div>
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
            setState((current) => ({
              ...applyStarterRewards(ensureTutorialState(current)),
              onboardingCompleted: true,
              lastActiveAt: Date.now(),
            }));
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
              <strong>{pendingProduct.stars} Stars</strong>
            </div>
            <button className="primary-button" onClick={() => handleProductPurchase(pendingProduct.id)}>
              Buy with Telegram Stars
            </button>
            <p className="fine-print">Mock purchase only. No invoice or real payment is created.</p>
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
  products: MockProduct[];
  onSelect: (productId: MockProductId) => void;
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
              <strong>{product.stars} STAR</strong>
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
