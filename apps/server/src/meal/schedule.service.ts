import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { dateString, MealStore } from './meal.store';
import { Elder, MealOrder, MealSuspension, MealType } from './meal.types';

/** 排餐列表行：站点排餐时看到的完整信息 */
export interface ScheduleRow {
  elder: Elder;
  order: MealOrder | null;
  suspension: MealSuspension | null;
  suggestedMealType: MealType;
  /** 饮食提示汇总：忌口 / 糖尿病餐 / 咀嚼困难 / 家属停餐说明 */
  dietaryAlerts: string[];
}

@Injectable()
export class ScheduleService {
  constructor(private readonly store: MealStore) {}

  /** 根据老人健康标签推导建议餐型 */
  suggestedMealType(elder: Elder): MealType {
    if (elder.chewingDifficulty) return 'SOFT';
    if (elder.diabetic) return 'DIABETIC';
    return 'REGULAR';
  }

  /** 站点排餐视图：每位老人一行，带饮食标签与家属停餐说明 */
  getSchedule(date: string): ScheduleRow[] {
    return this.store.elders.map((elder) => {
      const order =
        this.store.orders.find(
          (o) => o.elderId === elder.id && o.date === date,
        ) ?? null;
      const suspension =
        this.store.suspensions.find(
          (s) => s.elderId === elder.id && s.date === date,
        ) ?? null;
      return {
        elder,
        order,
        suspension,
        suggestedMealType: this.suggestedMealType(elder),
        dietaryAlerts: this.buildDietaryAlerts(elder, suspension),
      };
    });
  }

  private buildDietaryAlerts(
    elder: Elder,
    suspension: MealSuspension | null,
  ): string[] {
    const alerts: string[] = [];
    for (const item of elder.dietaryRestrictions) {
      alerts.push(`忌口：${item}`);
    }
    if (elder.diabetic) alerts.push('糖尿病餐');
    if (elder.chewingDifficulty) alerts.push('咀嚼困难（需软食）');
    if (suspension) {
      alerts.push(`家属临时停餐：${suspension.reason}`);
    }
    return alerts;
  }

  /** 一键生成某日排餐：跳过已排餐与已停餐的老人 */
  generateSchedule(date: string) {
    const created: MealOrder[] = [];
    const skippedSuspended: string[] = [];
    for (const elder of this.store.elders) {
      // 先检查停餐：即使已有（被取消的）订单，也向站点明确反馈“因停餐跳过”
      const suspended = this.store.suspensions.some(
        (s) => s.elderId === elder.id && s.date === date,
      );
      if (suspended) {
        skippedSuspended.push(elder.id);
        continue;
      }
      const exists = this.store.orders.some(
        (o) => o.elderId === elder.id && o.date === date,
      );
      if (exists) continue;
      const now = new Date().toISOString();
      const order: MealOrder = {
        id: this.store.nextId('o'),
        elderId: elder.id,
        date,
        mealType: this.suggestedMealType(elder),
        status: 'SCHEDULED',
        leftover: false,
        createdAt: now,
        updatedAt: now,
      };
      this.store.orders.push(order);
      created.push(order);
    }
    return { date, created, skippedSuspended };
  }

  /** 为单个老人排餐 */
  createOrder(elderId: string, date: string, mealType: MealType): MealOrder {
    const elder = this.store.elders.find((e) => e.id === elderId);
    if (!elder) throw new NotFoundException(`老人 ${elderId} 不存在`);
    const suspended = this.store.suspensions.find(
      (s) => s.elderId === elderId && s.date === date,
    );
    if (suspended) {
      throw new ConflictException(
        `该老人当日已被家属停餐（${suspended.reason}），如需排餐请先撤销停餐`,
      );
    }
    const exists = this.store.orders.find(
      (o) => o.elderId === elderId && o.date === date,
    );
    if (exists) throw new ConflictException('该老人当日已有排餐记录');
    const now = new Date().toISOString();
    const order: MealOrder = {
      id: this.store.nextId('o'),
      elderId,
      date,
      mealType,
      status: 'SCHEDULED',
      leftover: false,
      createdAt: now,
      updatedAt: now,
    };
    this.store.orders.push(order);
    return order;
  }

  getOrderOrThrow(orderId: string): MealOrder {
    const order = this.store.orders.find((o) => o.id === orderId);
    if (!order) throw new NotFoundException(`订单 ${orderId} 不存在`);
    return order;
  }

  /** 换餐：记录原餐型与原因，供后台统计 */
  swapMeal(orderId: string, toType: MealType, reason: string): MealOrder {
    const order = this.getOrderOrThrow(orderId);
    if (!['SCHEDULED', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      throw new BadRequestException(
        `当前状态（${order.status}）不允许换餐，仅排餐中/配送中的订单可换餐`,
      );
    }
    if (order.mealType === toType) {
      throw new BadRequestException('新餐型与当前餐型相同，无需换餐');
    }
    order.swappedFrom = order.mealType;
    order.mealType = toType;
    order.swapReason = reason;
    order.updatedAt = new Date().toISOString();
    return order;
  }

  /** 拒收：记录原因并计为剩餐 */
  rejectOrder(orderId: string, reason: string): MealOrder {
    const order = this.getOrderOrThrow(orderId);
    if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
      throw new BadRequestException(`当前状态（${order.status}）不允许拒收`);
    }
    order.status = 'REJECTED';
    order.rejectReason = reason;
    order.leftover = true; // 餐已做出未送达 → 剩餐
    order.updatedAt = new Date().toISOString();
    return order;
  }

  /** 家属停餐联动：取消当日未配送订单；当天临时停餐计为剩餐 */
  applySuspensionToOrder(elderId: string, date: string) {
    const order = this.store.orders.find(
      (o) => o.elderId === elderId && o.date === date,
    );
    if (!order) return null;
    if (!['SCHEDULED', 'OUT_FOR_DELIVERY'].includes(order.status)) {
      return null; // 已送达/已拒收等终态不受影响
    }
    order.status = 'CANCELLED';
    // 当天（或过期）临时停餐，厨房通常已备餐 → 计剩餐；提前停餐不计
    order.leftover = date <= dateString(0);
    order.updatedAt = new Date().toISOString();
    return order;
  }
}
