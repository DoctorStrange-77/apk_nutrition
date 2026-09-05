import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';

const DB_NAME = 'builder_nutrition_local';
const WEB_PREFIX = 'builder-nutrition:';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;
let initPromise: Promise<void> | null = null;

const isWeb = () => Capacitor.getPlatform() === 'web';

export async function initLocalDatabase(): Promise<void> {
  if (isWeb()) return;
  if (db) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const consistency = await sqlite.checkConnectionsConsistency();
    const current = await sqlite.isConnection(DB_NAME, false);
    if (consistency.result && current.result) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
    }

    const openState = await db.isDBOpen();
    if (!openState.result) await db.open();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

export async function getLocalValue<T>(key: string, fallback: T): Promise<T> {
  if (isWeb()) {
    try {
      const raw = localStorage.getItem(`${WEB_PREFIX}${key}`);
      return raw ? JSON.parse(raw) as T : fallback;
    } catch {
      return fallback;
    }
  }

  await initLocalDatabase();
  if (!db) return fallback;
  const result = await db.query('SELECT value FROM app_state WHERE key = ? LIMIT 1;', [key]);
  const raw = result.values?.[0]?.value;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setLocalValue<T>(key: string, value: T): Promise<void> {
  const encoded = JSON.stringify(value);
  if (isWeb()) {
    localStorage.setItem(`${WEB_PREFIX}${key}`, encoded);
    return;
  }

  await initLocalDatabase();
  if (!db) throw new Error('LOCAL_DATABASE_UNAVAILABLE');
  await db.run(
    `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    [key, encoded, new Date().toISOString()],
  );
}

export async function removeLocalValue(key: string): Promise<void> {
  if (isWeb()) {
    localStorage.removeItem(`${WEB_PREFIX}${key}`);
    return;
  }
  await initLocalDatabase();
  if (!db) return;
  await db.run('DELETE FROM app_state WHERE key = ?;', [key]);
}
