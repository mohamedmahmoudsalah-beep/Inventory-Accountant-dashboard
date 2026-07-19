import { UserRole } from "@prisma/client";

export const roleHierarchy: Record<UserRole, number> = {
  [UserRole.ADMIN]: 4,
  [UserRole.MANAGER]: 3,
  [UserRole.EMPLOYEE]: 2,
  [UserRole.VIEWER]: 1,
};

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export function canEdit(userRole: UserRole): boolean {
  return hasRole(userRole, UserRole.EMPLOYEE);
}

export function canManage(userRole: UserRole): boolean {
  return hasRole(userRole, UserRole.MANAGER);
}

export function canAdmin(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN;
}

export const permissions = {
  dashboard: {
    create: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
    edit: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
    delete: [UserRole.ADMIN, UserRole.MANAGER],
    publish: [UserRole.ADMIN, UserRole.MANAGER],
    share: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
  dataset: {
    create: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
    edit: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
    delete: [UserRole.ADMIN, UserRole.MANAGER],
    refresh: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
  businessUnit: {
    create: [UserRole.ADMIN],
    edit: [UserRole.ADMIN, UserRole.MANAGER],
    delete: [UserRole.ADMIN],
    manageMembers: [UserRole.ADMIN, UserRole.MANAGER],
  },
  user: {
    create: [UserRole.ADMIN],
    edit: [UserRole.ADMIN, UserRole.MANAGER],
    delete: [UserRole.ADMIN],
    changeRole: [UserRole.ADMIN],
  },
};

export function hasPermission(
  userRole: UserRole,
  resource: keyof typeof permissions,
  action: string
): boolean {
  const allowedRoles = (permissions[resource] as any)?.[action] || [];
  return allowedRoles.includes(userRole);
}
