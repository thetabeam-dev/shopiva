// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

module.exports = {
  apps: [
    {
      name: 'deedyte-backend',
      script: 'dist/index.js',
      interpreter: '/root/.bun/bin/bun',
      autorestart: true,
      watch: true,
      ignore_watch: ['node_modules', '*.d.ts', '*.log'],
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        COOKIE_SECRET: process.env.COOKIE_SECRET,
        PORT: process.env.PORT,
        
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
      },
      env_development: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        watch: ['dist'],
      },
      env_local: {
        NODE_ENV: process.env.NODE_ENV || 'local',
        watch: ['src'],
      },
    },
  ],
};
