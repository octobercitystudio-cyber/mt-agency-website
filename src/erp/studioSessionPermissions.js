export const SESSION_COMPLETE_ROLES = ['owner', 'admin', 'operations'];

export const canRoleCompleteStudioSession = role => SESSION_COMPLETE_ROLES.includes(role);
