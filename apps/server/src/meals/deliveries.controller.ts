import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, StaffOnly, type AuthUser } from '../common/auth';
import { todayStr } from '../common/date.util';
import { NoResponseDto, ScanSignDto } from './dto';
import { MealsService } from './meals.service';

/** 配送员端：任务列表 / 扫码签收 / 无应答上报 */
@Controller('courier')
export class DeliveriesController {
  constructor(private readonly meals: MealsService) {}

  @Get('deliveries')
  @StaffOnly('courier')
  tasks(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.meals.courierTasks(user, date || todayStr());
  }

  /** 送到门口扫码签收，二维码与老人档案不匹配则拒绝 */
  @Post('deliveries/:id/scan-sign')
  @StaffOnly('courier')
  scanSign(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ScanSignDto,
  ) {
    return this.meals.scanSign(id, user, dto);
  }

  /** 老人无应答：不能直接算完成，转异常并通知管家二次确认 */
  @Post('deliveries/:id/no-response')
  @StaffOnly('courier')
  noResponse(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NoResponseDto,
  ) {
    return this.meals.reportNoResponse(id, user, dto.note);
  }
}
