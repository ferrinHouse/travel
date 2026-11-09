// Viewer < Member < Admin. Each action names the lowest role allowed.
export const ROLES = ['viewer', 'member', 'admin'];

const ACTIONS = {
  view: 'viewer',
  toggle: 'member', // tick checklist / grocery items
  'add-item': 'member', // add checklist / grocery items
  upload: 'member', // add photos (and change or delete their own)
  edit: 'admin', // everything else that changes trip content
  'manage-users': 'admin',
};

export const isRole = (role) => ROLES.includes(role);

export function can(user, action) {
  if (!user || !user.isActive || !isRole(user.role) || !(action in ACTIONS)) return false;
  return ROLES.indexOf(user.role) >= ROLES.indexOf(ACTIONS[action]);
}
