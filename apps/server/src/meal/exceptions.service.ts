import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MealStore } from './meal.store';
import { ConfirmMethod, ConfirmResult, DeliveryException } from './meal.types';

@Injectable()
export class ExceptionsService {
  constructor(private readonly store: MealStore) {}

  /** 异常工单列表（管家工作台），附带老人/订单/配送信息 */
  list(status?: 'OPEN' | 'RESOLVED') {
    return this.store.exceptions
      .filter((e) => !status || e.status === status)
      .map((e) => this.enrich(e));
  }

  getOrThrow(id: string): DeliveryException {
    const exception = this.store.exceptions.find((e) => e.id === id);
    if (!exception) throw new NotFoundException(`异常工单 ${id} 不存在`);
    return exception;
  }

  /**
   * 管家二次确认：
   * - DELIVERED_CONFIRMED：确认老人已收到餐 → 订单完成
   * - REDELIVER：安排重新配送 → 生成新签收码，配送单回到待配送
   * - CANCELLED：确认取消 → 订单取消并计入剩餐
   */
  confirm(
    id: string,
    by: string,
    method: ConfirmMethod,
    result: ConfirmResult,
    note?: string,
  ) {
    const exception = this.getOrThrow(id);
    if (exception.status === 'RESOLVED') {
      throw new BadRequestException('该异常工单已处理完毕');
    }
    const housekeeper = this.store.staff.find(
      (s) => s.id === by && s.role === 'HOUSEKEEPER',
    );
    if (!housekeeper) {
      throw new BadRequestException('仅管家可执行二次确认');
    }

    const now = new Date().toISOString();
    exception.confirmations.push({ at: now, by, method, result, note });
    exception.status = 'RESOLVED';
    exception.resolvedAt = now;

    const delivery = this.store.deliveries.find(
      (d) => d.id === exception.deliveryId,
    )!;
    const order = this.store.orders.find((o) => o.id === exception.orderId)!;

    switch (result) {
      case 'DELIVERED_CONFIRMED':
        delivery.status = 'SIGNED';
        delivery.signedAt = now;
        delivery.signChannel = 'HOUSEKEEPER_CONFIRM';
        order.status = 'DELIVERED';
        break;
      case 'REDELIVER':
        delivery.status = 'PENDING';
        delivery.qrToken = `QR-${randomBytes(6).toString('hex').toUpperCase()}`;
        order.status = 'OUT_FOR_DELIVERY';
        break;
      case 'CANCELLED':
        delivery.status = 'CLOSED';
        order.status = 'CANCELLED';
        order.leftover = true; // 餐已送出未送达 → 剩餐
        break;
    }
    order.updatedAt = now;
    return this.enrich(exception);
  }

  private enrich(exception: DeliveryException) {
    const elder = this.store.elders.find((e) => e.id === exception.elderId);
    const order = this.store.orders.find((o) => o.id === exception.orderId);
    const delivery = this.store.deliveries.find(
      (d) => d.id === exception.deliveryId,
    );
    const assignee = this.store.staff.find(
      (s) => s.id === exception.assigneeId,
    );
    return { ...exception, elder, order, delivery, assignee };
  }
}
