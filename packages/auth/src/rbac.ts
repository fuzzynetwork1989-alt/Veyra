import { UserRole, Permission } from "./types";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    { resource: "*", action: "*" },
  ],
  [UserRole.USER]: [
    { resource: "sessions", action: "read" },
    { resource: "sessions", action: "create" },
    { resource: "memory", action: "read" },
    { resource: "memory", action: "write" },
    { resource: "retrieval", action: "read" },
  ],
  [UserRole.GUEST]: [
    { resource: "sessions", action: "read" },
  ],
};

export function hasPermission(
  role: UserRole,
  resource: string,
  action: string
): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  return permissions.some((perm) => {
    const resourceMatch = perm.resource === "*" || perm.resource === resource;
    const actionMatch = perm.action === "*" || perm.action === action;
    return resourceMatch && actionMatch;
  });
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
