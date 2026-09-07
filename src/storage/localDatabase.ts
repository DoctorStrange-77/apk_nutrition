import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';

const DB_NAME = 'builder_nutrition_local';
const WEB_DB_NAME = 'builder_nutrition_web';
const WEB_STORE = 'app_state';
const WEB_PREFIX = 'builder-nutrition:';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db: SQLiteDBConnection | null = null;
let initPromise: Promise<void> | null = null;
let webDbPromise: Promise<IDBDatabase | null> | null = null;

const isWeb = () => Capacitor.getPlatform() === 'web';

const openWebDatabase = (): Promise<IDBDatabase | null> => {
  if (webDbPromise) return webDbPromise;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  webDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(WEB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WEB_STORE)) {
        database.createObjectStore(WEB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return webDbPromise;
};

const webGet = async (key: string): Promise<string | null> => {
  const database = await openWebDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const tx = database.transaction(WEB_STORE, 'readonly');
    const request = tx.objectStore(WEB_STORE).get(key);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => resolve(null);
  });
};

const webSet = async (key: string, value: string): Promise<boolean> => {
  const database = await openWebDatabase();
  if (!database) return false;
  return new Promise((resolve) => {
    const tx = database.transaction(WEB_STORE, 'readwrite');
    tx.objectStore(WEB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
};

const webRemove = async (key: string): Promise<boolean> => {
  const database = await openWebDatabase();
  if (!database) return false;
  return new Promise((resolve) => {
    const tx = database.transaction(WEB_STORE, 'readwrite');
    tx.objectStore(WEB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
};

const legacyWebGet = (key: string): string | null => {
  try {
    return localStorage.getItem(`${WEB_PREFIX}${key}`);
  } catch {
    return null;
  }
};

const legacyWebSet = (key: string, value: string) => {
  try {
    localStorage.setItem(`${WEB_PREFIX}${key}`, value);
  } catch {
    // IndexedDB remains the primary web store.
  }
};

export async function initLocalDatabase(): Promise<void> {
  if (isWeb()) {
    await openWebDatabase();
    try {
      await navigator.storage?.persist?.();
    } catch {
      // Best effort on mobile browsers.
    }
    return;
  }
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
      let raw = await webGet(key);
      if (!raw) {
        raw = legacyWebGet(key);
        if (raw) await webSet(key, raw);
      }
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
    const stored = await webSet(key, encoded);
    if (!stored) legacyWebSet(key, encoded);
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
    await webRemove(key);
    try {
      localStorage.removeItem(`${WEB_PREFIX}${key}`);
    } catch {
      // Ignore legacy storage failures.
    }
    return;
  }
  await initLocalDatabase();
  if (!db) return;
  await db.run('DELETE FROM app_state WHERE key = ?;', [key]);
}
