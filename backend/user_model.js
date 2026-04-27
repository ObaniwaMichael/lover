import crypto from 'crypto';
import DatabaseManager from './database.js';

let dbRef = null;
let dbInitPromise = null;

/**
 * Allow the server to inject its already-initialized DatabaseManager instance.
 * If not injected, UserModel will lazily create and initialize its own instance.
 */
export function setUserModelDb(db) {
  dbRef = db;
}

async function getDb() {
  if (dbRef) return dbRef;
  if (!dbInitPromise) {
    const db = new DatabaseManager();
    dbInitPromise = db.initialize().then(() => {
      dbRef = db;
      return dbRef;
    });
  }
  return dbInitPromise;
}

/**
 * User model backed by DatabaseManager (PostgreSQL via DATABASE_URL, else SQLite).
 * Keeps the old Supabase/Mongoose-like interface so existing code doesn't break.
 */
class UserModel {
  static async findOne(query) {
    const db = await getDb();
    if (query?.username) return this._mapToUser(await db.getUserByUsername(query.username));
    if (query?.email) return this._mapToUser(await db.getUserByEmail(query.email));
    if (query?.id) return this._mapToUser(await db.getUserById(query.id));
    return null;
  }

  static async findById(id) {
    const db = await getDb();
    return this._mapToUser(await db.getUserById(id));
  }

  static async create(userData) {
    const db = await getDb();
    const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `user-${Date.now()}`;
    const row = await db.createUser(id, userData.username, userData.email, userData.password);
    return this._mapToUser({
      id: row.id,
      username: row.username,
      email: row.email,
      password_hash: userData.password,
      created_at: row.createdAt,
      last_login: null,
      is_active: true,
    });
  }

  static async updateLastLogin(userId) {
    const db = await getDb();
    await db.updateUserLastLogin(userId);
    const refreshed = await db.getUserById(userId);
    return this._mapToUser(refreshed);
  }

  static _mapToUser(row) {
    if (!row) return null;
    return {
      _id: row.id,
      id: row.id,
      username: row.username,
      email: row.email,
      password: row.password_hash,
      createdAt: row.created_at ?? row.createdAt,
      lastLogin: row.last_login ?? row.lastLogin ?? null,
      isActive: row.is_active ?? true,
      save: async () => this,
    };
  }
}

export default UserModel;
