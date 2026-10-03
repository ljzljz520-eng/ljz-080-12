import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ConfirmExceptionDto } from './dto/meal.dtos';
import { ExceptionsService } from './exceptions.service';

@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly exceptions: ExceptionsService) {}

  /** 异常工单列表（管家工作台） */
  @Get()
  list(@Query('status') status?: 'OPEN' | 'RESOLVED') {
    return this.exceptions.list(status);
  }

  /** 管家二次确认：确认送达 / 重新配送 / 取消 */
  @Post(':id/confirm')
  confirm(@Param('id') id: string, @Body() dto: ConfirmExceptionDto) {
    return this.exceptions.confirm(
      id,
      'st-hk1',
      dto.method,
      dto.result,
      dto.note,
    );
  }
}
