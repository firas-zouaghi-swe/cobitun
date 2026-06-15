
/**
 * File Scanning & Storage Security
 * - ClamAV integration for virus scanning
 * - Local file storage security policies
 * - Pre-signed URL generation (24h expiry)
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Lazy-initialized to avoid Turbopack tracing process.cwd() at build time
function getUploadDir(): string {
  const val = process.env.UPLOAD_DIR;
  if (val) return val;
  return path.join(process.cwd(), 'upload');
}

// SECURITY: Require PRESIGNED_URL_SECRET to be explicitly configured
function getPresignedUrlSecret(): string {
  const secret = process.env.PRESIGNED_URL_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PRESIGNED_URL_SECRET environment variable is required in production');
    }
    // Development fallback - still log a warning
    console.warn('[SECURITY WARNING] PRESIGNED_URL_SECRET not configured. Using insecure development fallback. Set PRESIGNED_URL_SECRET in production.');
    return 'dev-presigned-secret';
  }
  return secret;
}

const PRESIGNED_URL_SECRET = getPresignedUrlSecret();
const PRESIGNED_URL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Virus scanning using ClamAV (if available) or fallback validation
 */
export async function scanFileForViruses(filePath: string): Promise<{
  clean: boolean;
  scanner: string;
  details?: string;
}> {
  // Try ClamAV first via clamd
  try {
    const { execFile } = await import('child_process');
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile('clamdscan', ['--no-summary', filePath], { timeout: 30000 }, (error, stdout, stderr) => {
        if (error && error.code !== 1) reject(error);
        else resolve({ stdout: stdout || '', stderr: stderr || '' });
      });
    });

    if (result.stdout.includes('OK') || result.stdout.includes('found: 0')) {
      return { clean: true, scanner: 'ClamAV', details: 'No threats detected' };
    } else if (result.stdout.includes('FOUND')) {
      return { clean: false, scanner: 'ClamAV', details: result.stdout.trim() };
    }
  } catch {
    // ClamAV not available, use fallback validation
  }

  // Fallback: basic file content validation
  return fallbackFileValidation(filePath);
}

/**
 * Fallback file validation when ClamAV is not available
 */
function fallbackFileValidation(filePath: string): {
  clean: boolean;
  scanner: string;
  details?: string;
} {
  try {
    const stats = fs.statSync(filePath);

    // Check file size (max 10MB)
    if (stats.size > 10 * 1024 * 1024) {
      return { clean: false, scanner: 'fallback', details: 'File exceeds 10MB limit' };
    }

    // Read first bytes to check for known malicious signatures
    const buffer = Buffer.alloc(8192);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8192, 0);
    fs.closeSync(fd);

    // Check for executable signatures (PE, ELF, Mach-O)
    const peSignature = buffer.subarray(0, 2).toString('ascii');
    if (peSignature === 'MZ') {
      return { clean: false, scanner: 'fallback', details: 'Executable file detected (PE)' };
    }

    const elfSignature = buffer.subarray(0, 4);
    if (elfSignature[0] === 0x7f && elfSignature.toString('ascii', 1, 4) === 'ELF') {
      return { clean: false, scanner: 'fallback', details: 'Executable file detected (ELF)' };
    }

    // Check for script tags that could indicate XSS payloads
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return { clean: false, scanner: 'fallback', details: `Suspicious pattern detected: ${pattern.source}` };
      }
    }

    return { clean: true, scanner: 'fallback', details: 'Basic validation passed (ClamAV not available)' };
  } catch (error) {
    return { clean: false, scanner: 'fallback', details: `Validation error: ${(error as Error).message}` };
  }
}

/**
 * Apply local file storage security policies
 */
export function applyStorageSecurityPolicies(filePath: string): void {
  // Ensure upload directory exists with proper permissions
  const UPLOAD_DIR = getUploadDir();
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true, mode: 0o755 });
  }

  // Verify file is within upload directory (path traversal protection)
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(getUploadDir()))) {
    throw new Error('File path traversal detected');
  }

  // Set file permissions (read-only for owner, no execute)
  try {
    fs.chmodSync(resolvedPath, 0o400);
  } catch {
    // chmod may not work on all platforms (Windows)
  }
}

/**
 * Generate a pre-signed URL for temporary file access
 */
export function generatePresignedUrl(fileId: string, fileName: string): string {
  const expires = Date.now() + PRESIGNED_URL_EXPIRY_MS;
  const signature = crypto
    .createHmac('sha256', PRESIGNED_URL_SECRET)
    .update(`${fileId}:${fileName}:${expires}`)
    .digest('hex');

  const params = new URLSearchParams({
    fileId,
    fileName,
    expires: expires.toString(),
    signature,
  });

  return `/api/documents/download?${params.toString()}`;
}

/**
 * Verify a pre-signed URL
 */
export function verifyPresignedUrl(
  fileId: string,
  fileName: string,
  expires: string,
  signature: string
): { valid: boolean; reason?: string } {
  const expiresNum = parseInt(expires, 10);

  // Check expiry
  if (Date.now() > expiresNum) {
    return { valid: false, reason: 'URL has expired' };
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', PRESIGNED_URL_SECRET)
    .update(`${fileId}:${fileName}:${expires}`)
    .digest('hex');

  if (signature !== expectedSignature) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Clean up expired files based on retention policy
 */
export function cleanupExpiredFiles(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): number {
  let cleaned = 0;
  const now = Date.now();

  try {
    const dir = getUploadDir();
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
  } catch {
    // Directory may not exist
  }

  return cleaned;
}

