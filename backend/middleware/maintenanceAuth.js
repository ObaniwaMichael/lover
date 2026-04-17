import crypto from 'crypto';

/**
 * Protects destructive / operational routes. In production, MAINTENANCE_SECRET must
 * be set or these routes return 503. Clients send `X-Maintenance-Key: <secret>`.
 * In development, if MAINTENANCE_SECRET is unset, routes are allowed (with one warning).
 */
export function requireMaintenanceKey(req, res, next) {
  const secret = process.env.MAINTENANCE_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProd) {
      return res.status(503).json({
        error: 'Maintenance API disabled',
        detail: 'Set MAINTENANCE_SECRET in the server environment to enable.',
      });
    }
    if (!requireMaintenanceKey._warnedDev) {
      requireMaintenanceKey._warnedDev = true;
      console.warn(
        '⚠️  MAINTENANCE_SECRET is not set — maintenance routes are open in development only.',
      );
    }
    return next();
  }

  const provided = req.headers['x-maintenance-key'];

  if (typeof provided !== 'string' || provided.length === 0) {
    return res.status(401).json({ error: 'Missing X-Maintenance-Key header' });
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Invalid maintenance key' });
  }

  next();
}
