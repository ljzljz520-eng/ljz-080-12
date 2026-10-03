/** 与后端助餐模块一致的类型定义 */

export type MealType = 'REGULAR' | 'DIABETIC' | 'SOFT';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  REGULAR: '普通餐',
  DIABETIC: '糖尿病餐',
  SOFT: '软食餐',
};

export type OrderStatus =
  | 'SCHEDULED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'NO_RESPONSE'
  | 'CANCELLED'
  | 'REJECTED';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  SCHEDULED: '已排餐',
  OUT_FOR_DELIVERY: '配送中',
  DELIVERED: '已送达',
  NO_RESPONSE: '未应答异常',
  CANCELLED: '已取消',
  REJECTED: '已拒收',
};

export interface Elder {
  id: string;
  stationId: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  room: string;
  address: string;
  dietaryRestrictions: string[];
  diabetic: boolean;
  chewingDifficulty: boolean;
  note?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  phone: string;
  elderIds: string[];
  elders?: Elder[];
}

export type StaffRole = 'STATION_ADMIN' | 'HOUSEKEEPER' | 'COURIER';

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
}

export interface MealOrder {
  id: string;
  elderId: string;
  date: string;
  mealType: MealType;
  status: OrderStatus;
  swappedFrom?: MealType;
  swapReason?: string;
  rejectReason?: string;
  leftover: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MealSuspension {
  id: string;
  elderId: string;
  date: string;
  reason: string;
  familyId: string;
  createdAt: string;
}

export interface ScheduleRow {
  elder: Elder;
  order: MealOrder | null;
  suspension: MealSuspension | null;
  suggestedMealType: MealType;
  dietaryAlerts: string[];
}

export type DeliveryStatus = 'PENDING' | 'SIGNED' | 'NO_RESPONSE' | 'CLOSED';

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING: '待配送',
  SIGNED: '已签收',
  NO_RESPONSE: '未应答',
  CLOSED: '已关闭',
};

export interface Delivery {
  id: string;
  orderId: string;
  elderId: string;
  courierId: string;
  qrToken: string;
  status: DeliveryStatus;
  signedAt?: string;
  signChannel?: 'QR_SCAN' | 'HOUSEKEEPER_CONFIRM';
  createdAt: string;
  order?: MealOrder;
  elder?: Elder;
}

export interface ExceptionConfirmation {
  at: string;
  by: string;
  method: 'PHONE' | 'VISIT' | 'FAMILY_CONTACT';
  result: 'DELIVERED_CONFIRMED' | 'REDELIVER' | 'CANCELLED';
  note?: string;
}

export interface DeliveryException {
  id: string;
  deliveryId: string;
  orderId: string;
  elderId: string;
  reason: 'NO_RESPONSE';
  note?: string;
  status: 'OPEN' | 'RESOLVED';
  assigneeId: string;
  createdAt: string;
  resolvedAt?: string;
  confirmations: ExceptionConfirmation[];
  elder?: Elder;
  order?: MealOrder;
  delivery?: Delivery;
  assignee?: Staff;
}

export interface ReasonCount {
  reason: string;
  count: number;
}

export interface DailyStats {
  date: string;
  totalOrders: number;
  delivered: number;
  outForDelivery: number;
  scheduled: number;
  noResponse: number;
  cancelled: number;
  rejected: number;
  leftoverCount: number;
  swapCount: number;
  suspensionCount: number;
  rejectionReasons: ReasonCount[];
  leftoverSources: ReasonCount[];
}

export interface FamilyMealRecord extends MealOrder {
  elderName: string;
  suspensionReason: string | null;
  signedAt: string | null;
}

export interface FamilyMealRecords {
  family: { id: string; name: string; relation: string };
  elders: Elder[];
  records: FamilyMealRecord[];
}
