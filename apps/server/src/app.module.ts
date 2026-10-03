import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MealsModule } from './meals/meals.module';

@Module({
  imports: [DatabaseModule, MealsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
