// server/server.js
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to server/.env before starting the server.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to server/.env before starting the server.');
  process.exit(1);
}

const createApp = require('./app');
const prisma = require('./lib/prisma');

const app = createApp();
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown so in-flight click writes finish and DB connections close
async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
