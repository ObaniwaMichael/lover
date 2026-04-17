/**
 * PM2 process file for Oracle Cloud / long-running VPS.
 *
 * Install: npm i -g pm2
 * Start:   pm2 start ecosystem.config.cjs
 * Logs:   pm2 logs lovers-backend
 *
 * Socket.IO in this app does not use Redis sticky sessions — use **instances: 1**
 * (fork). To scale horizontally, add @socket.io/redis-adapter and then raise instances.
 *
 * Log rotation (prevents disk fill over months):
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 10M
 *   pm2 set pm2-logrotate:retain 30
 *   pm2 set pm2-logrotate:compress true
 */
module.exports = {
  apps: [
    {
      name: 'lovers-backend',
      cwd: __dirname,
      script: 'server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 100,
      min_uptime: '10s',
      restart_delay: 4000,
      max_memory_restart: '300M',
      listen_timeout: 15000,
      kill_timeout: 20000,
      wait_ready: false,
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
