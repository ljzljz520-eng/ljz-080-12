import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 站点排餐（午餐） */
export class CreateMealOrderDto {
  @IsInt()
  @Min(1)
  elderId!: number;

  @Matches(DATE_RE, { message: 'mealDate 格式应为 YYYY-MM-DD' })
  mealDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  menuText!: string;

  /** 不传时按老人档案自动推导（糖尿病餐/软食） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietTags?: string[];
}

/** 换餐 */
export class SwapMealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  menuText!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  swapNote!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dietTags?: string[];
}

/** 标记剩餐 */
export class MarkLeftoverDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

/** 标记拒收 */
export class RejectMealDto {
  @IsString()
  @IsNotEmpty({ message: '拒收必须填写原因' })
  @MaxLength(200)
  reason!: string;
}

/** 派单给配送员 */
export class DispatchDto {
  @IsInt()
  @Min(1)
  courierId!: number;
}

/** 配送员扫码签收 */
export class ScanSignDto {
  @IsString()
  @IsNotEmpty({ message: '请扫描老人门口的签收二维码' })
  qrCode!: string;
}

/** 配送员上报老人无应答 */
export class NoResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

/** 异常认领 */
export class AssignExceptionDto {
  @IsInt()
  @Min(1)
  housekeeperId!: number;
}

/** 管家二次确认 */
export class SecondConfirmDto {
  @IsIn(['reschedule', 'recycle', 'cancel'], {
    message:
      'result 仅支持 reschedule(补送) / recycle(回收记剩餐) / cancel(取消订餐)',
  })
  result!: 'reschedule' | 'recycle' | 'cancel';

  @IsString()
  @IsNotEmpty({ message: '二次确认必须填写确认说明' })
  @MaxLength(300)
  note!: string;
}

/** 家属临时停餐 */
export class CreateSuspensionDto {
  @Matches(DATE_RE, { message: 'startDate 格式应为 YYYY-MM-DD' })
  startDate!: string;

  @Matches(DATE_RE, { message: 'endDate 格式应为 YYYY-MM-DD' })
  endDate!: string;

  @IsString()
  @IsNotEmpty({ message: '请填写停餐原因' })
  @MaxLength(200)
  reason!: string;
}

/** 批量排餐 */
export class BatchScheduleDto {
  @Matches(DATE_RE, { message: 'mealDate 格式应为 YYYY-MM-DD' })
  mealDate!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  elderIds!: number[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  menuText!: string;
}
