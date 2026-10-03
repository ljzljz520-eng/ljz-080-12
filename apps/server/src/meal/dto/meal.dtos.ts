import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import type { ConfirmMethod, ConfirmResult, MealType } from '../meal.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class DateQueryDto {
  @IsOptional()
  @Matches(DATE_RE, { message: 'date 格式应为 YYYY-MM-DD' })
  date?: string;
}

export class GenerateScheduleDto {
  @IsNotEmpty()
  @Matches(DATE_RE, { message: 'date 格式应为 YYYY-MM-DD' })
  date: string;
}

export class CreateOrderDto {
  @IsNotEmpty()
  elderId: string;

  @IsNotEmpty()
  @Matches(DATE_RE, { message: 'date 格式应为 YYYY-MM-DD' })
  date: string;

  @IsIn(['REGULAR', 'DIABETIC', 'SOFT'])
  mealType: MealType;
}

export class SwapMealDto {
  @IsIn(['REGULAR', 'DIABETIC', 'SOFT'])
  mealType: MealType;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class RejectOrderDto {
  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class DispatchDto {
  @IsNotEmpty()
  @Matches(DATE_RE, { message: 'date 格式应为 YYYY-MM-DD' })
  date: string;

  @IsNotEmpty()
  courierId: string;
}

export class ScanSignDto {
  @IsNotEmpty()
  @IsString()
  qrToken: string;
}

export class NoResponseDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmExceptionDto {
  @IsIn(['PHONE', 'VISIT', 'FAMILY_CONTACT'])
  method: ConfirmMethod;

  @IsIn(['DELIVERED_CONFIRMED', 'REDELIVER', 'CANCELLED'])
  result: ConfirmResult;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateSuspensionDto {
  @IsNotEmpty()
  elderId: string;

  @IsNotEmpty()
  @Matches(DATE_RE, { message: 'date 格式应为 YYYY-MM-DD' })
  date: string;

  @IsNotEmpty()
  @IsString()
  reason: string;
}
