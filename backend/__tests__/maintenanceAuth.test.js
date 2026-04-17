import { describe, it, expect, afterEach, vi } from 'vitest';
import { requireMaintenanceKey } from '../middleware/maintenanceAuth.js';

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('requireMaintenanceKey', () => {
  afterEach(() => {
    delete process.env.MAINTENANCE_SECRET;
    delete process.env.NODE_ENV;
    requireMaintenanceKey._warnedDev = false;
  });

  it('allows in development when MAINTENANCE_SECRET is unset', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.NODE_ENV = 'development';
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    requireMaintenanceKey(req, res, next);
    expect(next).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns 503 in production when MAINTENANCE_SECRET is unset', () => {
    process.env.NODE_ENV = 'production';
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    requireMaintenanceKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows in production when key matches', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAINTENANCE_SECRET = 'secret-value';
    const req = { headers: { 'x-maintenance-key': 'secret-value' } };
    const res = mockRes();
    const next = vi.fn();
    requireMaintenanceKey(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects wrong key', () => {
    process.env.NODE_ENV = 'production';
    process.env.MAINTENANCE_SECRET = 'secret-value';
    const req = { headers: { 'x-maintenance-key': 'wrong' } };
    const res = mockRes();
    const next = vi.fn();
    requireMaintenanceKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
