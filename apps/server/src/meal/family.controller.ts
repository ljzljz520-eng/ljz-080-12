import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateSuspensionDto } from './dto/meal.dtos';
import { FamilyService } from './family.service';

@Controller('families')
export class FamilyController {
  constructor(private readonly family: FamilyService) {}

  /** 家属账号列表（演示环境用于选择身份） */
  @Get()
  list() {
    return this.family.listFamilies();
  }

  /** 家属端餐食记录：仅返回该家属关联老人的数据 */
  @Get(':id/meal-records')
  mealRecords(@Param('id') id: string) {
    return this.family.getMealRecords(id);
  }

  /** 家属临时停餐 */
  @Post(':id/suspensions')
  suspend(@Param('id') id: string, @Body() dto: CreateSuspensionDto) {
    return this.family.createSuspension(id, dto.elderId, dto.date, dto.reason);
  }
}
