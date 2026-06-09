/**
 * Role-Based Access Control (RBAC) Service
 * Defines permissions and access control logic for different user roles
 */

import { Roles, type Role } from './authorization';

// Ensure this module is only used on the server side
if (typeof window !== 'undefined') {
  throw new Error('rbac.ts is a server-side module and should not be imported on the client side');
}

export const RBAC_PERMISSIONS = {
  // User management permissions
  CREATE_USERS: 'CREATE_USERS',
  MANAGE_USERS: 'MANAGE_USERS',

  // Role-specific permissions
  CREATE_SUPER_ADMIN: 'CREATE_SUPER_ADMIN',
  MANAGE_SUPER_ADMIN: 'MANAGE_SUPER_ADMIN',
  CREATE_ADMIN: 'CREATE_ADMIN',
  MANAGE_ADMIN: 'MANAGE_ADMIN',
  CREATE_CUSTOMER: 'CREATE_CUSTOMER',
  MANAGE_CUSTOMER: 'MANAGE_CUSTOMER',
} as const;

export type Permission = typeof RBAC_PERMISSIONS[keyof typeof RBAC_PERMISSIONS];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    RBAC_PERMISSIONS.CREATE_USERS,
    RBAC_PERMISSIONS.MANAGE_USERS,
    RBAC_PERMISSIONS.CREATE_SUPER_ADMIN,
    RBAC_PERMISSIONS.MANAGE_SUPER_ADMIN,
    RBAC_PERMISSIONS.CREATE_ADMIN,
    RBAC_PERMISSIONS.MANAGE_ADMIN,
    RBAC_PERMISSIONS.CREATE_CUSTOMER,
    RBAC_PERMISSIONS.MANAGE_CUSTOMER,
  ],
  ADMIN: [
    RBAC_PERMISSIONS.CREATE_USERS,
    RBAC_PERMISSIONS.MANAGE_USERS,
    RBAC_PERMISSIONS.CREATE_ADMIN,
    RBAC_PERMISSIONS.MANAGE_ADMIN,
    RBAC_PERMISSIONS.CREATE_CUSTOMER,
    RBAC_PERMISSIONS.MANAGE_CUSTOMER,
  ],
  CUSTOMER: [],
};

/**
 * Check if actor can create a user with the specified role
 */
export function canCreateUser(actorRole: Role | string, targetRole: Role | string): boolean {
  // Super Admin can create all roles
  if (actorRole === Roles.SUPER_ADMIN) {
    return ([Roles.SUPER_ADMIN, Roles.ADMIN, Roles.CUSTOMER] as any).includes(targetRole);
  }

  // Admin can create Admin and Customer roles, but not Super Admin
  if (actorRole === Roles.ADMIN) {
     return ([Roles.ADMIN, Roles.CUSTOMER] as any).includes(targetRole);
  }

  // Customer cannot create any users
  return false;
}

/**
 * Check if actor can manage a user with the specified role
 */
export function canManageUser(actorRole: Role | string, targetRole: Role | string): boolean {
  // Same logic as create user per your requirements
  return canCreateUser(actorRole, targetRole);
}

/**
 * Check if actor has a specific permission
 */
export function hasPermission(actorRole: Role | string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS as any)[actorRole as string]?.includes(permission) || false;
}

/**
 * Check if actor can manage a specific user based on their roles
 */
export function canManageUserByRole(actorRole: Role | string, targetUser: any): boolean {
  // Super Admin can manage all users
  if (actorRole === Roles.SUPER_ADMIN) {
    return true;
  }

  // Admin can manage Admin and Customer users, but not Super Admin
  if (actorRole === Roles.ADMIN) {
    if (targetUser.role === Roles.SUPER_ADMIN) {
      return false;
    }
    return true;
  }

  // Customer cannot manage any users
  return false;
}

export default {
  Roles,
  RBAC_PERMISSIONS,
  ROLE_PERMISSIONS,
  canCreateUser,
  canManageUser,
  hasPermission,
  canManageUserByRole
};
