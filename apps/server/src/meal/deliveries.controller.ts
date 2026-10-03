import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import {
  DateQueryDto,
  DispatchDto,
  NoResponseDto,
  ScanSignDto,
} from './dto/meal.dtos';
import { dateString } from './meal.store';

@Controller('deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveryService) {}

  /** 站点出餐：为当日已排餐订单生成配送任务与签收二维码 */
  @Post('dispatch')
  dispatch(@Body() dto: DispatchDto) {
    return this.deliveries.dispatch(dto.date, dto.courierId);
  }

  /** 配送任务列表（配送员端 / 站点端） */
  @Get()
  list(@Query() query: DateQueryDto, @Query('courierId') courierId?: string) {
    const date = query.date ?? dateString(0);
    return this.deliveries.list(date, courierId);
  }

  /** 扫码后查询配送单（H5 签收页） */
  @Get('by-token/:token')
  byToken(@Param('token') token: string) {
    return this.deliveries.findByToken(token);
  }

  /** 扫码签收 */
  @Post('scan')
  scan(@Body() dto: ScanSignDto) {
    return this.deliveries.scanSign(dto.qrToken);
  }

  /** 老人未应答：订单不计完成，自动生成异常工单给管家 */
  @Post(':id/no-response')
  noResponse(@Param('id') id: string, @Body() dto: NoResponseDto) {
    return this.deliveries.reportNoResponse(id, dto.note);
  }
}
