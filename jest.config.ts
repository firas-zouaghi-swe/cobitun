import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/lib/db$': '<rootDir>/src/__mocks__/lib/db.ts',
    '^@/middleware/prisma-encryption$': '<rootDir>/src/__mocks__/middleware/prisma-encryption.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};

export default config;
