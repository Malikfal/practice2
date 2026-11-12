module.exports = {
  apps: [
    {
      name: 'erp-backend-a',
      script: 'dist/src/index.js',
      exec_mode: 'fork',
      instances: 1,
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: 'production',
        ENV: 'prod',
        PORT: 3001,
      },
    },
    {
      name: 'erp-backend-b',
      script: 'dist/src/index.js',
      exec_mode: 'fork',
      instances: 1,
      wait_ready: true,
      listen_timeout: 15000,
      kill_timeout: 15000,
      env: {
        NODE_ENV: 'production',
        ENV: 'prod',
        PORT: 3002,
      },
    },
  ],
};
