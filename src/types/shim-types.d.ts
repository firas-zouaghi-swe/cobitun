import type { AuthInfo as AuthInfoType } from '@/lib/services/auth-helper';
import type { NotificationEntityRefs as NotificationEntityRefsType } from '@/lib/services/notification-service';

// Temporary shims for missing type definition files referenced by dependencies
declare module 'd3-color';
declare module 'd3-path';
declare module 'ms';
declare module 'unist';

declare global {
  type AuthInfo = AuthInfoType;
  type NotificationEntityRefs = NotificationEntityRefsType;
}

