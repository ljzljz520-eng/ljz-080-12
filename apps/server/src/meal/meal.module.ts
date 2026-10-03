import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { DeliveryService } from './delivery.service';
import { DirectoryController } from './elders.controller';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsService } from './exceptions.service';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';
import { MealStore } from './meal.store';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [
    DirectoryController,
    ScheduleController,
    DeliveriesController,
    ExceptionsController,
    StatsController,
    FamilyController,
  ],
  providers: [
    MealStore,
    ScheduleService,
    DeliveryService,
    ExceptionsService,
    StatsService,
    FamilyService,
  ],
})
export class MealModule {}
