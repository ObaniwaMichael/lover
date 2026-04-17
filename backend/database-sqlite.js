import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

class SqliteDatabase {
  constructor() {
    this.dbPath = './data/lovers_code.db';
    this.ensureDataDirectory();
    this.db = new Database(this.dbPath, { readonly: false });
    this.initializeTables();
    console.log('✅ Database initialized successfully');
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  initializeTables() {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Migrate users table if needed (from INTEGER id to TEXT id)
    try {
      const tableInfo = this.db.prepare("PRAGMA table_info(users)").all();
      const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash');
      const hasTextId = tableInfo.some(col => col.name === 'id' && col.type === 'TEXT');
      
      if (!hasPasswordHash || !hasTextId) {
        console.log('🔄 Migrating users table schema...');
        // Create new table with correct schema
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS users_new (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME
          )
        `);
        // Copy data if old table exists
        try {
          this.db.exec(`
            INSERT INTO users_new (id, username, email, created_at, last_login)
            SELECT CAST(id AS TEXT), username, email, created_at, last_login
            FROM users
          `);
        } catch (e) {
          // Old table might not exist or have different structure, that's okay
        }
        // Drop old table and rename new one
        this.db.exec('DROP TABLE IF EXISTS users');
        this.db.exec('ALTER TABLE users_new RENAME TO users');
        console.log('✅ Users table migration complete');
      }
    } catch (migrationError) {
      console.warn('⚠️  Users table migration skipped:', migrationError.message);
    }

    // Create companions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS companions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        personality TEXT NOT NULL,
        identity TEXT NOT NULL,
        gender TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create conversations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        companion_id INTEGER NOT NULL,
        session_id TEXT UNIQUE NOT NULL,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        FOREIGN KEY (companion_id) REFERENCES companions (id) ON DELETE CASCADE
      )
    `);

    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
        content TEXT NOT NULL,
        emotion TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
      )
    `);

    // Create users table with password storage
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Create multiplayer sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS multiplayer_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        title TEXT,
        participant_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create multiplayer messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS multiplayer_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'question', 'answer', 'system', 'emoji', 'image', 'game')),
        question_number INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES multiplayer_sessions (session_id) ON DELETE CASCADE
      )
    `);

    // Older DB files were created with message_type CHECK missing 'image' / 'game' (Truth or Dare, etc.)
    try {
      const mm = this.db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='multiplayer_messages'`)
        .get();
      if (mm?.sql && !mm.sql.includes("'game'")) {
        console.log('🔄 Migrating multiplayer_messages (message_type CHECK)...');
        this.db.exec(`
          CREATE TABLE multiplayer_messages_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'question', 'answer', 'system', 'emoji', 'image', 'game')),
            question_number INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES multiplayer_sessions (session_id) ON DELETE CASCADE
          )
        `);
        this.db.exec(`
          INSERT INTO multiplayer_messages_new (id, session_id, sender, content, message_type, question_number, timestamp)
          SELECT id, session_id, sender, content, message_type, question_number, timestamp
          FROM multiplayer_messages
        `);
        this.db.exec('DROP TABLE multiplayer_messages');
        this.db.exec('ALTER TABLE multiplayer_messages_new RENAME TO multiplayer_messages');
        console.log('✅ multiplayer_messages migration complete');
      }
    } catch (e) {
      console.warn('⚠️ multiplayer_messages migration skipped:', e.message);
    }

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_companion_id ON conversations(companion_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
    `);

    console.log('📊 Database tables initialized');
  }

  // Companion management
  createCompanion(companionData) {
    const stmt = this.db.prepare(`
      INSERT INTO companions (name, personality, identity, gender, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      companionData.name,
      companionData.personality,
      companionData.identity,
      companionData.gender,
      companionData.role
    );
    
    return result.lastInsertRowid;
  }

  getCompanion(companionId) {
    const stmt = this.db.prepare('SELECT * FROM companions WHERE id = ?');
    return stmt.get(companionId);
  }

  getCompanionByName(name) {
    const stmt = this.db.prepare('SELECT * FROM companions WHERE name = ?');
    return stmt.get(name);
  }

  updateCompanion(companionId, companionData) {
    const stmt = this.db.prepare(`
      UPDATE companions 
      SET name = ?, personality = ?, identity = ?, gender = ?, role = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    return stmt.run(
      companionData.name,
      companionData.personality,
      companionData.identity,
      companionData.gender,
      companionData.role,
      companionId
    );
  }

  // Conversation management
  createConversation(companionId, sessionId, title = null) {
    const stmt = this.db.prepare(`
      INSERT INTO conversations (companion_id, session_id, title)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(companionId, sessionId, title);
    return result.lastInsertRowid;
  }

  getConversation(sessionId) {
    const stmt = this.db.prepare(`
      SELECT c.*, comp.name as companion_name, comp.personality, comp.identity, comp.gender, comp.role
      FROM conversations c
      JOIN companions comp ON c.companion_id = comp.id
      WHERE c.session_id = ?
    `);
    return stmt.get(sessionId);
  }

  getConversationById(conversationId) {
    const stmt = this.db.prepare(`
      SELECT c.*, comp.name as companion_name, comp.personality, comp.identity, comp.gender, comp.role
      FROM conversations c
      JOIN companions comp ON c.companion_id = comp.id
      WHERE c.id = ?
    `);
    return stmt.get(conversationId);
  }

  updateConversationTitle(conversationId, title) {
    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(title, conversationId);
  }

  deactivateConversation(sessionId) {
    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `);
    return stmt.run(sessionId);
  }

  // Message management
  addMessage(conversationId, sender, content, emotion = null) {
    const stmt = this.db.prepare(`
      INSERT INTO messages (conversation_id, sender, content, emotion)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(conversationId, sender, content, emotion);
    
    // Update conversation timestamp
    this.updateConversationTimestamp(conversationId);
    
    return result.lastInsertRowid;
  }

  getMessages(conversationId, limit = 50, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(conversationId, limit, offset);
  }

  getRecentMessages(conversationId, count = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(conversationId, count).reverse();
  }

  updateConversationTimestamp(conversationId) {
    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(conversationId);
  }

  // Multiplayer session management
  createMultiplayerSession(sessionId, title = null) {
    // Check if session already exists
    const existingSession = this.getMultiplayerSession(sessionId);
    if (existingSession) {
      // If session exists but is inactive, reactivate it
      if (!existingSession.is_active) {
        const updateStmt = this.db.prepare(`
          UPDATE multiplayer_sessions 
          SET is_active = 1, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `);
        return updateStmt.run(sessionId);
      }
      // If session is active, throw error
      throw new Error('Session already exists and is active');
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO multiplayer_sessions (session_id, title)
      VALUES (?, ?)
    `);
    
    const result = stmt.run(sessionId, title);
    return result.lastInsertRowid;
  }

  getMultiplayerSession(sessionId) {
    const stmt = this.db.prepare('SELECT * FROM multiplayer_sessions WHERE session_id = ?');
    return stmt.get(sessionId);
  }

  updateMultiplayerSessionActivity(sessionId) {
    const stmt = this.db.prepare(`
      UPDATE multiplayer_sessions 
      SET last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `);
    return stmt.run(sessionId);
  }

  updateMultiplayerParticipantCount(sessionId, count) {
    const stmt = this.db.prepare(`
      UPDATE multiplayer_sessions 
      SET participant_count = ?, last_activity = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `);
    return stmt.run(count, sessionId);
  }

  deactivateMultiplayerSession(sessionId) {
    const stmt = this.db.prepare(`
      UPDATE multiplayer_sessions 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `);
    return stmt.run(sessionId);
  }

  // Multiplayer message management
  addMultiplayerMessage(sessionId, sender, content, messageType = 'chat', questionNumber = null) {
    const stmt = this.db.prepare(`
      INSERT INTO multiplayer_messages (session_id, sender, content, message_type, question_number)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(sessionId, sender, content, messageType, questionNumber);
    
    // Update session activity
    this.updateMultiplayerSessionActivity(sessionId);
    
    return result.lastInsertRowid;
  }

  getMultiplayerMessages(sessionId, limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM multiplayer_messages 
      WHERE session_id = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(sessionId, limit, offset);
  }

  getRecentMultiplayerMessages(sessionId, count = 20) {
    const stmt = this.db.prepare(`
      SELECT * FROM multiplayer_messages 
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(sessionId, count).reverse();
  }

  // Multiplayer conversation listing and search
  getMultiplayerSessions(limit = 20, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT ms.*,
             (SELECT COUNT(*) FROM multiplayer_messages WHERE session_id = ms.session_id) as message_count,
             (SELECT content FROM multiplayer_messages WHERE session_id = ms.session_id ORDER BY timestamp DESC LIMIT 1) as last_message
      FROM multiplayer_sessions ms
      ORDER BY ms.updated_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  searchMultiplayerSessions(searchTerm, limit = 20) {
    const stmt = this.db.prepare(`
      SELECT DISTINCT ms.*,
             (SELECT COUNT(*) FROM multiplayer_messages WHERE session_id = ms.session_id) as message_count
      FROM multiplayer_sessions ms
      JOIN multiplayer_messages mm ON ms.session_id = mm.session_id
      WHERE ms.title LIKE ? OR mm.content LIKE ? OR ms.session_id LIKE ?
      ORDER BY ms.updated_at DESC
      LIMIT ?
    `);
    
    const searchPattern = `%${searchTerm}%`;
    return stmt.all(searchPattern, searchPattern, searchPattern, limit);
  }

  // Multiplayer statistics
  getMultiplayerStats() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_sessions,
        COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as sessions_today,
        COUNT(CASE WHEN DATE(created_at) = DATE('now', '-1 day') THEN 1 END) as sessions_yesterday,
        AVG(participant_count) as avg_participants
      FROM multiplayer_sessions
    `);
    return stmt.get();
  }

  getMultiplayerMessageStats() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN message_type = 'chat' THEN 1 END) as chat_messages,
        COUNT(CASE WHEN message_type = 'question' THEN 1 END) as question_messages,
        COUNT(CASE WHEN message_type = 'answer' THEN 1 END) as answer_messages,
        COUNT(CASE WHEN message_type = 'emoji' THEN 1 END) as emoji_messages,
        COUNT(CASE WHEN DATE(timestamp) = DATE('now') THEN 1 END) as messages_today
      FROM multiplayer_messages
    `);
    return stmt.get();
  }

  // Export multiplayer session
  exportMultiplayerSession(sessionId) {
    const session = this.getMultiplayerSession(sessionId);
    if (!session) return null;

    const messages = this.getMultiplayerMessages(sessionId);
    
    return {
      session: {
        id: session.id,
        session_id: session.session_id,
        title: session.title,
        participant_count: session.participant_count,
        created_at: session.created_at,
        updated_at: session.updated_at,
        last_activity: session.last_activity
      },
      messages: messages.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        content: msg.content,
        message_type: msg.message_type,
        question_number: msg.question_number,
        timestamp: msg.timestamp
      }))
    };
  }

  // Conversation listing and search
  getConversations(companionId = null, limit = 20, offset = 0) {
    let query = `
      SELECT c.*, comp.name as companion_name,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
             (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message
      FROM conversations c
      JOIN companions comp ON c.companion_id = comp.id
    `;
    
    const params = [];
    if (companionId) {
      query += ' WHERE c.companion_id = ?';
      params.push(companionId);
    }
    
    query += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  searchConversations(searchTerm, limit = 20) {
    const stmt = this.db.prepare(`
      SELECT DISTINCT c.*, comp.name as companion_name,
             (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      JOIN companions comp ON c.companion_id = comp.id
      JOIN messages m ON c.id = m.conversation_id
      WHERE c.title LIKE ? OR m.content LIKE ? OR comp.name LIKE ?
      ORDER BY c.updated_at DESC
      LIMIT ?
    `);
    
    const searchPattern = `%${searchTerm}%`;
    return stmt.all(searchPattern, searchPattern, searchPattern, limit);
  }

  // Statistics and analytics
  getConversationStats() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_conversations,
        COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as conversations_today,
        COUNT(CASE WHEN DATE(created_at) = DATE('now', '-1 day') THEN 1 END) as conversations_yesterday
      FROM conversations
    `);
    return stmt.get();
  }

  getMessageStats() {
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN sender = 'ai' THEN 1 END) as ai_messages,
        COUNT(CASE WHEN DATE(timestamp) = DATE('now') THEN 1 END) as messages_today
      FROM messages
    `);
    return stmt.get();
  }

  getCompanionStats() {
    const stmt = this.db.prepare(`
      SELECT 
        comp.name,
        COUNT(c.id) as conversation_count,
        COUNT(m.id) as message_count,
        MAX(c.updated_at) as last_activity
      FROM companions comp
      LEFT JOIN conversations c ON comp.id = c.companion_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      GROUP BY comp.id
      ORDER BY message_count DESC
    `);
    return stmt.all();
  }

  // Cleanup and maintenance
  cleanupOldConversations(daysOld = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM conversations 
      WHERE updated_at < DATE('now', '-${daysOld} days') 
      AND is_active = 0
    `);
    return stmt.run();
  }

  cleanupOldMultiplayerSessions(daysOld = 30) {
    const stmt = this.db.prepare(`
      DELETE FROM multiplayer_sessions 
      WHERE updated_at < DATE('now', '-${daysOld} days') 
      AND is_active = 0
    `);
    return stmt.run();
  }

  getDatabaseSize() {
    const stmt = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
    const result = stmt.get();
    return result.size;
  }

  // Backup and export
  exportConversation(conversationId) {
    const conversation = this.getConversationById(conversationId);
    if (!conversation) return null;

    const messages = this.getMessages(conversationId);
    
    return {
      conversation: {
        id: conversation.id,
        session_id: conversation.session_id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        companion: {
          name: conversation.companion_name,
          personality: conversation.personality,
          identity: conversation.identity,
          gender: conversation.gender,
          role: conversation.role
        }
      },
      messages: messages.map(msg => ({
        id: msg.id,
        sender: msg.sender,
        content: msg.content,
        emotion: msg.emotion,
        timestamp: msg.timestamp
      }))
    };
  }

  // User management methods
  createUser(userId, username, email, passwordHash) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, email, password_hash, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);
      stmt.run(userId, username, email, passwordHash);
      return { id: userId, username, email, createdAt: new Date() };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) || null;
  }

  getUserByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) || null;
  }

  getUserById(userId) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) || null;
  }

  updateUserLastLogin(userId) {
    const stmt = this.db.prepare('UPDATE users SET last_login = datetime("now") WHERE id = ?');
    stmt.run(userId);
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      console.log('🔒 Database connection closed');
    }
  }
}

export default SqliteDatabase;