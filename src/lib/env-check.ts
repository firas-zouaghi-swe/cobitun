/**
 * Runtime environment checks
 */
export function getMissingEnv(required: string[] = ['JWT_SECRET']): string[] {
  return required.filter((k) => !process.env[k]);
}

export function ensureRequiredEnv(required: string[] = ['JWT_SECRET']): void {
  const missing = getMissingEnv(required);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default {
  getMissingEnv,
  ensureRequiredEnv,
};
