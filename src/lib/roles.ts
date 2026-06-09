/**
 * Client-safe Role constants
 * This file can be imported from both client and server code
 * without triggering any server-side imports (like Prisma)
 */

export const Roles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;

export type Role = typeof Roles[keyof typeof Roles];

/**
 * Client-side RBAC helper functions
 */
export const RBAC = {
  canCreateUser: (actorRole: Role | string, targetRole: Role | string): boolean => {
    if (actorRole === Roles.SUPER_ADMIN) {
      return ([Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CUSTOMER] as any).includes(targetRole);
    }
    if (actorRole === Roles.ADMIN) {
      return ([Roles.ADMIN, Roles.CUSTOMER] as any).includes(targetRole);
    }
    return false;
  },

  canManageUser: (actorRole: Role | string, targetRole: Role | string): boolean => {
    // Same logic as create user per requirements
    return RBAC.canCreateUser(actorRole as any, targetRole as any);
  },
};

export default Roles;
