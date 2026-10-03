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
import { SecondConfirmDto } from './dto';
import { MealsService } from './meals.service';

/** 配送异常（老人无应答）：管家认领 + 二次确认 */
@Controller('exceptions')
export class ExceptionsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  @StaffOnly('housekeeper', 'station_admin')
  list(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.meals.listExceptions(user, status);
  }

  @Post(':id/assign')
  @StaffOnly('housekeeper')
  assign(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.meals.assignException(id, user);
  }

  @Post(':id/second-confirm')
  @StaffOnly('housekeeper')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SecondConfirmDto,
  ) {
    return this.meals.secondConfirm(id, user, dto);
  }
}

/** 站内通知：异常产生时推送给管家 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly meals: MealsService) {}

  @Get()
  @StaffOnly('housekeeper', 'station_admin', 'courier')
  list(@CurrentUser() user: AuthUser) {
    return this.meals.myNotifications(user);
  }

  @Patch(':id/read')
  @StaffOnly('housekeeper', 'station_admin', 'courier')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.meals.markNotificationRead(user, id);
  }
}
