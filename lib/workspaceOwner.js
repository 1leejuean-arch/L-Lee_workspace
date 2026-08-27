const DEFAULT_WORKSPACE_OWNER_EMAIL = "1leejuean@gmail.com";

export function getWorkspaceOwnerEmail() {
  return String(process.env.WORKSPACE_OWNER_EMAIL || DEFAULT_WORKSPACE_OWNER_EMAIL).trim().toLowerCase();
}

export function isWorkspaceOwnerEmail(email) {
  return Boolean(email) && String(email).trim().toLowerCase() === getWorkspaceOwnerEmail();
}
