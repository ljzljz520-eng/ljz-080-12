import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MealStore } from './meal.store';
import { MealSuspension } from './meal.types';
import { ScheduleService } from './schedule.service';

@Injectable()
export class FamilyService {
  constructor(
    private readonly store: MealStore,
    private readonly schedule: ScheduleService,
  ) {}

  /** 家属列表（演示环境用于选择登录身份） */
  listFamilies() {
    return this.store.familyMembers.map((f) => ({
      ...f,
      elders: this.store.elders.filter((e) => f.elderIds.includes(e.id)),
    }));
  }

  getFamilyOrThrow(familyId: string) {
    const family = this.store.familyMembers.find((f) => f.id === familyId);
    if (!family) throw new NotFoundException(`家属账号 ${familyId} 不存在`);
    return family;
  }

  /**
   * 家属端餐食记录：仅返回该家属关联老人的数据，
   * 数据隔离在服务端强制执行，前端无法越权获取其他老人的记录。
   */
  getMealRecords(familyId: string) {
    const family = this.getFamilyOrThrow(familyId);
    const myElderIds = new Set(family.elderIds);
    const records = this.store.orders
      .filter((o) => myElderIds.has(o.elderId))
      .map((o) => {
        const elder = this.store.elders.find((e) => e.id === o.elderId)!;
        const suspension = this.store.suspensions.find(
          (s) => s.elderId === o.elderId && s.date === o.date,
        );
        const delivery = this.store.deliveries.find((d) => d.orderId === o.id);
        return {
          ...o,
          elderName: elder.name,
          suspensionReason: suspension?.reason ?? null,
          signedAt: delivery?.signedAt ?? null,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    return {
      family: { id: family.id, name: family.name, relation: family.relation },
      elders: this.store.elders.filter((e) => myElderIds.has(e.id)),
      records,
    };
  }

  /** 家属临时停餐：只能为自己关联的老人提交 */
  createSuspension(
    familyId: string,
    elderId: string,
    date: string,
    reason: string,
  ): MealSuspension {
    const family = this.getFamilyOrThrow(familyId);
    if (!family.elderIds.includes(elderId)) {
      throw new ForbiddenException('只能为自家老人申请停餐');
    }
    const duplicated = this.store.suspensions.find(
      (s) => s.elderId === elderId && s.date === date,
    );
    if (duplicated) {
      throw new ForbiddenException('该日期已提交过停餐，请勿重复申请');
    }
    const suspension: MealSuspension = {
      id: this.store.nextId('sus'),
      elderId,
      date,
      reason,
      familyId,
      createdAt: new Date().toISOString(),
    };
    this.store.suspensions.push(suspension);
    // 联动取消当日未配送订单（当天临时停餐会计入剩餐）
    this.schedule.applySuspensionToOrder(elderId, date);
    return suspension;
  }
}
