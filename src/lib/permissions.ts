import type { Role } from "./session";

// What each role may do. Export is additionally gated by the tenant's export settings.
const MATRIX = {
  viewCandidates: ["ADMIN", "MANAGER", "RECRUITER", "VIEWER"],
  editCandidates: ["ADMIN", "MANAGER", "RECRUITER"],
  deleteCandidates: ["ADMIN", "MANAGER"],
  importData: ["ADMIN", "MANAGER", "RECRUITER"],
  mergeDuplicates: ["ADMIN", "MANAGER"],
  downloadResumes: ["ADMIN", "MANAGER", "RECRUITER"],
  viewAuditLog: ["ADMIN", "MANAGER"],
  manageUsers: ["ADMIN"],
  manageSettings: ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof MATRIX;

export function can(role: Role, perm: Permission) {
  return (MATRIX[perm] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  RECRUITER: "Recruiter",
  VIEWER: "View-only",
};
