import Database from "better-sqlite3";
import { createHash, randomUUID } from "crypto";
import { config } from "dotenv";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

config();

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type PlayerRecord = {
  id: string;
  telegramId: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  referralCode: string;
  referredBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudSaveRecord = {
  gameState: unknown;
  updatedAt: string;
};

export type ReferralRegisterResult =
  | {
      ok: true;
      registered: true;
      rewardPending: true;
      inviterPlayerId: string;
      invitedReward: ReferralReward;
    }
  | { ok: true; registered: false; rewardPending: false; reason: "self_referral" | "duplicate" | "unknown_code" };

export type ReferralReward = {
  gems?: number;
  eggs?: number;
  premiumCapsules?: number;
  rareChanceBonus?: number;
  exclusiveColor?: string;
};

export type ReferralMilestone = {
  invites: number;
  label: string;
  reward: ReferralReward;
};

export type ReferralStats = {
  playerId: string;
  referralCode: string;
  referredBy: string | null;
  inviteCount: number;
  claimedMilestones: number[];
  milestones: Array<ReferralMilestone & { claimed: boolean; claimable: boolean }>;
};

export type ReferralClaimResult =
  | { ok: true; claimed: true; milestone: number; reward: ReferralReward; stats: ReferralStats }
  | {
      ok: true;
      claimed: false;
      reason: "unknown_player" | "unknown_milestone" | "not_enough_invites" | "already_claimed";
      stats?: ReferralStats;
    };

type PlayerRow = {
  id: string;
  telegram_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
};

type SaveRow = {
  player_id: string;
  game_state_json: string;
  updated_at: string;
};

type MilestoneClaimRow = {
  milestone: number;
};

export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  { invites: 1, reward: { gems: 2, premiumCapsules: 1 }, label: "2 gems + premium capsule" },
  { invites: 3, reward: { gems: 5, eggs: 2 }, label: "5 gems + 2 capsules" },
  { invites: 5, reward: { gems: 8, rareChanceBonus: 3 }, label: "8 gems + rare chance" },
  { invites: 10, reward: { gems: 15, premiumCapsules: 3, exclusiveColor: "#00ffd5" }, label: "Neon mint color" },
  { invites: 25, reward: { gems: 40, premiumCapsules: 8, exclusiveColor: "#ffffff" }, label: "Prismatic lab kit" },
];

const INVITED_PLAYER_REWARD: ReferralReward = { premiumCapsules: 1 };

const databasePath = process.env.SQLITE_PATH ?? join(process.cwd(), "data", "neon-hatch.db");

const ensureDatabaseDirectory = () => {
  const directory = dirname(databasePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
};

ensureDatabaseDirectory();

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    telegram_id TEXT UNIQUE,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    referral_code TEXT NOT NULL UNIQUE,
    referred_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (referred_by) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS saves (
    player_id TEXT PRIMARY KEY,
    game_state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    inviter_player_id TEXT NOT NULL,
    invited_player_id TEXT NOT NULL UNIQUE,
    referral_code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reward_claimed INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (inviter_player_id) REFERENCES players(id),
    FOREIGN KEY (invited_player_id) REFERENCES players(id)
  );

  CREATE TABLE IF NOT EXISTS referral_milestone_claims (
    player_id TEXT NOT NULL,
    milestone INTEGER NOT NULL,
    reward_json TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    PRIMARY KEY (player_id, milestone),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_players_referral_code ON players(referral_code);
  CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals(inviter_player_id);
  CREATE INDEX IF NOT EXISTS idx_referral_claims_player ON referral_milestone_claims(player_id);
`);

const mapPlayerRow = (row: PlayerRow): PlayerRecord => ({
  id: row.id,
  telegramId: row.telegram_id,
  username: row.username,
  firstName: row.first_name,
  lastName: row.last_name,
  referralCode: row.referral_code,
  referredBy: row.referred_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getStableReferralCode = (playerId: string) =>
  createHash("sha256").update(`neon-hatch:${playerId}`).digest("hex").slice(0, 10).toUpperCase();

export const getPlayerId = (telegramUser: TelegramUser) => `tg_${telegramUser.id}`;

export const getDevPlayer = (): TelegramUser => ({
  id: 100000001,
  first_name: "Dev",
  username: "dev_player",
  language_code: "en",
});

export const findPlayerById = (playerId: string): PlayerRecord | null => {
  const row = db.prepare("SELECT * FROM players WHERE id = ?").get(playerId) as PlayerRow | undefined;
  return row ? mapPlayerRow(row) : null;
};

export const findPlayerByReferralCode = (referralCode: string): PlayerRecord | null => {
  const row = db.prepare("SELECT * FROM players WHERE referral_code = ?").get(referralCode) as PlayerRow | undefined;
  return row ? mapPlayerRow(row) : null;
};

export const findOrCreatePlayer = (telegramUser: TelegramUser) => {
  const playerId = getPlayerId(telegramUser);
  const existing = findPlayerById(playerId);
  const now = new Date().toISOString();

  if (existing) {
    db.prepare(
      `
        UPDATE players
        SET username = ?, first_name = ?, last_name = ?, updated_at = ?
        WHERE id = ?
      `,
    ).run(telegramUser.username ?? null, telegramUser.first_name ?? null, telegramUser.last_name ?? null, now, playerId);

    return {
      player: findPlayerById(playerId) ?? existing,
      isNewPlayer: false,
    };
  }

  const referralCode = getStableReferralCode(playerId);
  db.prepare(
    `
      INSERT INTO players (
        id, telegram_id, username, first_name, last_name, referral_code, referred_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `,
  ).run(
    playerId,
    String(telegramUser.id),
    telegramUser.username ?? null,
    telegramUser.first_name ?? null,
    telegramUser.last_name ?? null,
    referralCode,
    now,
    now,
  );

  return {
    player: findPlayerById(playerId) as PlayerRecord,
    isNewPlayer: true,
  };
};

export const loadSave = (playerId: string): CloudSaveRecord | null => {
  const row = db.prepare("SELECT * FROM saves WHERE player_id = ?").get(playerId) as SaveRow | undefined;
  if (!row) {
    return null;
  }

  return {
    gameState: JSON.parse(row.game_state_json) as unknown,
    updatedAt: row.updated_at,
  };
};

export const writeSave = (playerId: string, gameState: unknown): CloudSaveRecord => {
  const now = new Date().toISOString();
  const gameStateJson = JSON.stringify(gameState);

  db.prepare(
    `
      INSERT INTO saves (player_id, game_state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        game_state_json = excluded.game_state_json,
        updated_at = excluded.updated_at
    `,
  ).run(playerId, gameStateJson, now);

  db.prepare("UPDATE players SET updated_at = ? WHERE id = ?").run(now, playerId);

  return {
    gameState,
    updatedAt: now,
  };
};

export const getReferralStats = (playerId: string): ReferralStats | null => {
  const player = findPlayerById(playerId);
  if (!player) {
    return null;
  }

  const inviteCount = (
    db.prepare("SELECT COUNT(*) AS count FROM referrals WHERE inviter_player_id = ?").get(playerId) as
      | { count: number }
      | undefined
  )?.count ?? 0;
  const claimedMilestones = (
    db.prepare("SELECT milestone FROM referral_milestone_claims WHERE player_id = ? ORDER BY milestone").all(playerId) as
      | MilestoneClaimRow[]
      | undefined
  )?.map((row) => row.milestone) ?? [];
  const claimedSet = new Set(claimedMilestones);

  return {
    playerId,
    referralCode: player.referralCode,
    referredBy: player.referredBy,
    inviteCount,
    claimedMilestones,
    milestones: REFERRAL_MILESTONES.map((milestone) => ({
      ...milestone,
      claimed: claimedSet.has(milestone.invites),
      claimable: inviteCount >= milestone.invites && !claimedSet.has(milestone.invites),
    })),
  };
};

export const claimReferralMilestone = (playerId: string, milestone: number): ReferralClaimResult => {
  const stats = getReferralStats(playerId);
  if (!stats) {
    return { ok: true, claimed: false, reason: "unknown_player" };
  }

  const milestoneConfig = REFERRAL_MILESTONES.find((item) => item.invites === milestone);
  if (!milestoneConfig) {
    return { ok: true, claimed: false, reason: "unknown_milestone", stats };
  }

  if (stats.claimedMilestones.includes(milestone)) {
    return { ok: true, claimed: false, reason: "already_claimed", stats };
  }

  if (stats.inviteCount < milestone) {
    return { ok: true, claimed: false, reason: "not_enough_invites", stats };
  }

  const now = new Date().toISOString();
  try {
    db.prepare(
      `
        INSERT INTO referral_milestone_claims (player_id, milestone, reward_json, claimed_at)
        VALUES (?, ?, ?, ?)
      `,
    ).run(playerId, milestone, JSON.stringify(milestoneConfig.reward), now);
  } catch {
    return { ok: true, claimed: false, reason: "already_claimed", stats: getReferralStats(playerId) ?? stats };
  }

  return {
    ok: true,
    claimed: true,
    milestone,
    reward: milestoneConfig.reward,
    stats: getReferralStats(playerId) ?? stats,
  };
};

export const registerReferral = (playerId: string, referralCode: string): ReferralRegisterResult => {
  const invitedPlayer = findPlayerById(playerId);
  const inviter = findPlayerByReferralCode(referralCode);

  if (!invitedPlayer || !inviter) {
    return { ok: true, registered: false, rewardPending: false, reason: "unknown_code" };
  }

  if (inviter.id === invitedPlayer.id) {
    return { ok: true, registered: false, rewardPending: false, reason: "self_referral" };
  }

  if (invitedPlayer.referredBy) {
    return { ok: true, registered: false, rewardPending: false, reason: "duplicate" };
  }

  const now = new Date().toISOString();
  const referralId = randomUUID();

  const transaction = db.transaction(() => {
    db.prepare("UPDATE players SET referred_by = ?, updated_at = ? WHERE id = ? AND referred_by IS NULL").run(
      inviter.id,
      now,
      invitedPlayer.id,
    );

    db.prepare(
      `
        INSERT INTO referrals (id, inviter_player_id, invited_player_id, referral_code, created_at, reward_claimed)
        VALUES (?, ?, ?, ?, ?, 0)
      `,
    ).run(referralId, inviter.id, invitedPlayer.id, referralCode, now);
  });

  try {
    transaction();
  } catch {
    return { ok: true, registered: false, rewardPending: false, reason: "duplicate" };
  }

  return {
    ok: true,
    registered: true,
    rewardPending: true,
    inviterPlayerId: inviter.id,
    invitedReward: INVITED_PLAYER_REWARD,
  };
};

export const simulateReferralForPlayer = (inviterPlayerId: string): ReferralRegisterResult => {
  const inviter = findPlayerById(inviterPlayerId);
  if (!inviter) {
    return { ok: true, registered: false, rewardPending: false, reason: "unknown_code" };
  }

  const now = new Date().toISOString();
  const invitedPlayerId = `dev_ref_${randomUUID()}`;
  const referralId = randomUUID();

  const transaction = db.transaction(() => {
    db.prepare(
      `
        INSERT INTO players (
          id, telegram_id, username, first_name, last_name, referral_code, referred_by, created_at, updated_at
        )
        VALUES (?, NULL, ?, ?, NULL, ?, ?, ?, ?)
      `,
    ).run(
      invitedPlayerId,
      `fake_${Date.now()}`,
      "Simulated",
      getStableReferralCode(invitedPlayerId),
      inviter.id,
      now,
      now,
    );

    db.prepare(
      `
        INSERT INTO referrals (id, inviter_player_id, invited_player_id, referral_code, created_at, reward_claimed)
        VALUES (?, ?, ?, ?, ?, 0)
      `,
    ).run(referralId, inviter.id, invitedPlayerId, inviter.referralCode, now);
  });

  transaction();

  return {
    ok: true,
    registered: true,
    rewardPending: true,
    inviterPlayerId: inviter.id,
    invitedReward: INVITED_PLAYER_REWARD,
  };
};
