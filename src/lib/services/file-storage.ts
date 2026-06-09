import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '@/lib/db';

function getUploadDir(): string {
  return process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve(process.cwd(), 'upload');
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
const MAX_UPLOAD_QUOTA_BYTES = 100 * 1024 * 1024; // 100 MB per user
const MAX_UPLOAD_FILES_PER_USER = 50;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// ==================== TYPE DEFINITIONS ====================

/**
 * Concrete FK references for linking an uploaded file to a specific entity.
 * At most one should be set per file.
 */
export interface FileEntityRefs {
  parametricPolicyId?: number;
  cyberPolicyId?: number;
  parametricClaimId?: number;
  cyberClaimId?: number;
  workflowPolicyAppId?: number;
  workflowClaimId?: number;
}

export interface SaveFileParams {
  file: File;
  fileName: string;
  fileCategory: string;
  uploadedBy: number;
  isPublic?: boolean;
  entityRefs?: FileEntityRefs;
}

// ==================== FILE VALIDATION ====================

/**
 * Validates that a file is a proper PDF by checking:
 * - MIME type is application/pdf
 * - File size does not exceed 10MB
 * - First 5 bytes match the %PDF- header
 */
async function readHeaderBytes(file: File, length: number) {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer.slice(0, length));
}

function isValidPdf(bytes: Uint8Array) {
  const header = String.fromCharCode(...bytes.slice(0, 5));
  return header === '%PDF-';
}

function isValidJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isValidPng(bytes: Uint8Array) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

export async function validateUploadFile(file: File, allowedTypes: string[] = ALLOWED_MIME_TYPES): Promise<boolean> {
  if (!allowedTypes.includes(file.type)) {
    return false;
  }

  if (file.size > MAX_FILE_SIZE) {
    return false;
  }

  try {
    const bytes = await readHeaderBytes(file, 8);
    if (file.type === 'application/pdf') {
      return isValidPdf(bytes);
    }
    if (file.type === 'image/jpeg') {
      return isValidJpeg(bytes);
    }
    if (file.type === 'image/png') {
      return isValidPng(bytes);
    }
    return false;
  } catch {
    return false;
  }
}

export async function validatePdf(file: File): Promise<boolean> {
  return validateUploadFile(file, ['application/pdf']);
}

/**
 * Validates a file's MIME type against an allowed list.
 */
export function validateMimeType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

// ==================== FILE HASHING ====================

/**
 * Compute SHA-256 hash of a file's contents for integrity verification.
 */
async function computeFileHash(buffer: Buffer): Promise<string> {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ==================== FILE SYSTEM OPERATIONS ====================

/**
 * Returns the full path for a file in the upload directory.
 */
export function getFilePath(fileName: string): string {
  return path.join(getUploadDir(), fileName);
}

/**
 * Checks if a file exists at the given path.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ==================== UPLOAD QUOTA HELPERS ====================

export async function getUserUploadUsage(userId: number) {
  const usage = await db.uploadedFile.aggregate({
    _count: { id: true },
    _sum: { fileSizeBytes: true },
    where: { uploadedBy: userId, isDeleted: 0 },
  });

  return {
    totalBytes: usage._sum.fileSizeBytes ?? 0,
    totalFiles: usage._count.id,
  };
}

export async function assertUploadQuota(userId: number, fileSize: number) {
  const usage = await getUserUploadUsage(userId);

  if (usage.totalFiles >= MAX_UPLOAD_FILES_PER_USER) {
    throw new Error(`Upload file limit exceeded: only ${MAX_UPLOAD_FILES_PER_USER} active files allowed per user.`);
  }

  if (usage.totalBytes + fileSize > MAX_UPLOAD_QUOTA_BYTES) {
    throw new Error(`Upload quota exceeded: total stored files must not exceed ${Math.round(MAX_UPLOAD_QUOTA_BYTES / 1024 / 1024)} MB.`);
  }
}

// ==================== SAVE FILE (DISK + DB) ====================

/**
 * Saves an uploaded file to the upload directory and creates an UploadedFile DB record.
 * Validates file type, maximum size, and user quota before saving.
 * Returns the created UploadedFile record.
 *
 * @param params - SaveFileParams with file, metadata, and entity references
 */
export async function saveUploadedFile(params: SaveFileParams) {
  const {
    file,
    fileName,
    fileCategory,
    uploadedBy,
    isPublic = false,
    entityRefs,
  } = params;

  const isValid = await validateUploadFile(file);
  if (!isValid) {
    throw new Error('Invalid file: allowed types are PDF, JPEG, PNG; max size 10MB; file must pass magic-bytes verification.');
  }

  await assertUploadQuota(uploadedBy, file.size);

  // Ensure upload directory exists
  await fs.mkdir(getUploadDir(), { recursive: true });

  const filePath = getFilePath(fileName);

  // Write file to disk
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.writeFile(filePath, buffer);

  // Compute file hash
  const fileHashSha256 = await computeFileHash(buffer);

  // Create the DB record with concrete FK references
  const uploadedFile = await db.uploadedFile.create({
    data: {
      fileName,
      filePath,
      mimeType: file.type,
      fileSizeBytes: file.size,
      fileHashSha256,
      fileCategory,
      virusScanStatus: 'PENDING',
      uploadedBy,
      parametricPolicyId: entityRefs?.parametricPolicyId ?? null,
      cyberPolicyId: entityRefs?.cyberPolicyId ?? null,
      parametricClaimId: entityRefs?.parametricClaimId ?? null,
      cyberClaimId: entityRefs?.cyberClaimId ?? null,
      workflowPolicyAppId: entityRefs?.workflowPolicyAppId ?? null,
      workflowClaimId: entityRefs?.workflowClaimId ?? null,
      isPublic: isPublic ? 1 : 0,
    },
  });

  return uploadedFile;
}

// ==================== QUERY HELPERS ====================

/**
 * Get all files associated with a parametric policy.
 */
export async function getFilesForParametricPolicy(parametricPolicyId: number) {
  return db.uploadedFile.findMany({
    where: {
      parametricPolicyId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get all files associated with a cyber policy.
 */
export async function getFilesForCyberPolicy(cyberPolicyId: number) {
  return db.uploadedFile.findMany({
    where: {
      cyberPolicyId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get all files associated with a parametric claim.
 */
export async function getFilesForParametricClaim(parametricClaimId: number) {
  return db.uploadedFile.findMany({
    where: {
      parametricClaimId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get all files associated with a cyber claim.
 */
export async function getFilesForCyberClaim(cyberClaimId: number) {
  return db.uploadedFile.findMany({
    where: {
      cyberClaimId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get all files associated with a workflow policy application.
 */
export async function getFilesForWorkflowPolicyApp(workflowPolicyAppId: number) {
  return db.uploadedFile.findMany({
    where: {
      workflowPolicyAppId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get all files associated with a workflow claim.
 */
export async function getFilesForWorkflowClaim(workflowClaimId: number) {
  return db.uploadedFile.findMany({
    where: {
      workflowClaimId,
      isDeleted: 0,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Soft-delete an uploaded file.
 */
export async function deleteUploadedFile(fileId: number, deletedBy: number) {
  return db.uploadedFile.update({
    where: { id: fileId },
    data: {
      isDeleted: 1,
      deletedAt: new Date(),
      deletedBy,
    },
  });
}

/**
 * Update the virus scan status of an uploaded file.
 */
export async function updateVirusScanStatus(
  fileId: number,
  status: string,
  result?: string
) {
  return db.uploadedFile.update({
    where: { id: fileId },
    data: {
      virusScanStatus: status,
      virusScanResult: result ?? null,
      virusScannedAt: new Date(),
    },
  });
}

