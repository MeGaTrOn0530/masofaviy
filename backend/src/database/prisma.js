import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { createFileStoreClient } from './file-store.client.js';

// Prisma datasource env("DATABASE_URL") ni bevosita process.env dan o'qiydi.
// .env bo'lmasa ham local default URL shu yerda beriladi.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.databaseUrl;
}

const primaryClient = new PrismaClient();
const fallbackClient = createFileStoreClient();

let activeClient = primaryClient;
let fallbackActivated = false;

const bindMember = (member) => (typeof member === 'function' ? member.bind(activeClient) : member);

export const prisma = new Proxy({}, {
  get(target, property) {
    void target;
    return bindMember(activeClient[property]);
  },
});

export const connectDatabase = async () => {
  try {
    await primaryClient.$connect();
    activeClient = primaryClient;
    fallbackActivated = false;
    return {
      mode: 'prisma',
    };
  } catch (error) {
    if (!env.devFileStoreFallback) {
      throw error;
    }

    await fallbackClient.$connect();
    activeClient = fallbackClient;
    fallbackActivated = true;
    return {
      mode: 'file-store',
      error,
    };
  }
};

export const isUsingFallbackStore = () => fallbackActivated;
