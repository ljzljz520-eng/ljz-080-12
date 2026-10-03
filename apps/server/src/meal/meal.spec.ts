import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { ExceptionsService } from './exceptions.service';
import { FamilyService } from './family.service';
import { dateString, MealStore } from './meal.store';
import { ScheduleService } from './schedule.service';
import { StatsService } from './stats.service';

describe('助餐模块', () => {
  let store: MealStore;
  let schedule: ScheduleService;
  let delivery: DeliveryService;
  let exceptions: ExceptionsService;
  let stats: StatsService;
  let family: FamilyService;

  const today = dateString(0);
  const tomorrow = dateString(1);

  beforeEach(() => {
    store = new MealStore();
    schedule = new ScheduleService(store);
    delivery = new DeliveryService(store);
    exceptions = new ExceptionsService(store);
    stats = new StatsService(store);
    family = new FamilyService(store, schedule);
  });

  describe('站点排餐视图', () => {
    it('排餐时能看到忌口、糖尿病餐、咀嚼困难标签', () => {
      const rows = schedule.getSchedule(today);
      const zhang = rows.find((r) => r.elder.id === 'e1')!;
      expect(zhang.dietaryAlerts).toContain('忌口：海鲜过敏');
      expect(zhang.dietaryAlerts).toContain('糖尿病餐');
      expect(zhang.dietaryAlerts).toContain('咀嚼困难（需软食）');
    });

    it('排餐时能看到家属临时停餐说明', () => {
      const rows = schedule.getSchedule(today);
      const zhang = rows.find((r) => r.elder.id === 'e1')!;
      expect(zhang.suspension).not.toBeNull();
      expect(zhang.suspension!.reason).toContain('复查');
      expect(
        zhang.dietaryAlerts.some((a) => a.startsWith('家属临时停餐')),
      ).toBe(true);
      expect(zhang.order!.status).toBe('CANCELLED');
    });

    it('根据健康标签推导建议餐型', () => {
      const rows = schedule.getSchedule(today);
      expect(rows.find((r) => r.elder.id === 'e1')!.suggestedMealType).toBe(
        'SOFT',
      );
      expect(rows.find((r) => r.elder.id === 'e4')!.suggestedMealType).toBe(
        'DIABETIC',
      );
      expect(rows.find((r) => r.elder.id === 'e2')!.suggestedMealType).toBe(
        'REGULAR',
      );
    });

    it('一键生成排餐时自动跳过已停餐老人', () => {
      const res = schedule.generateSchedule(today);
      expect(res.created).toHaveLength(0); // 今日已排
      expect(res.skippedSuspended).toEqual(['e1']);

      const res2 = schedule.generateSchedule(tomorrow);
      expect(res2.created).toHaveLength(6); // 明天无停餐
    });

    it('已停餐老人不能重复排餐', () => {
      expect(() => schedule.createOrder('e1', today, 'SOFT')).toThrow(
        ConflictException,
      );
    });
  });

  describe('换餐与拒收', () => {
    it('换餐记录原餐型与原因', () => {
      const order = store.orders.find(
        (o) => o.elderId === 'e2' && o.date === today,
      )!;
      const swapped = schedule.swapMeal(order.id, 'SOFT', '牙口不适');
      expect(swapped.swappedFrom).toBe('REGULAR');
      expect(swapped.mealType).toBe('SOFT');
      expect(swapped.swapReason).toBe('牙口不适');
    });

    it('已送达订单不能换餐', () => {
      const order = store.orders.find(
        (o) => o.elderId === 'e2' && o.date === today,
      )!;
      order.status = 'DELIVERED';
      expect(() => schedule.swapMeal(order.id, 'SOFT', 'x')).toThrow(
        BadRequestException,
      );
    });

    it('拒收记录原因并计入剩餐', () => {
      const order = store.orders.find(
        (o) => o.elderId === 'e2' && o.date === today,
      )!;
      const rejected = schedule.rejectOrder(order.id, '老人已在外就餐');
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectReason).toBe('老人已在外就餐');
      expect(rejected.leftover).toBe(true);
    });
  });

  describe('配送扫码签收', () => {
    function dispatchToday() {
      return delivery.dispatch(today, 'st-courier1').created;
    }

    it('出餐后生成配送任务与签收码', () => {
      const created = dispatchToday();
      expect(created).toHaveLength(5); // e1 已停餐
      expect(created.every((d) => d.qrToken.startsWith('QR-'))).toBe(true);
      const order = store.orders.find((o) => o.id === created[0].orderId)!;
      expect(order.status).toBe('OUT_FOR_DELIVERY');
    });

    it('扫码签收后订单完成', () => {
      const [d] = dispatchToday();
      const signed = delivery.scanSign(d.qrToken);
      expect(signed.status).toBe('SIGNED');
      expect(signed.order!.status).toBe('DELIVERED');
      expect(signed.signChannel).toBe('QR_SCAN');
    });

    it('无效签收码报错，重复签收被拒', () => {
      const [d] = dispatchToday();
      expect(() => delivery.scanSign('QR-INVALID')).toThrow(NotFoundException);
      delivery.scanSign(d.qrToken);
      expect(() => delivery.scanSign(d.qrToken)).toThrow(ConflictException);
    });

    it('老人未应答不能直接算完成，自动生成异常工单给管家', () => {
      const [d] = dispatchToday();
      const { delivery: d2, exception } = delivery.reportNoResponse(
        d.id,
        '敲门无人应答',
      );
      expect(d2.status).toBe('NO_RESPONSE');
      expect(d2.order!.status).toBe('NO_RESPONSE');
      expect(d2.order!.status).not.toBe('DELIVERED');
      expect(exception.status).toBe('OPEN');
      expect(exception.assigneeId).toBe('st-hk1');
      // 未应答的配送单不能直接扫码签收
      expect(() => delivery.scanSign(d.qrToken)).toThrow(ConflictException);
    });
  });

  describe('管家二次确认', () => {
    function makeExceptions(count = 1) {
      let created = delivery.dispatch(today, 'st-courier1').created;
      if (created.length < count) {
        // 订单已出餐时，从仍在待配送的配送单中取
        created = store.deliveries.filter((d) => d.status === 'PENDING');
      }
      for (const d of created.slice(0, count)) {
        delivery.reportNoResponse(d.id);
      }
      return store.exceptions.slice(-count);
    }

    it('确认已送达：订单完成，签收渠道为管家确认', () => {
      const [ex] = makeExceptions();
      const res = exceptions.confirm(
        ex.id,
        'st-hk1',
        'PHONE',
        'DELIVERED_CONFIRMED',
        '电话确认老人已取到餐',
      );
      expect(res.status).toBe('RESOLVED');
      expect(res.order!.status).toBe('DELIVERED');
      expect(res.delivery!.signChannel).toBe('HOUSEKEEPER_CONFIRM');
    });

    it('安排重新配送：配送单回到待配送并换新签收码', () => {
      const [ex] = makeExceptions();
      const oldToken = ex.deliveryId;
      const res = exceptions.confirm(ex.id, 'st-hk1', 'VISIT', 'REDELIVER');
      expect(res.delivery!.status).toBe('PENDING');
      expect(res.order!.status).toBe('OUT_FOR_DELIVERY');
      expect(res.delivery!.qrToken).not.toBe(oldToken);
    });

    it('确认取消：订单取消并计入剩餐', () => {
      const [ex] = makeExceptions();
      const res = exceptions.confirm(ex.id, 'st-hk1', 'FAMILY_CONTACT', 'CANCELLED');
      expect(res.order!.status).toBe('CANCELLED');
      expect(res.order!.leftover).toBe(true);
      expect(res.delivery!.status).toBe('CLOSED');
    });

    it('已闭环工单不能重复确认，非管家不能确认', () => {
      const [ex] = makeExceptions();
      exceptions.confirm(ex.id, 'st-hk1', 'PHONE', 'DELIVERED_CONFIRMED');
      expect(() =>
        exceptions.confirm(ex.id, 'st-hk1', 'PHONE', 'CANCELLED'),
      ).toThrow(BadRequestException);

      const [ex2] = makeExceptions();
      expect(() =>
        exceptions.confirm(ex2.id, 'st-courier1', 'PHONE', 'CANCELLED'),
      ).toThrow(BadRequestException);
    });
  });

  describe('每日统计', () => {
    it('统计剩餐、换餐与拒收原因', () => {
      const orders = store.orders.filter((o) => o.date === today);
      const o2 = orders.find((o) => o.elderId === 'e2')!;
      const o3 = orders.find((o) => o.elderId === 'e3')!;
      schedule.swapMeal(o2.id, 'SOFT', '牙口不适');
      schedule.rejectOrder(o3.id, '老人已在外就餐');

      const s = stats.daily(today);
      expect(s.totalOrders).toBe(6);
      expect(s.swapCount).toBe(2); // e4 种子换餐 + 本次
      expect(s.rejected).toBe(1);
      expect(s.rejectionReasons).toEqual([
        { reason: '老人已在外就餐', count: 1 },
      ]);
      // 剩餐：e1 停餐取消 + e3 拒收
      expect(s.leftoverCount).toBe(2);
      expect(s.suspensionCount).toBe(1);
    });
  });

  describe('家属端', () => {
    it('家属只能看到自己老人的餐食记录', () => {
      const res = family.getMealRecords('f1');
      expect(res.records.length).toBeGreaterThan(0);
      expect(new Set(res.records.map((r) => r.elderId))).toEqual(
        new Set(['e1']),
      );

      const res3 = family.getMealRecords('f3');
      expect(new Set(res3.records.map((r) => r.elderId))).toEqual(
        new Set(['e3', 'e6']),
      );
    });

    it('家属不能给其他人家老人停餐', () => {
      expect(() =>
        family.createSuspension('f1', 'e2', tomorrow, '测试'),
      ).toThrow(ForbiddenException);
    });

    it('当天临时停餐会取消订单并计入剩餐', () => {
      family.createSuspension('f2', 'e2', today, '临时外出');
      const order = store.orders.find(
        (o) => o.elderId === 'e2' && o.date === today,
      )!;
      expect(order.status).toBe('CANCELLED');
      expect(order.leftover).toBe(true);
    });

    it('未来日期停餐不计剩餐，且重复停餐被拒', () => {
      schedule.generateSchedule(tomorrow);
      family.createSuspension('f2', 'e2', tomorrow, '明天体检');
      const order = store.orders.find(
        (o) => o.elderId === 'e2' && o.date === tomorrow,
      )!;
      expect(order.status).toBe('CANCELLED');
      expect(order.leftover).toBe(false);
      expect(() =>
        family.createSuspension('f2', 'e2', tomorrow, '重复提交'),
      ).toThrow(ForbiddenException);
    });
  });
});
