export interface Role {
  kind: 'family' | 'courier';
  id: string;
  name: string;
}

const KEY = 'meal-role';

export function getRole(): Role | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Role) : null;
  } catch {
    return null;
  }
}

export function setRole(role: Role | null) {
  if (role) localStorage.setItem(KEY, JSON.stringify(role));
  else localStorage.removeItem(KEY);
}
