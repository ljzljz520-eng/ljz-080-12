/**
 * 助餐模块领域模型
 * 与 supabase/migrations/20261002000000_meal_module.sql 中的表结构一一对应
 */

/** 餐型：普通餐 / 糖尿病餐 / 软食(咀嚼困难) */
export type MealType = 'REGULAR' | 'DIABETIC' | 'SOFT';

/** 订单状态 */
export type OrderStatus =
  | 'SCHEDULED' // 已排餐
  | 'OUT_FOR_DELIVERY' // 配送中
  | 'DELIVERED' // 已送达(扫码签收)
  | 'NO_RESPONSE' // 老人未应答(异常处理中, 不算完成)
  | 'CANCELLED' // 已取消(家属停餐 / 管家确认取消)
  | 'REJECTED'; // 老人拒收

/** 老人档案（含饮食照护标签） */
export interface Elder {
  id: string;
  stationId: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  room: string; // 房号/床位
  address: string; // 配送地址
  dietaryRestrictions: string[]; // 忌口，如 海鲜过敏 / 不吃辣
  diabetic: boolean; // 是否需要糖尿病餐
  chewingDifficulty: boolean; // 是否咀嚼困难(软食)
  note?: string; // 其他照护备注
}

/** 家属（家属端账号，只能看到自己关联老人的数据） */
export interface FamilyMember {
  id: string;
  name: string;
  relation: string; // 与老人关系
  phone: string;
  elderIds: string[];
}

export type StaffRole = 'STATION_ADMIN' | 'HOUSEKEEPER' | 'COURIER';

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  phone: string;
}

/** 午餐订单（排餐记录） */
export interface MealOrder {
  id: string;
  elderId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  status: OrderStatus;
  swappedFrom?: MealType; // 换餐前的餐型
  swapReason?: string; // 换餐原因
  rejectReason?: string; // 拒收原因
  leftover: boolean; // 是否计入剩餐
  createdAt: string;
  updatedAt: string;
}

/** 家属临时停餐 */
export interface MealSuspension {
  id: string;
  elderId: string;
  date: string; // 停餐日期
  reason: string; // 停餐说明
  familyId: string; // 提交的家属
  createdAt: string;
}

export type DeliveryStatus = 'PENDING' | 'SIGNED' | 'NO_RESPONSE' | 'CLOSED';

/** 配送任务 */
export interface Delivery {
  id: string;
  orderId: string;
  elderId: string;
  courierId: string;
  qrToken: string; // 门口扫码签收令牌
  status: DeliveryStatus;
  signedAt?: string;
  signChannel?: 'QR_SCAN' | 'HOUSEKEEPER_CONFIRM';
  createdAt: string;
}

export type ExceptionStatus = 'OPEN' | 'RESOLVED';

export type ConfirmMethod = 'PHONE' | 'VISIT' | 'FAMILY_CONTACT';

export type ConfirmResult =
  | 'DELIVERED_CONFIRMED' // 确认老人已收到餐
  | 'REDELIVER' // 安排重新配送
  | 'CANCELLED'; // 确认取消(计入剩餐)

/** 管家二次确认记录 */
export interface ExceptionConfirmation {
  at: string;
  by: string; // 管家 id
  method: ConfirmMethod;
  result: ConfirmResult;
  note?: string;
}

/** 配送异常工单（老人未应答时生成，由管家处理） */
export interface DeliveryException {
  id: string;
  deliveryId: string;
  orderId: string;
  elderId: string;
  reason: 'NO_RESPONSE';
  note?: string;
  status: ExceptionStatus;
  assigneeId: string; // 负责管家
  createdAt: string;
  resolvedAt?: string;
  confirmations: ExceptionConfirmation[];
}
