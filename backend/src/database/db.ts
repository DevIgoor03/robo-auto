import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH  = path.join(DATA_DIR, 'robo-auto-local.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    console.log(`[DB] SQLite aberto em ${DB_PATH}`);
  }
  return db;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS master_account (
      id                TEXT PRIMARY KEY DEFAULT 'master',
      email             TEXT NOT NULL,
      name              TEXT NOT NULL,
      currency          TEXT NOT NULL DEFAULT 'BRL',
      encrypted_password TEXT NOT NULL,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS follower_accounts (
      id                TEXT PRIMARY KEY,
      email             TEXT UNIQUE NOT NULL,
      encrypted_password TEXT NOT NULL,
      name              TEXT NOT NULL,
      currency          TEXT NOT NULL DEFAULT 'BRL',
      copy_mode         TEXT NOT NULL DEFAULT 'fixed',
      copy_amount       REAL NOT NULL DEFAULT 5,
      account_type      TEXT NOT NULL DEFAULT 'demo',
      is_active         INTEGER NOT NULL DEFAULT 1,
      stop_win          REAL,
      stop_loss         REAL,
      balance_real      REAL NOT NULL DEFAULT 0,
      balance_demo      REAL NOT NULL DEFAULT 0,
      total_trades      INTEGER NOT NULL DEFAULT 0,
      wins              INTEGER NOT NULL DEFAULT 0,
      losses            INTEGER NOT NULL DEFAULT 0,
      profit            REAL NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trades (
      id                TEXT PRIMARY KEY,
      master_position_id TEXT,
      follower_id       TEXT,
      active_id         INTEGER,
      active_name       TEXT,
      direction         TEXT,
      amount            REAL,
      instrument_type   TEXT,
      result            TEXT NOT NULL DEFAULT 'pending',
      profit            REAL NOT NULL DEFAULT 0,
      open_time         TEXT,
      close_time        TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portal_sessions (
      token        TEXT PRIMARY KEY,
      follower_id  TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at   TEXT NOT NULL,
      FOREIGN KEY (follower_id) REFERENCES follower_accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trades_follower_id ON trades(follower_id);
    CREATE INDEX IF NOT EXISTS idx_trades_result      ON trades(result);
    CREATE INDEX IF NOT EXISTS idx_portal_sessions_follower ON portal_sessions(follower_id);
  `);
}

/* ─── Master ─────────────────────────────────────────────────────── */

export interface DbMaster {
  id: string;
  email: string;
  name: string;
  currency: string;
  encrypted_password: string;
  created_at: string;
}

export const masterDb = {
  save(email: string, name: string, currency: string, encPw: string): void {
    getDb().prepare(`
      INSERT INTO master_account (id, email, name, currency, encrypted_password)
      VALUES ('master', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name  = excluded.name,
        currency = excluded.currency,
        encrypted_password = excluded.encrypted_password
    `).run(email, name, currency, encPw);
  },

  get(): DbMaster | null {
    return (getDb().prepare('SELECT * FROM master_account WHERE id = ?').get('master') as DbMaster) ?? null;
  },

  delete(): void {
    getDb().prepare('DELETE FROM master_account WHERE id = ?').run('master');
  },
};

/* ─── Follower ───────────────────────────────────────────────────── */

export interface DbFollower {
  id: string;
  email: string;
  encrypted_password: string;
  name: string;
  currency: string;
  copy_mode: string;
  copy_amount: number;
  account_type: string;
  is_active: number;
  stop_win: number | null;
  stop_loss: number | null;
  balance_real: number;
  balance_demo: number;
  total_trades: number;
  wins: number;
  losses: number;
  profit: number;
  created_at: string;
  updated_at: string;
}

export const followerDb = {
  upsert(f: Omit<DbFollower, 'created_at' | 'updated_at'>): void {
    getDb().prepare(`
      INSERT INTO follower_accounts
        (id, email, encrypted_password, name, currency, copy_mode, copy_amount, account_type,
         is_active, stop_win, stop_loss, balance_real, balance_demo,
         total_trades, wins, losses, profit)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        name = excluded.name,
        currency = excluded.currency,
        copy_mode = excluded.copy_mode,
        copy_amount = excluded.copy_amount,
        account_type = excluded.account_type,
        is_active = excluded.is_active,
        stop_win = excluded.stop_win,
        stop_loss = excluded.stop_loss,
        balance_real = excluded.balance_real,
        balance_demo = excluded.balance_demo,
        total_trades = excluded.total_trades,
        wins = excluded.wins,
        losses = excluded.losses,
        profit = excluded.profit,
        updated_at = datetime('now')
    `).run(
      f.id, f.email, f.encrypted_password, f.name, f.currency,
      f.copy_mode, f.copy_amount, f.account_type,
      f.is_active ? 1 : 0, f.stop_win, f.stop_loss,
      f.balance_real, f.balance_demo,
      f.total_trades, f.wins, f.losses, f.profit,
    );
  },

  upsertByEmail(f: Omit<DbFollower, 'id' | 'created_at' | 'updated_at'> & { id: string }): void {
    getDb().prepare(`
      INSERT INTO follower_accounts
        (id, email, encrypted_password, name, currency, copy_mode, copy_amount, account_type,
         is_active, stop_win, stop_loss, balance_real, balance_demo,
         total_trades, wins, losses, profit)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET
        encrypted_password = excluded.encrypted_password,
        name = excluded.name,
        currency = excluded.currency,
        updated_at = datetime('now')
    `).run(
      f.id, f.email, f.encrypted_password, f.name, f.currency,
      f.copy_mode, f.copy_amount, f.account_type,
      f.is_active ? 1 : 0, f.stop_win, f.stop_loss,
      f.balance_real, f.balance_demo,
      f.total_trades, f.wins, f.losses, f.profit,
    );
  },

  updateSettings(id: string, mode: string, amount: number, accountType: string,
                 isActive: number, stopWin: number | null, stopLoss: number | null): void {
    getDb().prepare(`
      UPDATE follower_accounts
      SET copy_mode = ?, copy_amount = ?, account_type = ?, is_active = ?,
          stop_win = ?, stop_loss = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(mode, amount, accountType, isActive, stopWin, stopLoss, id);
  },

  updateBalances(id: string, real: number, demo: number): void {
    getDb().prepare(`
      UPDATE follower_accounts SET balance_real = ?, balance_demo = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(real, demo, id);
  },

  updateStats(id: string, totalTrades: number, wins: number, losses: number, profit: number): void {
    getDb().prepare(`
      UPDATE follower_accounts SET total_trades = ?, wins = ?, losses = ?, profit = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(totalTrades, wins, losses, profit, id);
  },

  getAll(): DbFollower[] {
    return getDb().prepare('SELECT * FROM follower_accounts ORDER BY created_at').all() as DbFollower[];
  },

  getById(id: string): DbFollower | null {
    return (getDb().prepare('SELECT * FROM follower_accounts WHERE id = ?').get(id) as DbFollower) ?? null;
  },

  getByEmail(email: string): DbFollower | null {
    return (getDb().prepare('SELECT * FROM follower_accounts WHERE email = ?').get(email) as DbFollower) ?? null;
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM follower_accounts WHERE id = ?').run(id);
  },
};

/* ─── Trades ─────────────────────────────────────────────────────── */

export interface DbTrade {
  id: string;
  master_position_id: string | null;
  follower_id: string | null;
  active_id: number;
  active_name: string;
  direction: string;
  amount: number;
  instrument_type: string;
  result: string;
  profit: number;
  open_time: string;
  close_time: string | null;
  created_at: string;
}

export const tradeDb = {
  insert(t: Omit<DbTrade, 'created_at'>): void {
    getDb().prepare(`
      INSERT OR IGNORE INTO trades
        (id, master_position_id, follower_id, active_id, active_name, direction,
         amount, instrument_type, result, profit, open_time, close_time)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      t.id, t.master_position_id, t.follower_id, t.active_id, t.active_name,
      t.direction, t.amount, t.instrument_type,
      t.result, t.profit, t.open_time, t.close_time,
    );
  },

  resolve(id: string, result: string, profit: number, closeTime: string): void {
    getDb().prepare(`
      UPDATE trades SET result = ?, profit = ?, close_time = ? WHERE id = ?
    `).run(result, profit, closeTime, id);
  },

  getAll(limit = 200): DbTrade[] {
    return getDb().prepare(
      'SELECT * FROM trades ORDER BY open_time DESC LIMIT ?'
    ).all(limit) as DbTrade[];
  },

  getByFollower(followerId: string, limit = 100): DbTrade[] {
    return getDb().prepare(
      'SELECT * FROM trades WHERE follower_id = ? ORDER BY open_time DESC LIMIT ?'
    ).all(followerId, limit) as DbTrade[];
  },

  clearAll(): void {
    getDb().prepare('DELETE FROM trades').run();
  },
};

/* ─── Portal Sessions ────────────────────────────────────────────── */

export const sessionDb = {
  create(token: string, followerId: string, expiresAt: string): void {
    getDb().prepare(`
      INSERT INTO portal_sessions (token, follower_id, expires_at) VALUES (?, ?, ?)
    `).run(token, followerId, expiresAt);
  },

  get(token: string): { follower_id: string; expires_at: string } | null {
    return (getDb().prepare(
      'SELECT follower_id, expires_at FROM portal_sessions WHERE token = ?'
    ).get(token) as { follower_id: string; expires_at: string }) ?? null;
  },

  delete(token: string): void {
    getDb().prepare('DELETE FROM portal_sessions WHERE token = ?').run(token);
  },

  cleanup(): void {
    getDb().prepare("DELETE FROM portal_sessions WHERE expires_at < datetime('now')").run();
  },
};
