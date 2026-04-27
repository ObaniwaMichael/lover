import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ServerMonitor from './monitoring.js';
import DatabaseManager from './database.js';
import User, { setUserModelDb } from './user_model.js';
import validateEnvironment from './env-validator.js';
import { initGeminiModels, isGeminiAvailable, geminiGenerateText } from './gemini-client.js';
import MultiplayerModel, { setMultiplayerModelDb } from './multiplayer_model.js';
import { authenticateToken } from './middleware/authMiddleware.js';
import { requireMaintenanceKey } from './middleware/maintenanceAuth.js';

// Load environment variables
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

// Validate environment variables
validateEnvironment();

// Debug: Check if environment variables are loaded
console.log('🔍 Environment check:');
initGeminiModels();
console.log('  PORT:', process.env.PORT || 'Using default');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');

/** In production, omit chat/question bodies from logs unless LOG_MULTIPLAYER_CONTENT=1. */
const logMultiplayerMessageContent =
  process.env.NODE_ENV === 'production'
    ? process.env.LOG_MULTIPLAYER_CONTENT === '1'
    : process.env.LOG_MULTIPLAYER_CONTENT !== '0';

const app = express();
const PORT = Number(process.env.PORT || 4000);
/** Bind on all interfaces for VMs / containers (Oracle Cloud, Docker). */
const HOST = process.env.HOST || '0.0.0.0';
// Production: set to your SPA origin, e.g. https://your-vm.example.com (see backend/.env.example)
const CORS_ORIGIN = process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5729/');

// Behind Oracle Cloud LB / nginx: set TRUST_PROXY=1 (or hop count). TRUST_PROXY=0 disables.
if (process.env.TRUST_PROXY === '0' || process.env.TRUST_PROXY === 'false') {
  app.set('trust proxy', false);
} else if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', true);
} else if (process.env.TRUST_PROXY_HOPS) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);
} else {
  app.set('trust proxy', 1);
}

// Initialize monitoring and database
const monitor = new ServerMonitor();
const db = new DatabaseManager();
await db.initialize();
setUserModelDb(db);
setMultiplayerModelDb(db);

// Security middleware with enhanced configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS must run before /api rate limiters: otherwise OPTIONS preflight can get 429/other
// responses without Access-Control-* headers and the browser reports a CORS failure.
/** Fix typos like `http:http://host` from mis-edited .env files */
function fixDoubleSchemeOrigin(raw) {
  const s = raw.trim();
  if (/^http:http:\/\//i.test(s)) return s.replace(/^http:/i, '');
  if (/^https:https:\/\//i.test(s)) return s.replace(/^https:/i, '');
  if (/^http:https:\/\//i.test(s)) return s.replace(/^http:/i, '');
  return s;
}

const buildAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    const rawCors = (CORS_ORIGIN || '').trim();
    const corsOrigin = fixDoubleSchemeOrigin(CORS_ORIGIN || '');
    if (rawCors && rawCors !== corsOrigin) {
      console.warn(`⚠️ CORS_ORIGIN looked malformed; normalized to: ${corsOrigin}`);
    }
    const normalized = corsOrigin.endsWith('/') ? corsOrigin.slice(0, -1) : corsOrigin;
    if (!normalized) {
      console.warn(
        '⚠️ CORS_ORIGIN is not set. Set it to your self-hosted SPA origin (e.g. https://your-vm.example.com) or browsers will be blocked.'
      );
      return [];
    }
    return [normalized, corsOrigin];
  }
  const devOrigins = [
    'http://localhost:5173',
    'http://localhost:5729',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:3000',
  ];
  const fromEnv = (CORS_ORIGIN || '').trim();
  if (fromEnv) {
    const n = fromEnv.endsWith('/') ? fromEnv.slice(0, -1) : fromEnv;
    [n, fromEnv].forEach((o) => {
      if (o && !devOrigins.includes(o)) devOrigins.push(o);
    });
  }
  return devOrigins;
};

const allowedOrigins = buildAllowedOrigins();

/** In development, allow any http(s) origin on localhost / 127.0.0.1 so Vite can use alternate ports (5730, etc.). */
const isLocalDevBrowserOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (isLocalDevBrowserOrigin(origin)) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    const isAllowed = allowedOrigins.some((allowed) => {
      const normalizedAllowed = allowed.endsWith('/') ? allowed.slice(0, -1) : allowed;
      const match =
        origin === allowed ||
        origin === normalizedAllowed ||
        normalizedOrigin === allowed ||
        normalizedOrigin === normalizedAllowed ||
        origin.startsWith(allowed) ||
        normalizedOrigin.startsWith(normalizedAllowed);
      return match;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(null, false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  }),
);

const skipHealthAndMetrics = (req) =>
  req.path === '/health' || req.path === '/metrics';

/**
 * Rate-limit key: IP + User-Agent. Defined here so a mismatched hoisted
 * `express-rate-limit` version (e.g. running `node backend/server.js` from repo root)
 * cannot break on missing `ipKeyGenerator` export.
 */
function makeRateLimitKey(req) {
  const ip = req.ip ?? req.socket?.remoteAddress ?? '127.0.0.1';
  const ua = req.headers['user-agent'] || 'unknown';
  return `${ip}:${ua}`;
}

// Rate limiting with improved configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  skip: skipHealthAndMetrics,
  keyGenerator: (req) => makeRateLimitKey(req),
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 AI requests per minute
  message: {
    error: 'Too many AI requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req) => makeRateLimitKey(req),
});

// Auth-specific rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => makeRateLimitKey(req),
});

// Speed limiting (built on express-rate-limit; supports `skip` in v2.1+)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes without delay
  delayMs: () => 500, // add 500ms delay per request after delayAfter
  skip: skipHealthAndMetrics,
  validate: { delayMs: false },
});

// Apply rate limiting
app.use('/api/', limiter);
app.use('/api/ai-companion/', aiLimiter);
app.use('/api/auth/', authLimiter);
app.use(speedLimiter);



// Body parsing with limits (invalid JSON → Express 400; avoid throwing in verify hook)
app.use(express.json({ limit: '10mb' }));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

morgan.token('request-id', (req) => req.requestId || '-');

const accessLogFormat =
  ':remote-addr :method :url HTTP/:http-version :status :res[content-length] - :response-time ms [:request-id]';

app.use(
  morgan(accessLogFormat, {
    skip: (req) => skipHealthAndMetrics(req),
    stream: { write: (line) => process.stdout.write(line) },
  }),
);

// Request ID + monitoring (always records /health internally if you remove skip above)
app.use((req, res, next) => {
  const start = Date.now();
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  res.setHeader('X-Request-Id', req.requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusEmoji =
      status >= 500 ? '💥' : status >= 400 ? '⚠️' : status >= 300 ? '🔄' : '✅';

    if (process.env.NODE_ENV !== 'production' || process.env.LOG_HTTP_VERBOSE === '1') {
      console.log(
        `${statusEmoji} ${req.method} ${req.path} - ${status} - ${duration}ms [${req.requestId}]`,
      );
    }
    monitor.logRequest(req, res, duration);

    if (duration > 1000) {
      console.warn(`🐌 Slow request: ${req.method} ${req.path} took ${duration}ms [${req.requestId}]`);
    }
  });

  next();
});

// Input validation middleware
const validateCompanionConfig = (req, res, next) => {
  const { companionConfig } = req.body;
  
  if (!companionConfig) {
    console.error('❌ Validation failed: companionConfig is missing from request body');
    console.error('Request body keys:', Object.keys(req.body || {}));
    return res.status(400).json({ error: 'Companion configuration is required' });
  }
  
  const requiredFields = ['name', 'personality', 'identity', 'gender', 'role'];
  const missingFields = requiredFields.filter(field => !companionConfig[field]);
  
  if (missingFields.length > 0) {
    console.error('❌ Validation failed: Missing required fields:', missingFields);
    console.error('Received companionConfig:', JSON.stringify(companionConfig, null, 2));
    return res.status(400).json({ 
      error: 'Missing required fields', 
      missingFields 
    });
  }
  
  // Enhanced input validation
  const validationErrors = [];
  
  if (companionConfig.name && companionConfig.name.length < 2) {
    validationErrors.push('Name must be at least 2 characters long');
  }
  
  if (companionConfig.personality && companionConfig.personality.length < 10) {
    validationErrors.push('Personality must be at least 10 characters long');
  }
  
  if (validationErrors.length > 0) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: validationErrors 
    });
  }
  
  // Sanitize inputs with XSS protection
  const sanitizeInput = (input) => {
    return String(input)
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000);
  };
  
  const sanitizedConfig = {
    name: sanitizeInput(companionConfig.name).substring(0, 50),
    personality: sanitizeInput(companionConfig.personality),
    identity: sanitizeInput(companionConfig.identity),
    gender: sanitizeInput(companionConfig.gender).substring(0, 20),
    role: sanitizeInput(companionConfig.role).substring(0, 500)
  };
  
  req.sanitizedConfig = sanitizedConfig;
  next();
};

const validateMessage = (req, res, next) => {
  const { message } = req.body;
  
  if (!message || typeof message !== 'string') {
    console.error('❌ Validation failed: message is missing or invalid');
    console.error('Request body keys:', Object.keys(req.body || {}));
    console.error('Message value:', message);
    return res.status(400).json({ error: 'Valid message is required' });
  }
  
  const sanitizedMessage = String(message).trim().substring(0, 2000);
  
  if (sanitizedMessage.length === 0) {
    console.error('❌ Validation failed: message is empty after sanitization');
    return res.status(400).json({ error: 'Message cannot be empty' });
  }
  
  req.sanitizedMessage = sanitizedMessage;
  next();
};

const server = http.createServer(app);

const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 120000);
server.requestTimeout = requestTimeoutMs;
server.headersTimeout = Number(
  process.env.HEADERS_TIMEOUT_MS || Math.min(requestTimeoutMs + 5000, 130000),
);
server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 65000);
server.maxHeadersCount = Number(process.env.MAX_HTTP_HEADERS || 2000);

const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  // Long timeouts help reverse proxies and flaky mobile networks
  pingTimeout: 120000, // 2 minutes
  pingInterval: 25000,
  // Allow both transports, but prefer websocket
  transports: ['websocket', 'polling'],
  // Allow upgrade from polling to websocket
  allowUpgrades: true,
  // Increase maxHttpBufferSize for large messages
  maxHttpBufferSize: 1e6, // 1MB
  // Connection state recovery for better reconnection
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  allowEIO3: true,
});

// Store active sessions and their participants with cleanup
const sessions = new Map();
const aiCompanions = new Map();
const userConnections = new Map(); // Track user connections for cleanup

// Cleanup old sessions every 30 minutes
const sessionCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, sessionData] of sessions.entries()) {
    if (now - sessionData.lastActivity > 30 * 60 * 1000) { // 30 minutes
      sessions.delete(sessionId);
      console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
    }
  }
}, 30 * 60 * 1000);
if (typeof sessionCleanupInterval.unref === 'function') {
  sessionCleanupInterval.unref();
}

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  userConnections.set(socket.id, { connectedAt: Date.now() });
  monitor.updateConnectionCount(io.engine.clientsCount);

  // Join a specific session
  socket.on('join-session', async (data) => {
    // Handle both old format (string) and new format (object)
    let sessionId = typeof data === 'string' ? data : data.sessionId;
    const playerName = typeof data === 'string' ? null : data.playerName;
    
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('error', { message: 'Invalid session ID' });
      return;
    }
    
    // Trim whitespace from sessionId to prevent issues
    sessionId = sessionId.trim();
    
    // Leave any previous sessions this socket was in
    for (const room of socket.rooms) {
      if (room !== socket.id) { // Don't leave the socket's own room
        socket.leave(room);
        const oldSession = sessions.get(room);
        if (oldSession) {
          oldSession.participants.delete(socket.id);
          if (oldSession.participants.size === 0) {
            sessions.delete(room);
          }
        }
      }
    }
    
    // Join the new session
    socket.join(sessionId);
    
    // Store player name with socket
    socket.playerName = playerName || 'Anonymous';
    
    // Initialize session if it doesn't exist in memory
    if (!sessions.has(sessionId)) {
      console.log(`🆕 Creating new in-memory session: "${sessionId}"`);
      sessions.set(sessionId, { 
        participants: new Set(),
        lastActivity: Date.now()
      });
      
      // Create session in database
      try {
        try {
          const existingSession = await db.getMultiplayerSession(sessionId);
          if (!existingSession) {
            await db.createMultiplayerSession(sessionId, `Multiplayer Session ${sessionId}`);
            console.log(`📊 Created new multiplayer session in database: ${sessionId}`);
          }
        } catch (sqliteError) {
          if (sqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            console.log(`📊 Session ${sessionId} already exists locally`);
        } else {
            console.error('❌ Failed to create multiplayer session in local DB:', sqliteError);
        }
      }
      } catch (error) {
        console.error('❌ Failed to create multiplayer session:', error);
      }
    } else {
      console.log(`✅ Joining existing in-memory session: "${sessionId}" (current participants: ${sessions.get(sessionId).participants.size})`);
    }
    
    const session = sessions.get(sessionId);
    if (!session) {
      console.error(`❌ CRITICAL: Session "${sessionId}" not found after creation/retrieval!`);
      socket.emit('error', { message: 'Failed to join session' });
      return;
    }
    
    // Add this socket to the session participants
    const wasAlreadyInSession = session.participants.has(socket.id);
    session.participants.add(socket.id);
    session.lastActivity = Date.now();
    
    if (wasAlreadyInSession) {
      console.log(`⚠️  Socket ${socket.id} was already in session "${sessionId}"`);
    }
    
    // Update participant count in database
    try {
      try {
        await db.updateMultiplayerParticipantCount(sessionId, session.participants.size);
      } catch (sqliteError) {
        console.error('❌ Failed to update participant count in local DB:', sqliteError);
      }
    } catch (error) {
      console.error('❌ Failed to update participant count:', error);
    }
    
    // Verify room membership
    const room = io.sockets.adapter.rooms.get(sessionId);
    const roomSize = room ? room.size : 0;
    
    console.log(`👥 User ${socket.playerName} (${socket.id}) joined session "${sessionId}"`);
    console.log(`📊 Session "${sessionId}" now has ${session.participants.size} participants (room size: ${roomSize})`);
    console.log(`🔍 All active sessions:`, Array.from(sessions.keys()));
    console.log(`🔍 Session "${sessionId}" participants:`, Array.from(session.participants));
    
    // Load previous messages from database and send to the joining user
    try {
      let previousMessages = [];
      try {
        previousMessages = await db.getMultiplayerMessages(sessionId, 100, 0);
        if (previousMessages && previousMessages.length > 0) {
          console.log(`📜 Loading ${previousMessages.length} previous messages from local DB for session ${sessionId}`);
        }
      } catch (sqliteError) {
        console.error('❌ Failed to load chat history from local DB:', sqliteError);
      }
      
      if (previousMessages && previousMessages.length > 0) {
        // Send previous messages to the joining user
        socket.emit('chat-history', {
          sessionId,
          messages: previousMessages.map(msg => ({
            text: msg.content,
            sender: msg.sender,
            timestamp: msg.timestamp,
            playerName: msg.sender,
            type: msg.message_type || 'chat',
            imageData: msg.image_data || msg.imageData,
            imageUrl: msg.image_url || msg.imageUrl,
            sessionId: sessionId
          }))
        });
      }
    } catch (error) {
      console.error('❌ Failed to load chat history:', error);
    }
    
    // Send confirmation to the joining user
    socket.emit('session-joined', {
      sessionId,
      playerName: socket.playerName,
      participantCount: session.participants.size
    });
    
    // Notify all users in the session that someone joined (including the joiner)
    io.to(sessionId).emit('user-joined', { 
      sessionId, 
      userId: socket.id,
      playerName: socket.playerName,
      participantCount: session.participants.size
    });
  });

  // Handle chat messages within a session
  socket.on('chat message', async (data) => {
    if (!data || !data.sessionId || (!data.text && !data.imageData && !data.imageUrl)) {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }
    
    const playerName = socket.playerName || data.playerName || 'Anonymous';
    
    // Verify socket is in the session
    if (!socket.rooms.has(data.sessionId)) {
      console.warn(`⚠️  Socket ${socket.id} tried to send message to session ${data.sessionId} but is not in that room`);
      socket.emit('error', { message: 'You are not in this session. Please rejoin.' });
      return;
    }
    
    // Verify session exists
    const session = sessions.get(data.sessionId);
    if (!session) {
      console.warn(`⚠️  Session ${data.sessionId} does not exist`);
      socket.emit('error', { message: 'Session does not exist' });
      return;
    }
    
    const messageType = data.type || (data.imageData || data.imageUrl ? 'image' : 'text');
    const messageText = data.text || (messageType === 'image' ? '📷 Image' : '');
    
    if (logMultiplayerMessageContent) {
      console.log(`💬 ${messageType === 'image' ? '📷 Image' : 'Message'} in session ${data.sessionId} from ${playerName} (${socket.id})${messageText && messageText.length > 0 ? ': ' + messageText.substring(0, 50) + '...' : ''}`);
      console.log(`📊 Session ${data.sessionId} has ${session.participants.size} participants:`, Array.from(session.participants));
    } else {
      const previewLen = messageText ? messageText.length : 0;
      console.log(`💬 ${messageType === 'image' ? '📷 Image' : 'Message'} in session ${data.sessionId} from ${playerName} (${socket.id}) [${messageType}, ${previewLen} chars]`);
      console.log(`📊 Session ${data.sessionId} has ${session.participants.size} participants`);
    }
    
    // Update session activity
    session.lastActivity = Date.now();
    
    // Save message to database before broadcasting (durability)
    try {
      let dbMessageType = 'chat';
      if (messageType === 'image') {
        dbMessageType = 'image';
      } else if (messageText && messageText.length > 0) {
        // Check if it's an emoji (short text with emoji characters)
        if (messageText.length <= 2 && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(messageText)) {
          dbMessageType = 'emoji';
        }
      }
      try {
        await db.addMultiplayerMessage(data.sessionId, playerName, messageText || '', dbMessageType);
      } catch (localDbError) {
        console.error('❌ Failed to save message to local DB:', localDbError);
      }
    } catch (error) {
      console.error('❌ Failed to save multiplayer message to database:', error);
    }
    
    // Prepare message object
    const messageData = {
      text: messageText,
      sender: playerName,
      timestamp: data.timestamp || new Date().toISOString(),
      playerName: playerName,
      sessionId: data.sessionId,
      type: messageType,
      imageData: data.imageData || null,
      imageUrl: data.imageUrl || null,
      imageType: data.imageType || null
    };
    
    // Broadcast message to ALL users in the session (including sender for consistency)
    // Using io.to() instead of socket.to() to ensure all participants receive it
    const room = io.sockets.adapter.rooms.get(data.sessionId);
    if (room) {
      console.log(`📤 Broadcasting ${messageType} message to ${room.size} sockets in room ${data.sessionId}`);
      io.to(data.sessionId).emit('chat message', messageData);
    } else {
      console.warn(`⚠️  Room ${data.sessionId} does not exist or is empty`);
      socket.emit('error', { message: 'No participants in session' });
    }
  });

  // Handle question asking
  socket.on('ask-question', async (data) => {
    if (!data || !data.sessionId || !data.question) {
      socket.emit('error', { message: 'Invalid question data' });
      return;
    }
    
    // Verify socket is in the session
    if (!socket.rooms.has(data.sessionId)) {
      console.warn(`⚠️  Socket ${socket.id} tried to ask question in session ${data.sessionId} but is not in that room`);
      socket.emit('error', { message: 'You are not in this session. Please rejoin.' });
      return;
    }
    
    const playerName = socket.playerName || data.playerName || 'Anonymous';
    
    if (logMultiplayerMessageContent) {
      console.log(`❓ Question asked in session ${data.sessionId} by ${playerName}: ${data.question.substring(0, 50)}...`);
    } else {
      console.log(`❓ Question asked in session ${data.sessionId} by ${playerName} (${data.question.length} chars)`);
    }
    
    // Update session activity
    const session = sessions.get(data.sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    
    // Save question to database
    try {
      try {
        await db.addMultiplayerMessage(data.sessionId, playerName, data.question, 'question');
      } catch (sqliteError) {
        console.error('❌ Failed to save question to local DB:', sqliteError);
      }
    } catch (error) {
      console.error('❌ Failed to save question to database:', error);
    }
    
    // Broadcast question to ALL users in the session (so both see it)
    const room = io.sockets.adapter.rooms.get(data.sessionId);
    if (room) {
      console.log(`📤 Broadcasting question to ${room.size} sockets in room ${data.sessionId}`);
      io.to(data.sessionId).emit('question-asked', {
      question: data.question,
        playerName: playerName,
        sessionId: data.sessionId
    });
    } else {
      console.warn(`⚠️  Room ${data.sessionId} does not exist for question`);
    }
  });

  // Handle question answers
  socket.on('question-answer', async (data) => {
    if (!data || !data.sessionId || !data.answer) {
      socket.emit('error', { message: 'Invalid answer data' });
      return;
    }
    
    const playerName = socket.playerName || data.playerName || 'Anonymous';
    
    if (logMultiplayerMessageContent) {
      console.log(`✅ Question answered in session ${data.sessionId} by ${playerName}: ${data.answer.substring(0, 50)}...`);
    } else {
      console.log(`✅ Question answered in session ${data.sessionId} by ${playerName} (${data.answer.length} chars)`);
    }
    
    // Save answer to database
    try {
      try {
        await db.addMultiplayerMessage(data.sessionId, playerName, data.answer, 'answer');
      } catch (sqliteError) {
        console.error('❌ Failed to save answer to local DB:', sqliteError);
      }
    } catch (error) {
      console.error('❌ Failed to save answer to database:', error);
    }
    
    // Send answer to all users in the session (including sender)
    io.to(data.sessionId).emit('question-answered', {
      question: data.question,
      answer: data.answer,
      sender: data.sender,
      playerName: playerName
    });
  });

  // Handle Truth or Dare spinner events
  socket.on('truth-or-dare-spin-start', (data) => {
    if (!data || !data.sessionId) {
      socket.emit('error', { message: 'Invalid spin data' });
      return;
    }
    
    // Verify socket is in the session
    if (!socket.rooms.has(data.sessionId)) {
      console.warn(`⚠️  Socket ${socket.id} tried to spin in session ${data.sessionId} but is not in that room`);
      socket.emit('error', { message: 'You are not in this session. Please rejoin.' });
      return;
    }
    
    const playerName = socket.playerName || data.playerName || 'Anonymous';
    
    console.log(`🎲 Truth or Dare spin started in session ${data.sessionId} by ${playerName}`);
    
    // Broadcast spin start to ALL users in the session
    const room = io.sockets.adapter.rooms.get(data.sessionId);
    if (room) {
      io.to(data.sessionId).emit('truth-or-dare-spin-start', {
        playerName: playerName,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('truth-or-dare-spin-result', async (data) => {
    if (!data || !data.sessionId || !data.result) {
      socket.emit('error', { message: 'Invalid spin result data' });
      return;
    }
    
    // Verify socket is in the session
    if (!socket.rooms.has(data.sessionId)) {
      console.warn(`⚠️  Socket ${socket.id} tried to send spin result in session ${data.sessionId} but is not in that room`);
      socket.emit('error', { message: 'You are not in this session. Please rejoin.' });
      return;
    }
    
    const playerName = socket.playerName || data.playerName || 'Anonymous';
    
    if (logMultiplayerMessageContent) {
      console.log(`🎲 Truth or Dare result in session ${data.sessionId} by ${playerName}: ${data.result.type} - ${data.result.content.substring(0, 50)}...`);
    } else {
      const rc = data.result.content ? data.result.content.length : 0;
      console.log(`🎲 Truth or Dare result in session ${data.sessionId} by ${playerName}: ${data.result.type} (${rc} chars)`);
    }
    
    // Update session activity
    const session = sessions.get(data.sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    
    // Save result to database and format as chat message
    const typeLabel = data.result.type === 'truth' ? 'Truth' : 'Dare';
    const difficultyEmoji = data.result.difficulty === 'easy' ? '🟢' : data.result.difficulty === 'medium' ? '🟡' : '🔴';
    const messageText = `🎲 ${typeLabel} ${difficultyEmoji}: ${data.result.content}`;
    
    try {
        try {
          await db.addMultiplayerMessage(data.sessionId, playerName, messageText, 'game');
        } catch (sqliteError) {
          console.error('❌ Failed to save game result to local DB:', sqliteError);
        }
    } catch (error) {
      console.error('❌ Failed to save spin result to database:', error);
    }
    
    // Broadcast result to ALL users in the session (so everyone sees it)
    const room = io.sockets.adapter.rooms.get(data.sessionId);
    if (room) {
      console.log(`📤 Broadcasting Truth or Dare result to ${room.size} sockets in room ${data.sessionId}`);
      
      // Emit as Truth or Dare event (for spinner UI)
      io.to(data.sessionId).emit('truth-or-dare-spin-result', {
        result: data.result,
        playerName: playerName,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString()
      });
      
      // Also emit as a chat message so it appears in chat (like number questions)
      const chatMessageData = {
        text: messageText,
        sender: playerName,
        timestamp: new Date().toISOString(),
        playerName: playerName,
        sessionId: data.sessionId,
        type: 'game'
      };
      
      io.to(data.sessionId).emit('chat message', chatMessageData);
    } else {
      console.warn(`⚠️  Room ${data.sessionId} does not exist or is empty`);
      socket.emit('error', { message: 'No participants in session' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    const playerName = socket.playerName || 'Anonymous';
    console.log(`🔌 User ${playerName} (${socket.id}) disconnected`);
    userConnections.delete(socket.id);
    monitor.updateConnectionCount(io.engine.clientsCount);
    
    // Remove user from all sessions they were in
    for (const [sessionId, sessionData] of sessions.entries()) {
      if (sessionData.participants.has(socket.id)) {
        sessionData.participants.delete(socket.id);
        console.log(`👋 User ${playerName} (${socket.id}) left session ${sessionId}`);
        
        try {
          await db.updateMultiplayerParticipantCount(sessionId, sessionData.participants.size);
        } catch (error) {
          console.error('❌ Failed to update participant count on disconnect:', error);
        }
        
        if (sessionData.participants.size === 0) {
          sessions.delete(sessionId);
          console.log(`🏁 Session ${sessionId} ended (no more participants)`);
          
          try {
            await db.deactivateMultiplayerSession(sessionId);
            console.log(`📊 Deactivated multiplayer session in database: ${sessionId}`);
          } catch (error) {
            console.error('❌ Failed to deactivate multiplayer session:', error);
          }
        } else {
          io.to(sessionId).emit('user-left', { 
            sessionId, 
            userId: socket.id,
            playerName: playerName 
          });
        }
      }
    }
  });
});

// Health check (OCI / load balancers): stable 200 unless memory critical or high 5xx rate
app.get('/health', (req, res) => {
  const health = monitor.isHealthy();
  const statusCode = health.healthy ? 200 : 503;
  const stats = monitor.getStats();
  const memoryUsage = process.memoryUsage();
  const mb = 1024 * 1024;

  const payload = {
    status: health.healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: stats.uptime,
    memory: {
      rssMb: +(memoryUsage.rss / mb).toFixed(1),
      heapUsedMb: +(memoryUsage.heapUsed / mb).toFixed(1),
      heapTotalMb: +(memoryUsage.heapTotal / mb).toFixed(1),
    },
    connections: {
      sockets: io.engine.clientsCount,
      multiplayerSessions: sessions.size,
    },
    traffic: {
      successRateSla: stats.requests.successRate,
      rawSuccessRate: stats.requests.rawSuccessRate,
      serverErrors: stats.requests.serverErrors,
      slaRequests: stats.requests.slaTotal,
    },
    checks: health,
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.environment = process.env.NODE_ENV || 'development';
    payload.version = '1.0.0';
    payload.stats = stats;
  }

  return res.status(statusCode).json(payload);
});

// JSON metrics (Prometheus text can be added later). Optional: METRICS_SECRET + Authorization: Bearer <secret>
app.get('/metrics', (req, res) => {
  const secret = process.env.METRICS_SECRET;
  if (secret) {
    const tok =
      (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, '')) ||
      req.query.token;
    if (tok !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(monitor.getMetricsPayload());
});

// Detailed stats (JWT required)
app.get('/api/stats', authenticateToken, (req, res) => {
  res.json(monitor.getStats());
});

app.get('/', (req, res) => {
  res.json({
    message: 'Lover backend',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

// API endpoint to get session info
app.get('/api/sessions/:sessionId', authenticateToken, (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  const session = sessions.get(sessionId);
  
  if (session) {
    res.json({
      sessionId,
      participantCount: session.participants.size,
      isActive: true,
      lastActivity: session.lastActivity
    });
  } else {
    res.status(404).json({
      sessionId,
      participantCount: 0,
      isActive: false
    });
  }
});

// --- AI Companion API endpoints ---

// /api/ai-companion/initialize
app.post('/api/ai-companion/initialize', authenticateToken, validateCompanionConfig, async (req, res) => {
  try {
    const companionConfig = req.sanitizedConfig;
    // Create or get companion in SQLite (legacy/local)
    let companionId;
    let sessionId;
    let conversationId;
    
    try {
      const existingCompanion = await db.getCompanionByName(companionConfig.name);
      if (existingCompanion) {
        companionId = existingCompanion.id;
        await db.updateCompanion(companionId, companionConfig);
      } else {
        companionId = await db.createCompanion(companionConfig);
      }
      // Generate session ID
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      conversationId = await db.createConversation(companionId, sessionId, `Chat with ${companionConfig.name}`);
    } catch (dbError) {
      console.warn('⚠️  Database operations failed, using fallback IDs:', dbError.message);
      // Generate fallback IDs if database operations fail
      companionId = 1;
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      conversationId = Date.now();
    }
    // Generate initial greeting with enhanced context
    const context = `You are ${companionConfig.name}, an AI companion with the following characteristics:

Personality: ${companionConfig.personality}
Identity: ${companionConfig.identity}
Gender: ${companionConfig.gender}
Role: ${companionConfig.role}

Instructions for your greeting:
- Introduce yourself as ${companionConfig.name}
- Express genuine excitement about being their companion
- Keep it warm, personal, and authentic (2-3 sentences maximum)
- Show your unique personality based on the characteristics above
- Be conversational and natural, not robotic
- Ask an engaging question to start the conversation

Generate a welcoming first message:`;
    if (!isGeminiAvailable()) {
      throw new Error('AI model not initialized');
    }
    
    let retries = 3;
    let greeting = null;
    while (retries > 0 && !greeting) {
      try {
        greeting = await geminiGenerateText(context);
      } catch (apiError) {
        retries--;
        if (retries === 0) throw apiError;
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    if (greeting) {
      try {
        await db.addMessage(conversationId, 'ai', greeting, 'welcoming');
      } catch (dbError) {
        console.warn('⚠️  Database write failed, continuing without saving greeting:', dbError.message);
      }
      
      res.json({
        greeting,
        companionName: companionConfig.name,
        sessionId,
        conversationId,
        timestamp: new Date()
      });
    } else {
      throw new Error('Failed to get greeting after all retries');
    }
  } catch (error) {
    console.error('❌ AI Companion initialization error:', error.message);
    // Enhanced fallback greeting
    const companionName = req.sanitizedConfig?.name || 'your companion';
    const personality = req.sanitizedConfig?.personality || 'caring and supportive';
    const fallbackGreeting = `Hello! I'm ${companionName}, your AI companion. I'm ${personality} and I'm excited to be here with you today. What would you like to talk about?`;
    res.status(500).json({ 
      error: 'Failed to initialize companion',
      greeting: fallbackGreeting,
      retryAfter: '30 seconds'
    });
  }
});

// /api/ai-companion/chat
app.post('/api/ai-companion/chat', authenticateToken, validateMessage, validateCompanionConfig, async (req, res) => {
  try {
    const { sessionId, conversationId } = req.body;
    const message = req.sanitizedMessage;
    const companionConfig = req.sanitizedConfig;
    let conversation = null;
    if (sessionId) {
      conversation = await db.getConversation(sessionId);
    } else if (conversationId) {
      conversation = await db.getConversationById(parseInt(conversationId));
    }
    if (!conversation) {
      try {
        const existing = await db.getCompanionByName(companionConfig.name);
        let companionId = existing?.id;
        if (!companionId) {
          companionId = await db.createCompanion(companionConfig);
        }
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newConversationId = await db.createConversation(companionId, newSessionId, `Chat with ${companionConfig.name}`);
        conversation = await db.getConversationById(newConversationId);
      } catch (dbError) {
        console.warn('⚠️  Database conversation creation failed, using fallback:', dbError.message);
        // Create fallback conversation object
        conversation = {
          id: Date.now(),
          session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: `Chat with ${companionConfig.name}`
        };
      }
    }
    try {
      await db.addMessage(conversation.id, 'user', message, 'neutral');
    } catch (dbError) {
      console.warn('⚠️  Database write failed, continuing without saving message:', dbError.message);
    }
    let conversationContext = '';
    try {
      const recentMessages = await db.getRecentMessages(conversation.id, 10);
      conversationContext = recentMessages.map(msg => `${msg.sender}: ${msg.content}`).join('\n');
    } catch (dbError) {
      console.warn('⚠️  Database history retrieval failed, using empty context:', dbError.message);
      conversationContext = '';
    }
    // Create enhanced context for the AI
    const context = `You are ${companionConfig.name}, an AI companion with the following characteristics:

Personality: ${companionConfig.personality}
Identity: ${companionConfig.identity}
Gender: ${companionConfig.gender}
Role: ${companionConfig.role}

Core Guidelines:
- Stay in character as ${companionConfig.name} at all times
- Be empathetic, supportive, and authentic in your responses
- Keep responses concise and engaging (1-3 sentences unless user asks for more)
- Show your unique personality based on the characteristics above
- Be conversational and natural, not robotic or generic
- Ask follow-up questions when appropriate to keep the conversation flowing
- Respond to the user's emotions and needs
- Don't give generic responses like "I'm here to listen" - be specific and personal

Previous conversation context:
${conversationContext}

User's message: ${message}

Respond as ${companionConfig.name} with a personal, engaging response:`;
    
    if (!isGeminiAvailable()) {
      throw new Error('AI model not initialized');
    }
    
    let retries = 3;
    let aiResponse = null;
    while (retries > 0 && !aiResponse) {
      try {
        aiResponse = await geminiGenerateText(context);
      } catch (apiError) {
        retries--;
        if (retries === 0) throw apiError;
        const delay = Math.pow(2, 3 - retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    if (aiResponse) {
      try {
        await db.addMessage(conversation.id, 'ai', aiResponse, 'responsive');
      } catch (dbError) {
        console.warn('⚠️  Database write failed, continuing without saving AI response:', dbError.message);
      }
      
      res.json({
        message: aiResponse,
        companionName: companionConfig.name,
        sessionId: sessionId || conversation.session_id,
        conversationId: conversationId || conversation.id,
        timestamp: new Date()
      });
    } else {
      throw new Error('Failed to get response after all retries');
    }
  } catch (error) {
    console.error('❌ AI Companion chat error:', error.message);
    // Enhanced fallback response
    const companionName = req.sanitizedConfig?.name || 'your companion';
    const personality = req.sanitizedConfig?.personality || 'caring';
    
    let fallbackResponse = "I'm here for you! What's on your mind?";
    
    // Context-aware fallback responses (use req.sanitizedMessage)
    const userMessage = req.sanitizedMessage || '';
    if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
      fallbackResponse = `Hi there! I'm ${companionName} and I'm ${personality}. How are you feeling today?`;
    } else if (userMessage.toLowerCase().includes('how are you')) {
      fallbackResponse = `I'm doing great, thank you for asking! I'm here and ready to chat with you. How about you?`;
    } else if (userMessage.toLowerCase().includes('thank')) {
      fallbackResponse = `You're very welcome! I'm here for you whenever you need to talk.`;
    } else if (userMessage.toLowerCase().includes('bye') || userMessage.toLowerCase().includes('goodbye')) {
      fallbackResponse = `Take care! I'll be here when you want to chat again.`;
    }
    
    res.status(500).json({ 
      error: 'Failed to get AI response', 
      message: fallbackResponse,
      retryAfter: '30 seconds' 
    });
  }
});

// Database and conversation management endpoints
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { companion_id, limit = 20, offset = 0 } = req.query;
    const conversations = await db.getConversations(
      companion_id ? parseInt(companion_id) : null,
      parseInt(limit),
      parseInt(offset)
    );
    
    res.json({
      conversations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: conversations.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    monitor.logError(error, { endpoint: '/api/conversations' });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.get('/api/conversations/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search term is required' });
    }
    
    const conversations = await db.searchConversations(q.trim(), parseInt(limit));
    res.json({ conversations, searchTerm: q });
  } catch (error) {
    console.error('❌ Error searching conversations:', error);
    monitor.logError(error, { endpoint: '/api/conversations/search' });
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

app.get('/api/conversations/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const conversation = await db.getConversation(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const messages = await db.getMessages(conversation.id);
    const companion = await db.getCompanion(conversation.companion_id);
    
    res.json({
      conversation: {
        sessionId: conversation.session_id,
        companionConfig: companion,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at
      },
      messages: messages.map(msg => ({
        sender: msg.sender,
        content: msg.content,
        emotion: msg.emotion,
        timestamp: msg.timestamp
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

app.get('/api/conversations/:conversationId/export', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const exportData = await db.exportConversation(parseInt(conversationId));
    
    if (!exportData) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    res.json(exportData);
  } catch (error) {
    console.error('❌ Error exporting conversation:', error);
    monitor.logError(error, { endpoint: '/api/conversations/:conversationId/export' });
    res.status(500).json({ error: 'Failed to export conversation' });
  }
});

app.put('/api/conversations/:conversationId/title', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    await db.updateConversationTitle(parseInt(conversationId), title.trim());
    res.json({ message: 'Title updated successfully' });
  } catch (error) {
    console.error('❌ Error updating conversation title:', error);
    monitor.logError(error, { endpoint: '/api/conversations/:conversationId/title' });
    res.status(500).json({ error: 'Failed to update title' });
  }
});

app.delete('/api/conversations/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    await db.deactivateConversation(sessionId);
    res.json({ message: 'Conversation deactivated successfully' });
  } catch (error) {
    console.error('❌ Error deactivating conversation:', error);
    monitor.logError(error, { endpoint: '/api/conversations/:sessionId' });
    res.status(500).json({ error: 'Failed to deactivate conversation' });
  }
});

// Statistics endpoints
app.get('/api/stats/conversations', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getConversationStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching conversation stats:', error);
    monitor.logError(error, { endpoint: '/api/stats/conversations' });
    res.status(500).json({ error: 'Failed to fetch conversation stats' });
  }
});

app.get('/api/stats/messages', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getMessageStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching message stats:', error);
    monitor.logError(error, { endpoint: '/api/stats/messages' });
    res.status(500).json({ error: 'Failed to fetch message stats' });
  }
});

app.get('/api/stats/companions', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getCompanionStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching companion stats:', error);
    monitor.logError(error, { endpoint: '/api/stats/companions' });
    res.status(500).json({ error: 'Failed to fetch companion stats' });
  }
});

// Database maintenance (requires MAINTENANCE_SECRET + X-Maintenance-Key in production)
app.post('/api/maintenance/cleanup', requireMaintenanceKey, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    const result = await db.cleanupOldConversations(parseInt(daysOld));
    res.json({ 
      message: 'Cleanup completed successfully',
      deletedCount: result.changes
    });
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    monitor.logError(error, { endpoint: '/api/maintenance/cleanup' });
    res.status(500).json({ error: 'Failed to perform cleanup' });
  }
});

app.get('/api/maintenance/size', requireMaintenanceKey, async (req, res) => {
  try {
    const size = await db.getDatabaseSize();
    res.json({ 
      sizeBytes: size,
      sizeMB: (size / 1024 / 1024).toFixed(2)
    });
  } catch (error) {
    console.error('❌ Error getting database size:', error);
    monitor.logError(error, { endpoint: '/api/maintenance/size' });
    res.status(500).json({ error: 'Failed to get database size' });
  }
});

// Multiplayer API endpoints
app.get('/api/multiplayer/sessions', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0, activeOnly = 'false' } = req.query;
    const sessionsList = await db.getMultiplayerSessions(parseInt(limit), parseInt(offset));
    
    // Filter active sessions if requested
    let filteredSessions = sessionsList;
    if (activeOnly === 'true') {
      filteredSessions = sessionsList.filter(s => s.is_active === 1 || s.is_active === true);
    }
    
    // Enrich with real-time participant count from in-memory sessions
    const enrichedSessions = filteredSessions.map(session => {
      const inMemorySession = sessions.get(session.session_id);
      return {
        ...session,
        currentParticipants: inMemorySession ? inMemorySession.participants.size : 0
      };
    });
    
    res.json({
      sessions: enrichedSessions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: enrichedSessions.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching multiplayer sessions:', error);
    monitor.logError(error, { endpoint: '/api/multiplayer/sessions' });
    res.status(500).json({ error: 'Failed to fetch multiplayer sessions' });
  }
});

// Create a named multiplayer session
app.post('/api/multiplayer/sessions', authenticateToken, async (req, res) => {
  try {
    const { title, sessionId } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Session title is required' });
    }
    
    // Generate session ID if not provided
    const finalSessionId = sessionId || (() => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6);
      return `${timestamp}${random}`.toUpperCase();
    })();
    
    // Create session in database
    try {
      await db.createMultiplayerSession(finalSessionId, title.trim());
      console.log(`📊 Created named multiplayer session: ${finalSessionId} - ${title.trim()}`);
      
      res.status(201).json({
        sessionId: finalSessionId,
        title: title.trim(),
        message: 'Session created successfully'
      });
    } catch (error) {
      if (error.message === 'Session already exists and is active') {
        return res.status(409).json({ error: 'Session ID already exists' });
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Error creating multiplayer session:', error);
    monitor.logError(error, { endpoint: 'POST /api/multiplayer/sessions' });
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/api/multiplayer/sessions/search', authenticateToken, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search term is required' });
    }
    
    const sessions = await db.searchMultiplayerSessions(q.trim(), parseInt(limit));
    res.json({ sessions, searchTerm: q });
  } catch (error) {
    console.error('❌ Error searching multiplayer sessions:', error);
    monitor.logError(error, { endpoint: '/api/multiplayer/sessions/search' });
    res.status(500).json({ error: 'Failed to search multiplayer sessions' });
  }
});

app.get('/api/multiplayer/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await db.getMultiplayerSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Multiplayer session not found' });
    }
    
    const messages = await db.getMultiplayerMessages(sessionId);
    res.json({ session, messages });
  } catch (error) {
    console.error('❌ Error fetching multiplayer session:', error);
    monitor.logError(error, { endpoint: '/api/multiplayer/sessions/:sessionId' });
    res.status(500).json({ error: 'Failed to fetch multiplayer session' });
  }
});

app.get('/api/multiplayer/sessions/:sessionId/export', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const exportData = await db.exportMultiplayerSession(sessionId);
    
    if (!exportData) {
      return res.status(404).json({ error: 'Multiplayer session not found' });
    }
    
    res.json(exportData);
  } catch (error) {
    console.error('❌ Error exporting multiplayer session:', error);
    monitor.logError(error, { endpoint: '/api/multiplayer/sessions/:sessionId/export' });
    res.status(500).json({ error: 'Failed to export multiplayer session' });
  }
});

app.delete('/api/multiplayer/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    await db.deactivateMultiplayerSession(sessionId);
    res.json({ message: 'Multiplayer session deactivated successfully' });
  } catch (error) {
    console.error('❌ Error deactivating multiplayer session:', error);
    monitor.logError(error, { endpoint: '/api/multiplayer/sessions/:sessionId' });
    res.status(500).json({ error: 'Failed to deactivate multiplayer session' });
  }
});

// Multiplayer statistics
app.get('/api/stats/multiplayer', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getMultiplayerStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching multiplayer stats:', error);
    monitor.logError(error, { endpoint: '/api/stats/multiplayer' });
    res.status(500).json({ error: 'Failed to fetch multiplayer stats' });
  }
});

app.get('/api/stats/multiplayer-messages', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getMultiplayerMessageStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching multiplayer message stats:', error);
    monitor.logError(error, { endpoint: '/api/stats/multiplayer-messages' });
    res.status(500).json({ error: 'Failed to fetch multiplayer message stats' });
  }
});

const JWT_SECRET = process.env.JWT_SECRET;

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingByUsername = await User.findOne({ username });
    const existingByEmail = await User.findOne({ email });
    if (existingByUsername || existingByEmail) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: passwordHash });

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    monitor.logError(error, { endpoint: '/api/auth/register' });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Allow login by username OR email
    let userByUsername = null;
    let userByEmail = null;
    let usedDbFallback = false;

    try {
      userByUsername = await User.findOne({ username });
      userByEmail = userByUsername ? null : await User.findOne({ email: username });
    } catch (e) {
      // If the primary user lookup throws, fall back to DatabaseManager.
      usedDbFallback = true;
      console.warn('⚠️  Primary user lookup failed; falling back to local DB:', e?.message || e);
    }

    let user = userByUsername || userByEmail;

    // If primary lookup returned null, fall back to local DB lookup.
    if (!user) {
      usedDbFallback = true;
      const rowByUsername = await db.getUserByUsername(username);
      const rowByEmail = rowByUsername ? null : await db.getUserByEmail(username);
      const row = rowByUsername || rowByEmail;

      if (row) {
        console.warn('⚠️  Using SQLite/Postgres auth fallback for login:', { identifier: username });
        user = {
          id: row.id,
          username: row.username,
          email: row.email,
          password: row.password_hash,
          createdAt: row.created_at,
          lastLogin: row.last_login,
          isActive: true,
        };
      }
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(401).json({ error: 'Invalid credentials' });

    if (usedDbFallback) {
      await db.updateUserLastLogin(user.id);
    } else {
      await User.updateLastLogin(user.id);
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, lastLogin: new Date() },
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    monitor.logError(error, { endpoint: '/api/auth/login' });
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get Current User Profile (requires authentication)
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const row = await db.getUserById(userId);
    if (!row) return res.status(404).json({ error: 'User not found' });

    return res.json({
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        createdAt: row.created_at,
        lastLogin: row.last_login,
      },
    });

  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    monitor.logError(error, { endpoint: '/api/auth/profile' });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get Current User (token validation only - no authentication required)
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      try {
        // Token validation only: return decoded token info
        return res.json({
          user: {
            id: decoded.userId,
            username: decoded.username,
            email: `${decoded.username}@example.com`,
            createdAt: new Date(),
            lastLogin: new Date()
          }
        });

      } catch (error) {
        console.error('❌ User fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch user' });
      }
    });

  } catch (error) {
    console.error('❌ Auth check error:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
});

// Update User Profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if new username/email already exists
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
      }
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    await db.updateUserProfile(req.user.userId, { username, email });
    const updated = await db.getUserById(req.user.userId);
    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        createdAt: updated.created_at,
        lastLogin: updated.last_login,
      }
    });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    monitor.logError(error, { endpoint: '/api/auth/profile' });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change Password
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password and update in local DB
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await db.updateUserPassword(req.user.userId, hashedPassword);

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('❌ Password change error:', error);
    monitor.logError(error, { endpoint: '/api/auth/password' });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Logout (client-side token removal)
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach(function (r) {
      if (r.route && r.route.path) {
        routes.push(`${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`);
      }
    });
    res.json({ routes });
  });
}

// 404 handler — must stay before error middleware
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found.',
  });
});

// Global error handler (must be last middleware; requires express-async-errors for thrown async errors)
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('💥 Unhandled error:', err?.stack || err);
  monitor.logError(err instanceof Error ? err : new Error(String(err)), {
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    requestId: req.requestId,
  });

  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong. Please try again later.',
    requestId: req.requestId,
    ...(isDevelopment && err instanceof Error && { details: err.message }),
  });
});

let shuttingDown = false;

const gracefulShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`🛑 ${signal} received, shutting down gracefully...`);

  try {
    monitor.stop();
  } catch (e) {
    console.error('monitor.stop failed:', e);
  }
  clearInterval(sessionCleanupInterval);

  io.disconnectSockets(true);
  io.close(() => {
    server.close((closeErr) => {
      if (closeErr) {
        console.error('❌ HTTP server close error:', closeErr);
      } else {
        console.log('✅ HTTP server closed');
      }
      db.close()
        .then(() => {
          console.log('✅ Database connections closed');
          process.exit(0);
        })
        .catch((err) => {
          console.error('❌ Error closing database:', err);
          process.exit(1);
        });
    });
  });

  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 30000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('💥 Unhandled Rejection:', err?.message || err, promise);
  monitor.logError(err, { source: 'unhandledRejection' });
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  monitor.logError(error, { source: 'uncaughtException' });
  try {
    monitor.stop();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Lover's Code server listening on http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`🤖 AI Model: ${isGeminiAvailable() ? 'Available' : 'Not Available'}`);
  console.log(
    `⏱️ HTTP requestTimeout=${server.requestTimeout}ms keepAliveTimeout=${server.keepAliveTimeout}ms`,
  );
  console.log(`✅ Server is ready to accept connections!`);
}).on('error', (error) => {
  console.error('❌ Server failed to start:', error);
  process.exit(1);
});
