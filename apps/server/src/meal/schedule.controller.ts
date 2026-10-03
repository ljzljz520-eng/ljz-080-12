import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateOrderDto,
  DateQueryDto,
  GenerateScheduleDto,
  RejectOrderDto,
  SwapMealDto,
} from './dto/meal.dtos';
import { dateString, MealStore } from './meal.store';
import { ScheduleService } from './schedule.service';

@Controller()
export class ScheduleController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly store: MealStore,
  ) {}

  /**
   * 站点排餐视图：每位老人一行，
   * 含忌口、糖尿病餐、咀嚼困难标签与家属临时停餐说明。
   */
  @Get('schedule')
  getSchedule(@Query() query: DateQueryDto) {
    const date = query.date ?? dateString(0);
    return { date, rows: this.schedule.getSchedule(date) };
  }

  /** 一键生成某日排餐（自动跳过已停餐老人） */
  @Post('schedule/generate')
  generate(@Body() dto: GenerateScheduleDto) {
    return this.schedule.generateSchedule(dto.date);
  }

  /** 为单个老人排餐 */
  @Post('schedule/orders')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.schedule.createOrder(dto.elderId, dto.date, dto.mealType);
  }

  /** 换餐（记录原餐型与原因） */
  @Patch('orders/:id/swap')
  swap(@Param('id') id: string, @Body() dto: SwapMealDto) {
    return this.schedule.swapMeal(id, dto.mealType, dto.reason);
  }

  /** 老人拒收（记录原因，计入剩餐） */
  @Post('orders/:id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectOrderDto) {
    return this.schedule.rejectOrder(id, dto.reason);
  }

  /** 家属停餐记录（站点只读查看） */
  @Get('suspensions')
  listSuspensions(@Query() query: DateQueryDto) {
    const date = query.date;
    return date
      ? this.store.suspensions.filter((s) => s.date === date)
      : this.store.suspensions;
  }
}
