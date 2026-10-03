import { Controller, Get, Query } from '@nestjs/common';
import { DateQueryDto } from './dto/meal.dtos';
import { dateString } from './meal.store';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  /** 每日助餐统计：剩餐、换餐、拒收原因 */
  @Get('daily')
  daily(@Query() query: DateQueryDto) {
    return this.stats.daily(query.date ?? dateString(0));
  }
}
