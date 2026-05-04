module.exports = {
  apps: [
    {
      name: 'meeting-backend',
      cwd: '/var/www/meeting-backend',
      script: 'src/server.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
  ],
};
