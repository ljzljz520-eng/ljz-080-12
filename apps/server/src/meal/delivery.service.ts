import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { MealStore } from './meal.store';
import { Delivery, DeliveryException } from './meal.types';

@Injectable()
export class DeliveryService {
  constructor(private readonly store: MealStore) {}

  /** 站点出餐：为当日“已排餐”的订单生成配送任务与签收二维码令牌 */
  dispatch(date: string, courierId: string) {
    const courier = this.store.staff.find(
      (s) => s.id === courierId && s.role === 'COURIER',
    );
    if (!courier) throw new NotFoundException(`配送员 ${courierId} 不存在`);
    const orders = this.store.orders.filter(
      (o) => o.date === date && o.status === 'SCHEDULED',
    );
    const created: Delivery[] = [];
    for (const order of orders) {
      const delivery: Delivery = {
        id: this.store.nextId('d'),
        orderId: order.id,
        elderId: order.elderId,
        courierId,
        qrToken: `QR-${randomBytes(6).toString('hex').toUpperCase()}`,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      this.store.deliveries.push(delivery);
      order.status = 'OUT_FOR_DELIVERY';
      order.updatedAt = new Date().toISOString();
      created.push(delivery);
    }
    return { date, courierId, created };
  }

  /** 配送任务列表（可按配送员/日期过滤），附带老人与订单信息 */
  list(date?: string, courierId?: string) {
    return this.store.deliveries
      .filter((d) => !date || this.orderOf(d).date === date)
      .filter((d) => !courierId || d.courierId === courierId)
      .map((d) => this.enrich(d));
  }

  findByToken(qrToken: string) {
    const delivery = this.store.deliveries.find(
      (d) => d.qrToken === qrToken.trim(),
    );
    if (!delivery)
      throw new NotFoundException('签收码无效，未找到对应配送任务');
    return this.enrich(delivery);
  }

  getOrThrow(deliveryId: string): Delivery {
    const delivery = this.store.deliveries.find((d) => d.id === deliveryId);
    if (!delivery) throw new NotFoundException(`配送任务 ${deliveryId} 不存在`);
    return delivery;
  }

  /**
   * 扫码签收：配送员到门口扫描老人门口的签收码。
   * 仅 PENDING 状态可签收；存在未应答异常的配送单必须先由管家二次确认。
   */
  scanSign(qrToken: string) {
    const delivery = this.store.deliveries.find(
      (d) => d.qrToken === qrToken.trim(),
    );
    if (!delivery)
      throw new NotFoundException('签收码无效，未找到对应配送任务');
    if (delivery.status === 'SIGNED') {
      throw new ConflictException('该配送单已签收，请勿重复扫码');
    }
    if (delivery.status === 'NO_RESPONSE') {
      throw new ConflictException(
        '该配送单存在“老人未应答”异常，需管家二次确认后才能完成，不能直接签收',
      );
    }
    if (delivery.status === 'CLOSED') {
      throw new ConflictException('该配送单已关闭（订单已取消）');
    }
    const now = new Date().toISOString();
    delivery.status = 'SIGNED';
    delivery.signedAt = now;
    delivery.signChannel = 'QR_SCAN';
    const order = this.orderOf(delivery);
    order.status = 'DELIVERED';
    order.updatedAt = now;
    return this.enrich(delivery);
  }

  /**
   * 老人未应答：配送员上报后，订单不进入完成态，
   * 自动生成异常工单并指派给管家安排二次确认。
   */
  reportNoResponse(deliveryId: string, note?: string) {
    const delivery = this.getOrThrow(deliveryId);
    if (delivery.status !== 'PENDING') {
      throw new BadRequestException(
        `当前状态（${delivery.status}）不允许上报未应答`,
      );
    }
    const now = new Date().toISOString();
    delivery.status = 'NO_RESPONSE';
    const order = this.orderOf(delivery);
    order.status = 'NO_RESPONSE'; // 注意：不是 DELIVERED，不能算完成
    order.updatedAt = now;

    const housekeeper = this.store.staff.find((s) => s.role === 'HOUSEKEEPER');
    if (!housekeeper)
      throw new NotFoundException('未配置管家，无法指派异常工单');
    const exception: DeliveryException = {
      id: this.store.nextId('ex'),
      deliveryId: delivery.id,
      orderId: order.id,
      elderId: delivery.elderId,
      reason: 'NO_RESPONSE',
      note,
      status: 'OPEN',
      assigneeId: housekeeper.id,
      createdAt: now,
      confirmations: [],
    };
    this.store.exceptions.push(exception);
    return { delivery: this.enrich(delivery), exception };
  }

  private orderOf(delivery: Delivery) {
    const order = this.store.orders.find((o) => o.id === delivery.orderId);
    if (!order) throw new NotFoundException('配送任务关联的订单不存在');
    return order;
  }

  private enrich(delivery: Delivery) {
    const order = this.orderOf(delivery);
    const elder = this.store.elders.find((e) => e.id === delivery.elderId);
    return { ...delivery, order, elder };
  }
}
