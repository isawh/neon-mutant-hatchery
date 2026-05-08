export type AnalyticsEventName =
  | "app_open"
  | "hatch_started"
  | "hatch_completed"
  | "creature_upgraded"
  | "breed_completed"
  | "daily_reward_claimed"
  | "referral_shared"
  | "rare_hatch_shared"
  | "shop_purchase_mocked"
  | "nft_mint_clicked";

export type AnalyticsEvent = {
  id: string;
  name: AnalyticsEventName;
  payload?: Record<string, unknown>;
  createdAt: number;
};

const ANALYTICS_KEY = "neon-mutant-hatchery:analytics";

const readEvents = (): AnalyticsEvent[] => {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
  } catch {
    return [];
  }
};

const writeEvents = (events: AnalyticsEvent[]) => {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(events.slice(-250)));
  } catch {
    // Analytics must never block gameplay.
  }
};

export const trackEvent = (name: AnalyticsEventName, payload?: Record<string, unknown>) => {
  const event: AnalyticsEvent = {
    id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    payload,
    createdAt: Date.now(),
  };
  const events = [...readEvents(), event];
  writeEvents(events);
  console.log("[analytics]", event);
  return event;
};

export const getAnalyticsEvents = () => readEvents();

export const getAnalyticsEventCount = () => readEvents().length;

export const clearAnalyticsEvents = () => {
  try {
    localStorage.removeItem(ANALYTICS_KEY);
  } catch {
    // Analytics cleanup should never block reset flows.
  }
};
