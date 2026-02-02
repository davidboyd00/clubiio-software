import { vi } from 'vitest';

// Mock Prisma
vi.mock('../common/database', () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    venue: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    cashSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn({
      tenant: { create: vi.fn() },
      user: { create: vi.fn() },
      venue: { create: vi.fn() },
      userVenue: { create: vi.fn() },
      order: { create: vi.fn() },
    })),
  },
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock Socket.io
vi.mock('../index', () => ({
  io: {
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
  },
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-for-testing',
      expiresIn: '1h',
    },
    isDev: false,
    isProd: false,
    features: {
      queueEngine: false,
    },
  },
}));
