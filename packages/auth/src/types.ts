export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  GUEST = "guest",
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Permission {
  resource: string;
  action: string;
  condition?: string;
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}
