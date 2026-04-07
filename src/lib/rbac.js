export function hasRole(userRole, allowed = []) {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(userRole);
}