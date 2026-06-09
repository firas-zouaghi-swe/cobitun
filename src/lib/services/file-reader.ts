
/**
 * File Reader Service
 * Centralized file I/O module listed in serverExternalPackages
 * to prevent Turbopack NFT tracing of fs/path in route handlers.
 */

import { readFile, readFileSync, existsSync, mkdirSync, writeFileSync, accessSync, constants } from 'fs';
import * as fsPromises from 'fs/promises';
import { join, extname, resolve, dirname } from 'path';

export const fileReader = {
  // Sync operations
  readFile,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  accessSync,
  constants,

  // Async operations (promises)
  promises: fsPromises,

  // Path utilities
  join,
  extname,
  resolve,
  dirname,

  // Upload directory helper (lazy evaluation)
  getUploadDir(): string {
    return process.env.UPLOAD_DIR || join(process.cwd(), 'upload');
  },
};

