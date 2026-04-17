import fs from 'fs';
import path from 'path';

const MB = 1024 * 1024;

/**
 * Production monitoring: bounded buffers, SLA-aware success metrics,
 * memory sampling (not on every /health hit), and optional heap alerts.
 */
class ServerMonitor {
  constructor() {
    this.stats = {
      startTime: Date.now(),
      totalRequests: 0,
      /** Counted toward SLA (excludes OPTIONS + probe paths). */
      slaRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      /** 5xx only — used for health / alerts (avoids 401/404/429 skewing “uptime”). */
      serverErrors: 0,
      clientErrors: 0,
      redirects: 0,
      /** Skipped for SLA denominator (OPTIONS, GET /health, HEAD /health). */
      excludedFromSla: 0,
      /** All traffic — for dashboards. */
      responses2xx: 0,
      responses3xx: 0,
      responses4xx: 0,
      responses5xx: 0,
      aiRequests: 0,
      aiFailures: 0,
      activeConnections: 0,
      peakConnections: 0,
      memoryUsage: [],
      responseTimes: [],
      errors: [],
      /** Last N route failures for debugging (status, path, method). */
      recentFailures: [],
    };

    this.logDir = process.env.LOG_DIR || './logs';
    this.ensureLogDirectory();

    /** Max heap (RSS is noisier) before alert — default 384 MB. */
    this.heapAlertBytes =
      (Number(process.env.MEMORY_ALERT_HEAP_MB || 384) || 384) * MB;

    this._intervals = [];
    this.startPeriodicLogging();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _shouldExcludeFromSla(req) {
    const p = req.path || req.url?.split('?')[0] || '';
    if (req.method === 'OPTIONS' || req.method === 'HEAD') return true;
    if (p === '/health' || p === '/metrics') return true;
    return false;
  }

  _pushBounded(arr, item, maxLen) {
    arr.push(item);
    if (arr.length > maxLen) {
      arr.splice(0, arr.length - maxLen);
    }
  }

  logRequest(req, res, duration) {
    const code = res.statusCode;
    const exclude = this._shouldExcludeFromSla(req);

    this.stats.totalRequests++;

    if (code >= 500) this.stats.responses5xx++;
    else if (code >= 400) this.stats.responses4xx++;
    else if (code >= 300) this.stats.responses3xx++;
    else this.stats.responses2xx++;

    if (exclude) {
      this.stats.excludedFromSla++;
    } else {
      this.stats.slaRequests++;
    }

    if (code >= 500) {
      this.stats.serverErrors++;
      if (!exclude) this.stats.failedRequests++;
      this._pushBounded(
        this.stats.recentFailures,
        {
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          statusCode: code,
        },
        50,
      );
    } else if (code >= 400) {
      this.stats.clientErrors++;
      if (!exclude) this.stats.failedRequests++;
      this._pushBounded(
        this.stats.recentFailures,
        {
          timestamp: new Date().toISOString(),
          method: req.method,
          path: req.path,
          statusCode: code,
        },
        50,
      );
    } else if (code >= 300) {
      this.stats.redirects++;
      if (!exclude) this.stats.successfulRequests++;
    } else {
      if (!exclude) this.stats.successfulRequests++;
    }

    this._pushBounded(this.stats.responseTimes, duration, 1000);

    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: code,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    };

    this.writeToLog('requests.log', logEntry);
  }

  logAIRequest(success, duration, error = null) {
    this.stats.aiRequests++;

    if (!success) {
      this.stats.aiFailures++;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      success,
      duration,
      error: error ? error.message : null,
    };

    this.writeToLog('ai-requests.log', logEntry);
  }

  logError(error, context = {}) {
    this._pushBounded(
      this.stats.errors,
      {
        timestamp: new Date().toISOString(),
        message: error?.message || String(error),
        stack: error?.stack,
        context,
      },
      100,
    );

    this.writeToLog('errors.log', {
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack,
      context,
    });
  }

  updateConnectionCount(count) {
    this.stats.activeConnections = count;
    if (count > this.stats.peakConnections) {
      this.stats.peakConnections = count;
    }
  }

  /** Call on a timer only — avoids growing arrays on every /health poll. */
  recordMemorySample() {
    const memoryUsage = process.memoryUsage();
    this._pushBounded(
      this.stats.memoryUsage,
      { timestamp: Date.now(), ...memoryUsage },
      100,
    );

    if (memoryUsage.heapUsed > this.heapAlertBytes) {
      const msg = `[MEMORY_ALERT] heapUsed=${(memoryUsage.heapUsed / MB).toFixed(
        1,
      )}MB threshold=${(this.heapAlertBytes / MB).toFixed(0)}MB rss=${(memoryUsage.rss / MB).toFixed(1)}MB`;
      console.error(msg);
      this.writeToLog('alerts.log', {
        type: 'memory_heap',
        timestamp: new Date().toISOString(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        threshold: this.heapAlertBytes,
      });
    }
  }

  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const avgResponseTime =
      this.stats.responseTimes.length > 0
        ? this.stats.responseTimes.reduce((a, b) => a + b, 0) /
          this.stats.responseTimes.length
        : 0;

    const memoryUsage = process.memoryUsage();
    const slaTotal = this.stats.slaRequests;
    const slaSuccess = this.stats.successfulRequests;
    const rawTotal = this.stats.totalRequests;
    const okAll = this.stats.responses2xx + this.stats.responses3xx;

    return {
      uptime: {
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 60000),
        hours: Math.floor(uptime / 3600000),
        days: Math.floor(uptime / 86400000),
      },
      requests: {
        total: rawTotal,
        slaTotal,
        excludedFromSla: this.stats.excludedFromSla,
        successful: slaSuccess,
        failed: this.stats.failedRequests,
        serverErrors: this.stats.serverErrors,
        clientErrors: this.stats.clientErrors,
        redirects: this.stats.redirects,
        /** Primary KPI: 2xx/3xx for non-probe traffic (matches “real” API success). */
        successRate:
          slaTotal > 0
            ? ((slaSuccess / slaTotal) * 100).toFixed(2) + '%'
            : 'n/a',
        /** Share of all requests that returned 2xx or 3xx (includes probes). */
        rawSuccessRate:
          rawTotal > 0 ? ((okAll / rawTotal) * 100).toFixed(2) + '%' : 'n/a',
        responses2xx: this.stats.responses2xx,
        responses3xx: this.stats.responses3xx,
        responses4xx: this.stats.responses4xx,
        responses5xx: this.stats.responses5xx,
      },
      ai: {
        total: this.stats.aiRequests,
        failures: this.stats.aiFailures,
        successRate:
          this.stats.aiRequests > 0
            ? (
                ((this.stats.aiRequests - this.stats.aiFailures) / this.stats.aiRequests) *
                100
              ).toFixed(2) + '%'
            : '0%',
      },
      connections: {
        current: this.stats.activeConnections,
        peak: this.stats.peakConnections,
      },
      performance: {
        avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
        memoryUsage: {
          rss: (memoryUsage.rss / MB).toFixed(2) + 'MB',
          heapUsed: (memoryUsage.heapUsed / MB).toFixed(2) + 'MB',
          heapTotal: (memoryUsage.heapTotal / MB).toFixed(2) + 'MB',
        },
      },
      errors: {
        count: this.stats.errors.length,
        recent: this.stats.errors.slice(-5),
      },
      recentFailures: this.stats.recentFailures.slice(-10),
    };
  }

  /** Prometheus-friendly counters (text exposition can be added later). */
  getMetricsPayload() {
    const m = process.memoryUsage();
    const s = this.stats;
    const uptimeSec = Math.floor((Date.now() - s.startTime) / 1000);
    return {
      process_uptime_seconds: uptimeSec,
      http_requests_total: s.totalRequests,
      http_requests_sla_total: s.slaRequests,
      http_requests_success_sla: s.successfulRequests,
      http_requests_client_errors: s.clientErrors,
      http_requests_server_errors: s.serverErrors,
      http_requests_excluded_sla: s.excludedFromSla,
      ai_requests_total: s.aiRequests,
      ai_requests_failed: s.aiFailures,
      socket_connections_current: s.activeConnections,
      socket_connections_peak: s.peakConnections,
      process_resident_memory_bytes: m.rss,
      process_heap_used_bytes: m.heapUsed,
      process_heap_total_bytes: m.heapTotal,
      process_external_bytes: m.external,
    };
  }

  writeToLog(filename, data) {
    const logPath = path.join(this.logDir, filename);
    const logLine = JSON.stringify(data) + '\n';

    fs.appendFile(logPath, logLine, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err);
      }
    });
  }

  startPeriodicLogging() {
    const statsMs = Number(process.env.STATS_LOG_INTERVAL_MS || 5 * 60 * 1000);
    const cleanupMs = 24 * 60 * 60 * 1000;

    this._intervals.push(
      setInterval(() => {
        this.recordMemorySample();
        const stats = this.getStats();
        const logEntry = {
          timestamp: new Date().toISOString(),
          type: 'periodic_stats',
          stats,
        };

        this.writeToLog('server-stats.log', logEntry);
        console.log('📊 Server Stats:', {
          uptime: stats.uptime,
          requests: stats.requests.successRate,
          requestsSlaN: stats.requests.slaTotal,
          serverErrors: stats.requests.serverErrors,
          ai: stats.ai.successRate,
          connections: stats.connections.current,
          memory: stats.performance.memoryUsage.heapUsed,
        });
      }, statsMs),
    );

    this._intervals.push(
      setInterval(() => {
        this.cleanupOldLogs();
      }, cleanupMs),
    );
  }

  stop() {
    for (const id of this._intervals) {
      clearInterval(id);
    }
    this._intervals.length = 0;
  }

  cleanupOldLogs() {
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    fs.readdir(this.logDir, (err, files) => {
      if (err) {
        console.error('Failed to read log directory:', err);
        return;
      }

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        fs.stat(filePath, (statErr, stats) => {
          if (statErr) return;

          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlink(filePath, (unlinkErr) => {
              if (unlinkErr) {
                console.error('Failed to delete old log file:', unlinkErr);
              } else {
                console.log('🧹 Deleted old log file:', file);
              }
            });
          }
        });
      }
    });
  }

  /**
   * OCI / load balancer: unhealthy only on critical process issues,
   * not on 4xx volume (which was falsely tripping at ~20% “error rate”).
   */
  isHealthy() {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.rss / MB;
    const heapMB = memoryUsage.heapUsed / MB;

    const total = this.stats.totalRequests;
    const serverErrorRate =
      total > 0 ? (this.stats.serverErrors / total) * 100 : 0;

    const aiFailureRate =
      this.stats.aiRequests > 0
        ? (this.stats.aiFailures / this.stats.aiRequests) * 100
        : 0;

    const memHardFailMb = Number(process.env.HEALTH_MEMORY_LIMIT_MB || 1536) || 1536;

    const issues = {
      highMemory: memoryUsageMB >= memHardFailMb,
      highServerErrorRate: serverErrorRate >= 5 && total >= 50,
      highAIFailureRate: aiFailureRate >= 50 && this.stats.aiRequests >= 10,
    };

    const healthy =
      !issues.highMemory && !issues.highServerErrorRate && !issues.highAIFailureRate;

    return {
      healthy,
      issues,
      metrics: {
        memoryUsageMB: memoryUsageMB.toFixed(2),
        heapUsedMB: heapMB.toFixed(2),
        serverErrorRate: serverErrorRate.toFixed(2) + '%',
        aiFailureRate: aiFailureRate.toFixed(2) + '%',
      },
    };
  }
}

export default ServerMonitor;
