/**
 * 助餐模块 API 层：类型定义 + fetch 封装 + 演示身份会话。
 * 后端通过 x-staff-id / x-family-id 请求头识别身份（演示环境免登录）。
 */

const BASE = '/api';
const IDENTITY_KEY = 'eldercare.identity';

export type StaffRole = 'station_admin' | 'courier' | 'housekeeper';

export interface Station {
  id: number;
  name: string;
  address: string;
}
export interface StaffUser {
  id: number;
  name: string;
  role: StaffRole;
  station_id: number;
  station_name: string;
}
export interface FamilyMember {
  id: number;
  name: string;
  relation: string;
  elder_id: number;
  elder_name: string;
}
export interface Bootstrap {
  stations: Station[];
  staff: StaffUser[];
  families: FamilyMember[];
}

export interface ElderInfo {
  id: number;
  name: string;
  roomNo: string | null;
  age?: number | null;
  dietaryRestrictions: string[];
  diabetic: boolean;
  chewingDifficulty: boolean;
  notes?: string | null;
  qrCode: string;
}
export interface SuspensionInfo {
  id: number;
  startDate: string;
  endDate: string;
  reason: string;
  createdByName: string;
}
export interface BoardOrder {
  id: number;
  menuText: string;
  dietTags: string[];
  status: string;
  swappedAt: string | null;
  swapNote: string | null;
  rejectReason: string | null;
  leftoverNote: string | null;
  delivery: {
    id: number;
    status: string;
    courierName: string;
    signedAt: string | null;
  } | null;
}
export interface MealBoardRow {
  elder: ElderInfo;
  suspension: SuspensionInfo | null;
  order: BoardOrder | null;
}

export interface CourierTask {
  deliveryId: number;
  deliveryStatus: string;
  signedAt: string | null;
  orderId: number;
  menuText: string;
  dietTags: string[];
  mealDate: string;
  elder: ElderInfo;
  exception: { id: number; status: string } | null;
}

export interface ExceptionItem {
  id: number;
  type: string;
  status: 'pending' | 'confirming' | 'resolved';
  courierNote: string | null;
  createdAt: string;
  housekeeper: { id: number; name: string } | null;
  secondConfirm: { result: string; note: string; confirmedAt: string } | null;
  deliveryId: number;
  courierName: string;
  order: { id: number; menuText: string; mealDate: string };
  elder: { id: number; name: string; roomNo: string };
}

export interface DailyStats {
  date: string;
  stationId: number;
  orders: {
    total: number;
    signed: number;
    leftover: number;
    rejected: number;
    cancelled: number;
    in_progress: number;
    swapped: number;
  };
  rejectReasons: { reason: string; count: number }[];
  noResponseExceptions: { total: number; resolved: number; open: number };
}

export interface MealRecord {
  id: number;
  mealDate: string;
  mealType: string;
  menuText: string;
  dietTags: string[];
  status: string;
  swapNote: string | null;
  rejectReason: string | null;
  leftoverNote: string | null;
  swappedAt: string | null;
  deliveryStatus: string | null;
  signedAt: string | null;
}

export interface FamilyProfile {
  elder: {
    id: number;
    name: string;
    roomNo: string | null;
    dietaryRestrictions: string[];
    diabetic: boolean;
    chewingDifficulty: boolean;
  };
  suspensions: {
    id: number;
    startDate: string;
    endDate: string;
    reason: string;
    createdAt: string;
  }[];
}

export interface Notice {
  id: number;
  type: string;
  title: string;
  content: string;
  read: boolean;
  created_at: string;
}

export type Identity =
  | {
      kind: 'staff';
      id: number;
      name: string;
      role: StaffRole;
      stationId: number;
      stationName: string;
    }
  | {
      kind: 'family';
      id: number;
      name: string;
      relation: string;
      elderId: number;
      elderName: string;
    };

export function getIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity | null) {
  if (identity) localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  else localStorage.removeItem(IDENTITY_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const identity = getIdentity();
  if (identity?.kind === 'staff') headers['x-staff-id'] = String(identity.id);
  if (identity?.kind === 'family') headers['x-family-id'] = String(identity.id);

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message)
      ? data.message.join('；')
      : (data?.message ?? `请求失败（${res.status}）`);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

// ---------- 展示字典 ----------

export const ROLE_NAME: Record<StaffRole, string> = {
  station_admin: '站点管理员',
  courier: '配送员',
  housekeeper: '管家',
};

export const ORDER_STATUS: Record<string, { text: string; color: string }> = {
  scheduled: { text: '已排餐', color: 'blue' },
  delivering: { text: '配送中', color: 'processing' },
  signed: { text: '已签收', color: 'success' },
  leftover: { text: '剩餐', color: 'warning' },
  rejected: { text: '已拒收', color: 'error' },
  cancelled: { text: '已取消', color: 'default' },
};

export const DELIVERY_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待取餐', color: 'default' },
  out_for_delivery: { text: '配送中', color: 'processing' },
  signed: { text: '已签收', color: 'success' },
  exception: { text: '异常', color: 'error' },
};

export const EXCEPTION_STATUS: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'error' },
  confirming: { text: '二次确认中', color: 'processing' },
  resolved: { text: '已办结', color: 'success' },
};

export const SECOND_CONFIRM_RESULT: Record<string, string> = {
  reschedule: '补送',
  recycle: '回收记剩餐',
  cancel: '取消订餐',
};

export function fmtTime(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
