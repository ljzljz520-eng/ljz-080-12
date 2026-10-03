import { Injectable } from '@nestjs/common';
import {
  Delivery,
  DeliveryException,
  Elder,
  FamilyMember,
  MealOrder,
  MealSuspension,
  Staff,
} from './meal.types';

export function dateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 内存数据存储（演示环境默认实现）。
 * 表结构与 supabase/migrations/20261002000000_meal_module.sql 保持一致，
 * 接入真实 Supabase 时以同名仓储替换即可。
 */
@Injectable()
export class MealStore {
  readonly elders: Elder[] = [];
  readonly familyMembers: FamilyMember[] = [];
  readonly staff: Staff[] = [];
  readonly orders: MealOrder[] = [];
  readonly suspensions: MealSuspension[] = [];
  readonly deliveries: Delivery[] = [];
  readonly exceptions: DeliveryException[] = [];

  private seq: Record<string, number> = {};

  nextId(prefix: string): string {
    this.seq[prefix] = (this.seq[prefix] ?? 0) + 1;
    return `${prefix}${this.seq[prefix]}`;
  }

  constructor() {
    this.seed();
  }

  private seed() {
    const today = dateString(0);
    const yesterday = dateString(-1);
    const now = new Date().toISOString();

    // ---- 站点员工 ----
    this.staff.push(
      {
        id: 'st-admin',
        name: '陈站长',
        role: 'STATION_ADMIN',
        phone: '13800000001',
      },
      {
        id: 'st-hk1',
        name: '王管家',
        role: 'HOUSEKEEPER',
        phone: '13800000002',
      },
      {
        id: 'st-courier1',
        name: '小周',
        role: 'COURIER',
        phone: '13800000003',
      },
    );

    // ---- 老人档案（含忌口 / 糖尿病餐 / 咀嚼困难标签） ----
    this.elders.push(
      {
        id: 'e1',
        stationId: 'station-1',
        name: '张桂兰',
        age: 82,
        gender: 'F',
        room: '3栋201',
        address: '阳光社区3栋201室',
        dietaryRestrictions: ['海鲜过敏', '不吃香菜'],
        diabetic: true,
        chewingDifficulty: true,
        note: '独居，听力较弱，敲门需重一些',
      },
      {
        id: 'e2',
        stationId: 'station-1',
        name: '李建国',
        age: 78,
        gender: 'M',
        room: '1栋102',
        address: '阳光社区1栋102室',
        dietaryRestrictions: ['不吃辣'],
        diabetic: false,
        chewingDifficulty: false,
      },
      {
        id: 'e3',
        stationId: 'station-1',
        name: '王秀珍',
        age: 86,
        gender: 'F',
        room: '2栋305',
        address: '阳光社区2栋305室',
        dietaryRestrictions: [],
        diabetic: false,
        chewingDifficulty: true,
        note: '吞咽功能弱，食物需剪碎',
      },
      {
        id: 'e4',
        stationId: 'station-1',
        name: '赵德福',
        age: 75,
        gender: 'M',
        room: '3栋104',
        address: '阳光社区3栋104室',
        dietaryRestrictions: ['不吃猪肉'],
        diabetic: true,
        chewingDifficulty: false,
      },
      {
        id: 'e5',
        stationId: 'station-1',
        name: '陈阿妹',
        age: 80,
        gender: 'F',
        room: '1栋208',
        address: '阳光社区1栋208室',
        dietaryRestrictions: [],
        diabetic: false,
        chewingDifficulty: false,
      },
      {
        id: 'e6',
        stationId: 'station-1',
        name: '刘长海',
        age: 84,
        gender: 'M',
        room: '2栋101',
        address: '阳光社区2栋101室',
        dietaryRestrictions: ['乳糖不耐受'],
        diabetic: false,
        chewingDifficulty: true,
      },
    );

    // ---- 家属（与老人关联，家属端仅能查看关联老人） ----
    this.familyMembers.push(
      {
        id: 'f1',
        name: '张敏',
        relation: '女儿',
        phone: '13911110001',
        elderIds: ['e1'],
      },
      {
        id: 'f2',
        name: '李伟',
        relation: '儿子',
        phone: '13911110002',
        elderIds: ['e2'],
      },
      {
        id: 'f3',
        name: '王芳',
        relation: '儿媳',
        phone: '13911110003',
        elderIds: ['e3', 'e6'],
      },
    );

    // ---- 家属临时停餐（今天，张桂兰） ----
    this.suspensions.push({
      id: this.nextId('sus'),
      elderId: 'e1',
      date: today,
      reason: '今天女儿接老人外出复查，午餐不在家吃',
      familyId: 'f1',
      createdAt: now,
    });

    // ---- 今日排餐 ----
    const todayPlans: Array<[string, MealOrder['mealType']]> = [
      ['e1', 'SOFT'], // 糖尿病+咀嚼困难，已被家属停餐
      ['e2', 'REGULAR'],
      ['e3', 'SOFT'],
      ['e4', 'DIABETIC'],
      ['e5', 'REGULAR'],
      ['e6', 'SOFT'],
    ];
    for (const [elderId, mealType] of todayPlans) {
      const suspended = elderId === 'e1';
      this.orders.push({
        id: this.nextId('o'),
        elderId,
        date: today,
        mealType,
        status: suspended ? 'CANCELLED' : 'SCHEDULED',
        leftover: suspended, // 当天临时停餐，厨房已备餐 → 计剩餐
        createdAt: now,
        updatedAt: now,
      });
    }
    // 赵德福今天由普通餐换成糖尿病餐（医生新要求）
    const o4 = this.orders.find((o) => o.elderId === 'e4' && o.date === today)!;
    o4.swappedFrom = 'REGULAR';
    o4.swapReason = '家属告知最新体检血糖偏高，改糖尿病餐';

    // ---- 昨日数据（供统计演示） ----
    const yesterdayPlans: Array<
      [string, MealOrder['mealType'], MealOrder['status'], Partial<MealOrder>?]
    > = [
      ['e1', 'SOFT', 'DELIVERED'],
      ['e2', 'REGULAR', 'DELIVERED'],
      [
        'e3',
        'SOFT',
        'REJECTED',
        { rejectReason: '老人称已在外吃过，拒收', leftover: true },
      ],
      [
        'e4',
        'DIABETIC',
        'DELIVERED',
        { swappedFrom: 'REGULAR', swapReason: '血糖偏高改糖尿病餐' },
      ],
      ['e5', 'REGULAR', 'CANCELLED', { leftover: true }],
      ['e6', 'SOFT', 'DELIVERED'],
    ];
    for (const [elderId, mealType, status, extra] of yesterdayPlans) {
      this.orders.push({
        id: this.nextId('o'),
        elderId,
        date: yesterday,
        mealType,
        status,
        leftover: false,
        createdAt: now,
        updatedAt: now,
        ...extra,
      });
    }
    this.suspensions.push({
      id: this.nextId('sus'),
      elderId: 'e5',
      date: yesterday,
      reason: '老人去儿子家住两天',
      familyId: 'f2',
      createdAt: now,
    });
  }
}
