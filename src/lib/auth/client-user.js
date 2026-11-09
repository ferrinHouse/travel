// What the browser may know about the signed-in user: enough to decide which
// controls to show (the server re-checks every action), nothing secret.
export function clientUser(user) {
  if (!user) return null;
  const { id, username, displayName, role, isActive, hasPassword } = user;
  return { id, username, displayName, role, isActive: !!isActive, hasPassword: !!hasPassword };
}
