import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '../common/auth';
import { DatabaseModule } from '../database/database.module';
import { DeliveriesController } from './deliveries.controller';
import {
  ExceptionsController,
  NotificationsController,
} from './exceptions.controller';
import { FamilyController } from './family.controller';
import { MealsService } from './meals.service';
import { MetaController } from './meta.controller';
import { ScheduleController } from './schedule.controller';
import { StatsController } from './stats.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    ScheduleController,
    DeliveriesController,
    ExceptionsController,
    NotificationsController,
    StatsController,
    FamilyController,
    MetaController,
  ],
  providers: [MealsService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class MealsModule {}
