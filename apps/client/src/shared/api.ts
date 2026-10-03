import type {
  DailyStats,
  Delivery,
  DeliveryException,
  Elder,
  FamilyMealRecords,
  FamilyMember,
  MealOrder,
  MealSuspension,
  MealType,
  ScheduleRow,
  Staff,
} from './types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(body.message)
      ? body.message.join('；')
      : (body.message ?? `请求失败（${res.status}）`);
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const api = {
  // 基础档案
  elders: () => request<Elder[]>('/elders'),
  staff: (role?: string) =>
    request<Staff[]>(`/staff${role ? `?role=${role}` : ''}`),
  families: () => request<FamilyMember[]>('/families'),

  // 站点排餐
  schedule: (date: string) =>
    request<{ date: string; rows: ScheduleRow[] }>(`/schedule?date=${date}`),
  generateSchedule: (date: string) =>
    post<{ created: MealOrder[]; skippedSuspended: string[] }>(
      '/schedule/generate',
      { date },
    ),
  createOrder: (elderId: string, date: string, mealType: MealType) =>
    post<MealOrder>('/schedule/orders', { elderId, date, mealType }),
  swapMeal: (orderId: string, mealType: MealType, reason: string) =>
    patch<MealOrder>(`/orders/${orderId}/swap`, { mealType, reason }),
  rejectOrder: (orderId: string, reason: string) =>
    post<MealOrder>(`/orders/${orderId}/reject`, { reason }),
  suspensions: (date?: string) =>
    request<MealSuspension[]>(`/suspensions${date ? `?date=${date}` : ''}`),

  // 配送
  dispatch: (date: string, courierId: string) =>
    post<{ created: Delivery[] }>('/deliveries/dispatch', { date, courierId }),
  deliveries: (date: string, courierId?: string) =>
    request<Delivery[]>(
      `/deliveries?date=${date}${courierId ? `&courierId=${courierId}` : ''}`,
    ),
  deliveryByToken: (token: string) =>
    request<Delivery>(`/deliveries/by-token/${encodeURIComponent(token)}`),
  scanSign: (qrToken: string) => post<Delivery>('/deliveries/scan', { qrToken }),
  reportNoResponse: (deliveryId: string, note?: string) =>
    post<{ delivery: Delivery; exception: DeliveryException }>(
      `/deliveries/${deliveryId}/no-response`,
      { note },
    ),

  // 异常工单（管家）
  exceptions: (status?: 'OPEN' | 'RESOLVED') =>
    request<DeliveryException[]>(
      `/exceptions${status ? `?status=${status}` : ''}`,
    ),
  confirmException: (
    id: string,
    method: 'PHONE' | 'VISIT' | 'FAMILY_CONTACT',
    result: 'DELIVERED_CONFIRMED' | 'REDELIVER' | 'CANCELLED',
    note?: string,
  ) => post<DeliveryException>(`/exceptions/${id}/confirm`, { method, result, note }),

  // 统计
  dailyStats: (date: string) => request<DailyStats>(`/stats/daily?date=${date}`),

  // 家属端
  familyMealRecords: (familyId: string) =>
    request<FamilyMealRecords>(`/families/${familyId}/meal-records`),
  createSuspension: (
    familyId: string,
    elderId: string,
    date: string,
    reason: string,
  ) =>
    post<MealSuspension>(`/families/${familyId}/suspensions`, {
      elderId,
      date,
      reason,
    }),
};

/** 格式化日期为 YYYY-MM-DD */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const today = () => fmtDate(new Date());
