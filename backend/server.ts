import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { createHmac, timingSafeEqual } from "crypto";
import {
  claimReferralMilestone,
  completeMockPurchase,
  createPurchaseInvoice,
  findOrCreatePlayer,
  findPlayerById,
  getDevPlayer,
  getProducts,
  getReferralStats,
  loadSave,
  registerReferral,
  simulateReferralForPlayer,
  writeSave,
  type PlayerRecord,
  type TelegramUser,
} from "./db.js";

config();

const app = express();
const port = Number(process.env.PORT ?? 8080);
const host = "0.0.0.0";
const botToken = process.env.BOT_TOKEN ?? "";
const nodeEnv = process.env.NODE_ENV ?? "development";
const frontendUrl = process.env.FRONTEND_URL ?? "";

const allowedOrigins = new Set(
  [
    frontendUrl,
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ].filter(Boolean),
);

app.use(
  cors({
    origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const hostname = new URL(origin).hostname;
        if (hostname.endsWith(".vercel.app") || hostname.endsWith(".telegram.org")) {
          callback(null, true);
          return;
        }
      } catch {
        // Fall through to rejection.
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

const safeJsonParse = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const validateTelegramInitData = (initData: string) => {
  if (!botToken) {
    throw new Error("BOT_TOKEN is required for Telegram auth validation.");
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    return null;
  }

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const providedHash = Buffer.from(hash, "hex");
  const expectedHash = Buffer.from(calculatedHash, "hex");

  if (providedHash.length !== expectedHash.length || !timingSafeEqual(providedHash, expectedHash)) {
    return null;
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  const maxAgeSeconds = 24 * 60 * 60;
  if (Number.isFinite(authDate) && authDate > 0 && Date.now() / 1000 - authDate > maxAgeSeconds) {
    return null;
  }

  return safeJsonParse<TelegramUser>(params.get("user"));
};

const toAuthResponse = (player: PlayerRecord, telegramUser: TelegramUser, isNewPlayer: boolean) => {
  return {
    playerId: player.id,
    telegramUser,
    isNewPlayer,
    player: {
      id: player.id,
      telegramId: player.telegramId,
      username: player.username,
      firstName: player.firstName,
      lastName: player.lastName,
      referralCode: player.referralCode,
      referredBy: player.referredBy,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    },
  };
};

app.get("/health", (_request: any, response: any) => {
  response.json({ ok: true });
});

app.post("/api/auth/telegram", (request: any, response: any) => {
  const initData = typeof request.body?.initData === "string" ? request.body.initData : "";

  // Development only: lets local frontend testing continue without Telegram launch/initData.
  if (!initData && nodeEnv !== "production") {
    const testUser = getDevPlayer();
    const result = findOrCreatePlayer(testUser);
    response.json(toAuthResponse(result.player, testUser, result.isNewPlayer));
    return;
  }

  const telegramUser = validateTelegramInitData(initData);
  if (!telegramUser?.id) {
    response.status(401).json({ error: "Invalid Telegram initData" });
    return;
  }

  const result = findOrCreatePlayer(telegramUser);
  response.json(toAuthResponse(result.player, telegramUser, result.isNewPlayer));
});

app.get("/api/player/:playerId/save", (request: any, response: any) => {
  const playerId = String(request.params.playerId ?? "");
  if (!playerId) {
    response.status(400).json({ error: "playerId is required" });
    return;
  }

  if (!findPlayerById(playerId)) {
    response.status(404).json({ error: "Player not found" });
    return;
  }

  response.json(loadSave(playerId) ?? { gameState: null, updatedAt: null });
});

app.post("/api/player/:playerId/save", (request: any, response: any) => {
  const playerId = String(request.params.playerId ?? "");
  if (!playerId || !("gameState" in request.body)) {
    response.status(400).json({ error: "playerId and gameState are required" });
    return;
  }

  if (!findPlayerById(playerId)) {
    response.status(404).json({ error: "Player not found" });
    return;
  }

  // TODO: add request authz so players can only write their own save.
  const save = writeSave(playerId, request.body.gameState);
  response.json({ ok: true, ...save });
});

app.post("/api/referral/register", (request: any, response: any) => {
  const playerId = typeof request.body?.playerId === "string" ? request.body.playerId.trim() : "";
  const referralCode = typeof request.body?.referralCode === "string" ? request.body.referralCode.trim() : "";

  if (!playerId || !referralCode || referralCode.length > 64) {
    response.status(400).json({ error: "Valid playerId and referralCode are required" });
    return;
  }

  const result = registerReferral(playerId, referralCode);
  response.json({ playerId, referralCode, ...result });
});

app.get("/api/referral/:playerId", (request: any, response: any) => {
  const playerId = String(request.params.playerId ?? "");
  if (!playerId) {
    response.status(400).json({ error: "playerId is required" });
    return;
  }

  const stats = getReferralStats(playerId);
  if (!stats) {
    response.status(404).json({ error: "Player not found" });
    return;
  }

  response.json(stats);
});

app.post("/api/referral/claim", (request: any, response: any) => {
  const playerId = typeof request.body?.playerId === "string" ? request.body.playerId.trim() : "";
  const milestone = Number(request.body?.milestone);

  if (!playerId || !Number.isFinite(milestone)) {
    response.status(400).json({ error: "Valid playerId and milestone are required" });
    return;
  }

  const result = claimReferralMilestone(playerId, milestone);
  response.json({ playerId, ...result });
});

app.post("/api/referral/simulate", (request: any, response: any) => {
  if (nodeEnv === "production") {
    response.status(403).json({ error: "Referral simulation is development-only" });
    return;
  }

  const playerId = typeof request.body?.playerId === "string" ? request.body.playerId.trim() : "";
  if (!playerId) {
    response.status(400).json({ error: "playerId is required" });
    return;
  }

  try {
    const result = simulateReferralForPlayer(playerId);
    const stats = getReferralStats(playerId);
    if (!result.registered) {
      console.warn("[referral:simulate] Simulation did not register", {
        playerId,
        reason: result.reason,
        statsFound: Boolean(stats),
      });
    }
    response.json({ playerId, stats, ...result });
  } catch (error) {
    console.error("[referral:simulate] Failed to create simulated referral", {
      playerId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    response.status(500).json({
      error: "Failed to simulate referral",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/products", (_request: any, response: any) => {
  response.json({ products: getProducts() });
});

app.post("/api/payments/create-invoice", (request: any, response: any) => {
  const playerId = typeof request.body?.playerId === "string" ? request.body.playerId.trim() : "";
  const productId = typeof request.body?.productId === "string" ? request.body.productId.trim() : "";

  if (!playerId || !productId) {
    response.status(400).json({ error: "playerId and productId are required" });
    return;
  }

  const result = createPurchaseInvoice(playerId, productId);
  if (!result) {
    response.status(404).json({ error: "Player or product not found" });
    return;
  }

  // TODO: replace this placeholder with Telegram Stars createInvoiceLink/sendInvoice.
  // TODO: validate pre_checkout_query and grant rewards only after successful_payment is confirmed server-side.
  response.json({
    ok: true,
    mode: nodeEnv === "production" ? "telegram_stars_placeholder" : "dev_mock_available",
    purchase: result.purchase,
    invoice: {
      productId: result.product.id,
      title: result.product.title,
      description: result.product.description,
      starsPrice: result.product.starsPrice,
      payload: `purchase:${result.purchase.id}`,
      invoiceLink: null,
    },
  });
});

app.post("/api/payments/mock-complete", (request: any, response: any) => {
  if (nodeEnv === "production") {
    response.status(403).json({ error: "Mock payment completion is development-only" });
    return;
  }

  const playerId = typeof request.body?.playerId === "string" ? request.body.playerId.trim() : "";
  const productId = typeof request.body?.productId === "string" ? request.body.productId.trim() : "";

  if (!playerId || !productId) {
    response.status(400).json({ error: "playerId and productId are required" });
    return;
  }

  const result = completeMockPurchase(playerId, productId);
  if (!result) {
    response.status(404).json({ error: "Player or product not found" });
    return;
  }

  response.json({
    ok: true,
    purchase: result.purchase,
    product: result.product,
    reward: result.product.reward,
  });
});

app.listen(port, host, () => {
  console.log(`Neon Hatch backend listening on ${host}:${port}`);
});
