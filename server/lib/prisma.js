// Single shared Prisma client (creating one per route file exhausts DB connections)
const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
