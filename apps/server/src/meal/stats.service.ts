import { Injectable } from '@nestjs/common';
import { MealStore } from './meal.store';

export interface ReasonCount {
  reason: string;
  count: number;
}

export interface DailyStats {
  date: string;
  totalOrders: number; // 当日排餐总数
  delivered: number; // 已送达
  outForDelivery: number; // 配送中
  scheduled: number; // 待配送
  noResponse: number; // 未应答异常中
  cancelled: number; // 已取消（含家属停餐）
  rejected: number; // 拒收
  leftoverCount: number; // 剩餐数
  swapCount: number; // 换餐数
  suspensionCount: number; // 家属临时停餐数
  rejectionReasons: ReasonCount[]; // 拒收原因分布
  leftoverSources: ReasonCount[]; // 剩餐来源分布
}

@Injectable()
export class StatsService {
  constructor(private readonly store: MealStore) {}

  /** 每日助餐统计：剩餐、换餐、拒收原因等 */
  daily(date: string): DailyStats {
    const orders = this.store.orders.filter((o) => o.date === date);
    const count = (status: string) =>
      orders.filter((o) => o.status === status).length;

    const rejectionReasons = this.groupByReason(
      orders
        .filter((o) => o.status === 'REJECTED')
        .map((o) => o.rejectReason ?? '未填写原因'),
    );

    const leftoverOrders = orders.filter((o) => o.leftover);
    const leftoverSources = this.groupByReason(
      leftoverOrders.map((o) => {
        if (o.status === 'REJECTED') return '拒收';
        if (o.status === 'CANCELLED') return '取消/临时停餐';
        return '其他';
      }),
    );

    return {
      date,
      totalOrders: orders.length,
      delivered: count('DELIVERED'),
      outForDelivery: count('OUT_FOR_DELIVERY'),
      scheduled: count('SCHEDULED'),
      noResponse: count('NO_RESPONSE'),
      cancelled: count('CANCELLED'),
      rejected: count('REJECTED'),
      leftoverCount: leftoverOrders.length,
      swapCount: orders.filter((o) => o.swappedFrom).length,
      suspensionCount: this.store.suspensions.filter((s) => s.date === date)
        .length,
      rejectionReasons,
      leftoverSources,
    };
  }

  private groupByReason(reasons: string[]): ReasonCount[] {
    const map = new Map<string, number>();
    for (const r of reasons) map.set(r, (map.get(r) ?? 0) + 1);
    return [...map.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }
}
