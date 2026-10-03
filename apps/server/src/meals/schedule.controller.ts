import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, StaffOnly, type AuthUser } from '../common/auth';
import { todayStr } from '../common/date.util';
import {
  CreateMealOrderDto,
  DispatchDto,
  MarkLeftoverDto,
  RejectMealDto,
  SwapMealDto,
} from './dto';
import { MealsService } from './meals.service';

/** 站点排餐：看板 / 排餐 / 换餐 / 剩餐 / 拒收 / 派单 */
@Controller('stations/:stationId')
export class ScheduleController {
  constructor(private readonly meals: MealsService) {}

  /** 排餐看板：老人忌口、糖尿病餐、咀嚼困难、家属临时停餐说明一屏可见 */
  @Get('meal-board')
  @StaffOnly('station_admin', 'housekeeper')
  mealBoard(
    @CurrentUser() user: AuthUser,
    @Param('stationId', ParseIntPipe) stationId: number,
    @Query('date') date?: string,
  ) {
    return this.meals.getMealBoard(stationId, date || todayStr());
  }

  @Post('meal-orders')
  @StaffOnly('station_admin')
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateMealOrderDto) {
    return this.meals.createMealOrder(user, dto);
  }

  @Patch('meal-orders/:id/swap')
  @StaffOnly('station_admin')
  swap(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SwapMealDto,
  ) {
    return this.meals.swapMeal(id, user, dto);
  }

  @Patch('meal-orders/:id/leftover')
  @StaffOnly('station_admin', 'housekeeper')
  leftover(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkLeftoverDto,
  ) {
    return this.meals.markLeftover(id, user, dto);
  }

  @Patch('meal-orders/:id/reject')
  @StaffOnly('station_admin', 'housekeeper')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectMealDto,
  ) {
    return this.meals.rejectMeal(id, user, dto);
  }

  @Post('meal-orders/:id/dispatch')
  @StaffOnly('station_admin')
  dispatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DispatchDto,
  ) {
    return this.meals.dispatch(id, user, dto.courierId);
  }
}
