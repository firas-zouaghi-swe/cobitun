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
      tsconfig: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: false,
        esModuleInterop: true,
        module: 'commonjs',
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'react-jsx' as const,
        baseUrl: '.',
        types: ['node', 'jest'],
        paths: {
          '@/*': ['./src/*'],
        },
      },
      isolatedModules: true,
    }],
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__mocks__/**',
    '!src/**/__tests__/**',
  ],
};

export default config;
