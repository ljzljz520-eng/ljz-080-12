import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, FamilyOnly, type AuthUser } from '../common/auth';
import { CreateSuspensionDto } from './dto';
import { MealsService } from './meals.service';

/** 家属端：只能看到自己老人的餐食记录与停餐 */
@Controller('family')
@FamilyOnly()
export class FamilyController {
  constructor(private readonly meals: MealsService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.meals.familyProfile(user);
  }

  @Get('meal-records')
  records(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.meals.familyMealRecords(user, from, to);
  }

  /** 家属临时停餐申请 */
  @Post('suspensions')
  suspend(@CurrentUser() user: AuthUser, @Body() dto: CreateSuspensionDto) {
    return this.meals.createSuspension(user, dto);
  }
}
