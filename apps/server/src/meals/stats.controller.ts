import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser, StaffOnly, type AuthUser } from '../common/auth';
import { todayStr } from '../common/date.util';
import { MealsService } from './meals.service';

/** 后台统计：每日剩餐 / 换餐 / 拒收原因 / 无应答异常 */
@Controller('stats')
export class StatsController {
  constructor(private readonly meals: MealsService) {}

  @Get('daily')
  @StaffOnly('station_admin', 'housekeeper')
  daily(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.meals.dailyStats(user.stationId!, date || todayStr());
  }

  @Get('daily/:stationId')
  @StaffOnly('station_admin')
  dailyByStation(
    @Param('stationId', ParseIntPipe) stationId: number,
    @Query('date') date?: string,
  ) {
    return this.meals.dailyStats(stationId, date || todayStr());
  }
}
