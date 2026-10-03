import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { MealStore } from './meal.store';
import type { StaffRole } from './meal.types';

@Controller()
export class DirectoryController {
  constructor(private readonly store: MealStore) {}

  /** 老人档案（含忌口 / 糖尿病餐 / 咀嚼困难标签） */
  @Get('elders')
  listElders() {
    return this.store.elders;
  }

  @Get('elders/:id')
  getElder(@Param('id') id: string) {
    const elder = this.store.elders.find((e) => e.id === id);
    if (!elder) throw new NotFoundException(`老人 ${id} 不存在`);
    return elder;
  }

  /** 员工目录（管家 / 配送员 / 站长） */
  @Get('staff')
  listStaff(@Query('role') role?: StaffRole) {
    return role
      ? this.store.staff.filter((s) => s.role === role)
      : this.store.staff;
  }
}
