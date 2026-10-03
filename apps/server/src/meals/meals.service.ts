import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthUser } from '../common/auth';
import { toDateStr } from '../common/date.util';
import {
  CreateMealOrderDto,
  CreateSuspensionDto,
  MarkLeftoverDto,
  RejectMealDto,
  ScanSignDto,
  SecondConfirmDto,
  SwapMealDto,
} from './dto';

/** 站点排餐看板行：老人档案 + 当日停餐 + 当日餐单/配送 */
export interface MealBoardRow {
  elder: {
    id: number;
    name: string;
    roomNo: string | null;
    age: number | null;
    dietaryRestrictions: string[];
    diabetic: boolean;
    chewingDifficulty: boolean;
    notes: string | null;
    qrCode: string;
  };
  suspension: {
    id: number;
    startDate: string;
    endDate: string;
    reason: string;
    createdByName: string;
  } | null;
  order: {
    id: number;
    menuText: string;
    dietTags: string[];
    status: string;
    swappedAt: string | null;
    swapNote: string | null;
    rejectReason: string | null;
    leftoverNote: string | null;
    delivery: {
      id: number;
      status: string;
      courierName: string;
      signedAt: string | null;
    } | null;
  } | null;
}

// ---------- SQL 行类型 ----------

interface ElderRow {
  id: number;
  station_id: number;
  name: string;
  room_no: string | null;
  age: number | null;
  dietary_restrictions: string[] | null;
  diabetic: boolean;
  chewing_difficulty: boolean;
  notes: string | null;
  qr_code: string;
}

interface OrderRow {
  id: number;
  elder_id: number;
  station_id: number;
  status: string;
  diet_tags: string[] | null;
}

interface BoardQueryRow {
  elder_id: number;
  elder_name: string;
  room_no: string | null;
  age: number | null;
  dietary_restrictions: string[] | null;
  diabetic: boolean;
  chewing_difficulty: boolean;
  notes: string | null;
  qr_code: string;
  suspension_id: number | null;
  suspension_start: string | null;
  suspension_end: string | null;
  suspension_reason: string | null;
  suspension_by: string | null;
  order_id: number | null;
  menu_text: string | null;
  diet_tags: string[] | null;
  order_status: string | null;
  swapped_at: string | null;
  swap_note: string | null;
  reject_reason: string | null;
  leftover_note: string | null;
  delivery_id: number | null;
  delivery_status: string | null;
  signed_at: string | null;
  courier_name: string | null;
}

interface CourierTaskQueryRow {
  delivery_id: number;
  delivery_status: string;
  signed_at: string | null;
  order_id: number;
  menu_text: string;
  diet_tags: string[] | null;
  meal_date: string;
  elder_id: number;
  elder_name: string;
  room_no: string | null;
  qr_code: string;
  dietary_restrictions: string[] | null;
  diabetic: boolean;
  chewing_difficulty: boolean;
  exception_id: number | null;
  exception_status: string | null;
}

interface ExceptionQueryRow {
  id: number;
  type: string;
  status: string;
  courier_note: string | null;
  created_at: string;
  second_confirm_result: string | null;
  second_confirm_note: string | null;
  confirmed_at: string | null;
  housekeeper_id: number | null;
  housekeeper_name: string | null;
  delivery_id: number;
  courier_name: string;
  order_id: number;
  menu_text: string;
  meal_date: string;
  elder_id: number;
  elder_name: string;
  room_no: string | null;
}

interface DeliveryCtxRow {
  id: number;
  delivery_status: string;
  courier_id: number;
  meal_order_id: number;
  order_id: number;
  station_id: number;
  elder_name: string;
  room_no: string | null;
  qr_code: string;
}

interface ExceptionCtxRow {
  id: number;
  status: string;
  delivery_id: number;
  courier_id: number;
  order_id: number;
  station_id: number;
}

interface FamilyRecordQueryRow {
  id: number;
  meal_date: string;
  meal_type: string;
  menu_text: string;
  diet_tags: string[] | null;
  status: string;
  swap_note: string | null;
  reject_reason: string | null;
  leftover_note: string | null;
  swapped_at: string | null;
  delivery_status: string | null;
  signed_at: string | null;
}

interface SuspensionQueryRow {
  id: number;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
}

export interface NoticeRow {
  id: number;
  type: string;
  title: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface OrderStatsRow {
  total: number;
  signed: number;
  leftover: number;
  rejected: number;
  cancelled: number;
  in_progress: number;
  swapped: number;
}

export interface ExceptionStatsRow {
  total: number;
  resolved: number;
  open: number;
}

@Injectable()
export class MealsService {
  constructor(private readonly db: DatabaseService) {}

  // ========== 站点：排餐看板 ==========

  /** 看板：排午餐时必须看到 忌口/糖尿病餐/咀嚼困难/家属临时停餐说明 */
  async getMealBoard(stationId: number, date: string): Promise<MealBoardRow[]> {
    const { rows } = await this.db.query<BoardQueryRow>(
      `
      SELECT
        e.id            AS elder_id,
        e.name          AS elder_name,
        e.room_no,
        e.age,
        e.dietary_restrictions,
        e.diabetic,
        e.chewing_difficulty,
        e.notes,
        e.qr_code,
        s.id            AS suspension_id,
        s.start_date AS suspension_start,
        s.end_date   AS suspension_end,
        s.reason        AS suspension_reason,
        fm.name         AS suspension_by,
        o.id            AS order_id,
        o.menu_text,
        o.diet_tags,
        o.status        AS order_status,
        o.swapped_at,
        o.swap_note,
        o.reject_reason,
        o.leftover_note,
        d.id            AS delivery_id,
        d.status        AS delivery_status,
        d.signed_at,
        cu.name         AS courier_name
      FROM elders e
      LEFT JOIN meal_suspensions s
        ON s.elder_id = e.id AND $2::date BETWEEN s.start_date AND s.end_date
      LEFT JOIN family_members fm ON fm.id = s.created_by
      LEFT JOIN meal_orders o
        ON o.elder_id = e.id AND o.meal_date = $2::date AND o.meal_type = 'lunch'
      LEFT JOIN deliveries d ON d.meal_order_id = o.id
      LEFT JOIN staff_users cu ON cu.id = d.courier_id
      WHERE e.station_id = $1
      ORDER BY e.room_no, e.id
      `,
      [stationId, date],
    );

    return rows.map((r) => ({
      elder: {
        id: r.elder_id,
        name: r.elder_name,
        roomNo: r.room_no,
        age: r.age,
        dietaryRestrictions: r.dietary_restrictions ?? [],
        diabetic: r.diabetic,
        chewingDifficulty: r.chewing_difficulty,
        notes: r.notes,
        qrCode: r.qr_code,
      },
      suspension: r.suspension_id
        ? {
            id: r.suspension_id,
            startDate: toDateStr(r.suspension_start)!,
            endDate: toDateStr(r.suspension_end)!,
            reason: r.suspension_reason!,
            createdByName: r.suspension_by!,
          }
        : null,
      order: r.order_id
        ? {
            id: r.order_id,
            menuText: r.menu_text!,
            dietTags: r.diet_tags ?? [],
            status: r.order_status!,
            swappedAt: r.swapped_at,
            swapNote: r.swap_note,
            rejectReason: r.reject_reason,
            leftoverNote: r.leftover_note,
            delivery: r.delivery_id
              ? {
                  id: r.delivery_id,
                  status: r.delivery_status!,
                  courierName: r.courier_name!,
                  signedAt: r.signed_at,
                }
              : null,
          }
        : null,
    }));
  }

  /** 站点排午餐：校验停餐、防重复，膳食标签缺省按档案推导 */
  async createMealOrder(staff: AuthUser, dto: CreateMealOrderDto) {
    const elder = await this.mustGetElder(dto.elderId);
    if (elder.station_id !== staff.stationId) {
      throw new ForbiddenException('只能给本站点的老人排餐');
    }
    await this.assertNotSuspended(dto.elderId, dto.mealDate);

    const dup = await this.db.query<{ id: number }>(
      `SELECT id FROM meal_orders WHERE elder_id=$1 AND meal_date=$2 AND meal_type='lunch'`,
      [dto.elderId, dto.mealDate],
    );
    if (dup.rows.length) {
      throw new ConflictException('该老人当日午餐已排餐，请勿重复下单');
    }

    const dietTags = dto.dietTags?.length
      ? dto.dietTags
      : this.deriveDietTags(elder);

    const { rows } = await this.db.query<{ id: number; status: string }>(
      `INSERT INTO meal_orders (elder_id, station_id, meal_date, meal_type, menu_text, diet_tags, created_by)
       VALUES ($1,$2,$3,'lunch',$4,$5,$6)
       RETURNING id, status`,
      [
        dto.elderId,
        staff.stationId,
        dto.mealDate,
        dto.menuText,
        JSON.stringify(dietTags),
        staff.id,
      ],
    );
    return { id: rows[0].id, status: rows[0].status, dietTags };
  }

  /** 换餐：记录换餐事件（时间+说明），不打断配送状态机 */
  async swapMeal(orderId: number, staff: AuthUser, dto: SwapMealDto) {
    const order = await this.mustGetOrder(orderId);
    this.assertStation(staff, order.station_id);
    if (
      ['signed', 'leftover', 'rejected', 'cancelled'].includes(order.status)
    ) {
      throw new ConflictException(`当前状态(${order.status})不允许换餐`);
    }
    const dietTags = dto.dietTags?.length ? dto.dietTags : order.diet_tags;
    await this.db.query(
      `UPDATE meal_orders
       SET menu_text=$1, diet_tags=$2, swap_note=$3, swapped_at=now(), updated_at=now()
       WHERE id=$4`,
      [dto.menuText, JSON.stringify(dietTags), dto.swapNote, orderId],
    );
    return { id: orderId, status: order.status, swapped: true };
  }

  /** 标记剩餐 */
  async markLeftover(orderId: number, staff: AuthUser, dto: MarkLeftoverDto) {
    const order = await this.mustGetOrder(orderId);
    this.assertStation(staff, order.station_id);
    if (['rejected', 'cancelled', 'leftover'].includes(order.status)) {
      throw new ConflictException(`当前状态(${order.status})不能标记剩餐`);
    }
    await this.db.query(
      `UPDATE meal_orders SET status='leftover', leftover_note=$1, updated_at=now() WHERE id=$2`,
      [dto.note ?? null, orderId],
    );
    return { id: orderId, status: 'leftover' };
  }

  /** 标记拒收（必须填原因，进入统计） */
  async rejectMeal(orderId: number, staff: AuthUser, dto: RejectMealDto) {
    const order = await this.mustGetOrder(orderId);
    this.assertStation(staff, order.station_id);
    if (
      ['signed', 'leftover', 'cancelled', 'rejected'].includes(order.status)
    ) {
      throw new ConflictException(`当前状态(${order.status})不能标记拒收`);
    }
    await this.db.query(
      `UPDATE meal_orders SET status='rejected', reject_reason=$1, updated_at=now() WHERE id=$2`,
      [dto.reason, orderId],
    );
    return { id: orderId, status: 'rejected' };
  }

  /** 派单：生成配送单并进入配送中 */
  async dispatch(orderId: number, staff: AuthUser, courierId: number) {
    const order = await this.mustGetOrder(orderId);
    this.assertStation(staff, order.station_id);
    if (order.status !== 'scheduled') {
      throw new ConflictException(
        `仅“已排餐”状态可派单，当前为 ${order.status}`,
      );
    }
    const courier = await this.db.query<{ id: number }>(
      `SELECT id FROM staff_users WHERE id=$1 AND role='courier' AND station_id=$2`,
      [courierId, staff.stationId],
    );
    if (!courier.rows.length)
      throw new BadRequestException('配送员不存在或不属于本站点');

    return this.db.tx(async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO deliveries (meal_order_id, courier_id, status)
         VALUES ($1,$2,'out_for_delivery') RETURNING id`,
        [orderId, courierId],
      );
      await client.query(
        `UPDATE meal_orders SET status='delivering', updated_at=now() WHERE id=$1`,
        [orderId],
      );
      return { deliveryId: rows[0].id, status: 'out_for_delivery' };
    });
  }

  // ========== 配送员 ==========

  /** 配送员当日任务列表（含老人忌口等信息，便于核对） */
  async courierTasks(courier: AuthUser, date: string) {
    const { rows } = await this.db.query<CourierTaskQueryRow>(
      `
      SELECT d.id AS delivery_id, d.status AS delivery_status, d.signed_at,
             o.id AS order_id, o.menu_text, o.diet_tags, o.meal_date AS meal_date,
             e.id AS elder_id, e.name AS elder_name, e.room_no, e.qr_code,
             e.dietary_restrictions, e.diabetic, e.chewing_difficulty,
             x.id AS exception_id, x.status AS exception_status
      FROM deliveries d
      JOIN meal_orders o ON o.id = d.meal_order_id
      JOIN elders e ON e.id = o.elder_id
      LEFT JOIN delivery_exceptions x ON x.delivery_id = d.id
      WHERE d.courier_id = $1 AND o.meal_date = $2::date
      ORDER BY d.id
      `,
      [courier.id, date],
    );
    return rows.map((r) => ({
      deliveryId: r.delivery_id,
      deliveryStatus: r.delivery_status,
      signedAt: r.signed_at,
      orderId: r.order_id,
      menuText: r.menu_text,
      dietTags: r.diet_tags ?? [],
      mealDate: toDateStr(r.meal_date),
      elder: {
        id: r.elder_id,
        name: r.elder_name,
        roomNo: r.room_no,
        qrCode: r.qr_code,
        dietaryRestrictions: r.dietary_restrictions ?? [],
        diabetic: r.diabetic,
        chewingDifficulty: r.chewing_difficulty,
      },
      exception: r.exception_id
        ? { id: r.exception_id, status: r.exception_status }
        : null,
    }));
  }

  /** 送到门口扫码签收：二维码必须匹配老人档案 */
  async scanSign(deliveryId: number, courier: AuthUser, dto: ScanSignDto) {
    const ctx = await this.mustGetDeliveryForCourier(deliveryId, courier.id);
    if (!['pending', 'out_for_delivery'].includes(ctx.delivery_status)) {
      throw new ConflictException(
        `当前配送状态(${ctx.delivery_status})不能签收`,
      );
    }
    if (dto.qrCode.trim() !== ctx.qr_code) {
      throw new BadRequestException('二维码与老人不匹配，请核对门口签收码');
    }
    await this.db.tx(async (client) => {
      await client.query(
        `UPDATE deliveries SET status='signed', sign_method='qr_code', signed_at=now() WHERE id=$1`,
        [deliveryId],
      );
      await client.query(
        `UPDATE meal_orders SET status='signed', updated_at=now() WHERE id=$1`,
        [ctx.order_id],
      );
    });
    return { deliveryId, status: 'signed' };
  }

  /**
   * 老人无应答：不能直接算完成。
   * 配送单置为异常，生成异常单并通知站点所有管家安排二次确认。
   */
  async reportNoResponse(deliveryId: number, courier: AuthUser, note?: string) {
    const ctx = await this.mustGetDeliveryForCourier(deliveryId, courier.id);
    if (!['pending', 'out_for_delivery'].includes(ctx.delivery_status)) {
      throw new ConflictException(
        `当前配送状态(${ctx.delivery_status})不能上报无应答`,
      );
    }
    return this.db.tx(async (client) => {
      await client.query(
        `UPDATE deliveries SET status='exception' WHERE id=$1`,
        [deliveryId],
      );
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO delivery_exceptions (delivery_id, type, status, courier_note)
         VALUES ($1,'no_response','pending',$2) RETURNING id`,
        [deliveryId, note ?? null],
      );
      const exceptionId = rows[0].id;

      const housekeepers = await client.query<{ id: number }>(
        `SELECT id FROM staff_users WHERE station_id=$1 AND role='housekeeper'`,
        [ctx.station_id],
      );
      for (const hk of housekeepers.rows) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, content)
           VALUES ($1,'no_response',$2,$3)`,
          [
            hk.id,
            `配送异常：${ctx.elder_name} 老人无应答`,
            `配送员送达 ${ctx.room_no ?? ''} 时老人无应答（异常单 #${exceptionId}），请尽快安排二次确认。${note ? '配送员备注：' + note : ''}`,
          ],
        );
      }
      return { deliveryId, status: 'exception', exceptionId };
    });
  }

  // ========== 管家：异常二次确认 ==========

  async listExceptions(staff: AuthUser, status?: string) {
    const params: unknown[] = [staff.stationId];
    let where = 'WHERE o.station_id = $1';
    if (status) {
      params.push(status);
      where += ` AND x.status = $2`;
    }
    const { rows } = await this.db.query<ExceptionQueryRow>(
      `
      SELECT x.id, x.type, x.status, x.courier_note, x.created_at,
             x.second_confirm_result, x.second_confirm_note, x.confirmed_at,
             x.housekeeper_id, hk.name AS housekeeper_name,
             d.id AS delivery_id, cu.name AS courier_name,
             o.id AS order_id, o.menu_text, o.meal_date AS meal_date,
             e.id AS elder_id, e.name AS elder_name, e.room_no
      FROM delivery_exceptions x
      JOIN deliveries d ON d.id = x.delivery_id
      JOIN meal_orders o ON o.id = d.meal_order_id
      JOIN elders e ON e.id = o.elder_id
      JOIN staff_users cu ON cu.id = d.courier_id
      LEFT JOIN staff_users hk ON hk.id = x.housekeeper_id
      ${where}
      ORDER BY x.status = 'resolved', x.id DESC
      `,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      courierNote: r.courier_note,
      createdAt: r.created_at,
      housekeeper: r.housekeeper_id
        ? { id: r.housekeeper_id, name: r.housekeeper_name }
        : null,
      secondConfirm: r.second_confirm_result
        ? {
            result: r.second_confirm_result,
            note: r.second_confirm_note,
            confirmedAt: r.confirmed_at,
          }
        : null,
      deliveryId: r.delivery_id,
      courierName: r.courier_name,
      order: {
        id: r.order_id,
        menuText: r.menu_text,
        mealDate: toDateStr(r.meal_date),
      },
      elder: { id: r.elder_id, name: r.elder_name, roomNo: r.room_no },
    }));
  }

  /** 管家认领异常单，开始二次确认 */
  async assignException(exceptionId: number, staff: AuthUser) {
    const ex = await this.mustGetException(exceptionId, staff.stationId!);
    if (ex.status === 'resolved') {
      throw new ConflictException('该异常已处理完毕');
    }
    await this.db.query(
      `UPDATE delivery_exceptions SET status='confirming', housekeeper_id=$1 WHERE id=$2`,
      [staff.id, exceptionId],
    );
    return { id: exceptionId, status: 'confirming', housekeeperId: staff.id };
  }

  /**
   * 二次确认结论：
   * - reschedule 补送：生成新配送单，餐单回到配送中
   * - recycle    回收：餐单记为剩餐
   * - cancel     取消：餐单取消
   */
  async secondConfirm(
    exceptionId: number,
    staff: AuthUser,
    dto: SecondConfirmDto,
  ) {
    const ex = await this.mustGetException(exceptionId, staff.stationId!);
    if (ex.status === 'resolved') {
      throw new ConflictException('该异常已处理完毕，请勿重复确认');
    }
    return this.db.tx(async (client) => {
      await client.query(
        `UPDATE delivery_exceptions
         SET status='resolved', housekeeper_id=$1,
             second_confirm_result=$2, second_confirm_note=$3, confirmed_at=now()
         WHERE id=$4`,
        [staff.id, dto.result, dto.note, exceptionId],
      );

      if (dto.result === 'reschedule') {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO deliveries (meal_order_id, courier_id, status)
           VALUES ($1,$2,'out_for_delivery') RETURNING id`,
          [ex.order_id, ex.courier_id],
        );
        await client.query(
          `UPDATE meal_orders SET status='delivering', updated_at=now() WHERE id=$1`,
          [ex.order_id],
        );
        return {
          id: exceptionId,
          status: 'resolved',
          newDeliveryId: rows[0].id,
        };
      }
      if (dto.result === 'recycle') {
        await client.query(
          `UPDATE meal_orders SET status='leftover', leftover_note=$1, updated_at=now() WHERE id=$2`,
          [`无应答二次确认回收：${dto.note}`, ex.order_id],
        );
        return { id: exceptionId, status: 'resolved', orderStatus: 'leftover' };
      }
      await client.query(
        `UPDATE meal_orders SET status='cancelled', updated_at=now() WHERE id=$1`,
        [ex.order_id],
      );
      return { id: exceptionId, status: 'resolved', orderStatus: 'cancelled' };
    });
  }

  // ========== 后台统计 ==========

  /** 每日统计：剩餐 / 换餐 / 拒收原因 / 无应答异常 */
  async dailyStats(stationId: number, date: string) {
    const [orders, rejectReasons, exceptions] = await Promise.all([
      this.db.query<OrderStatsRow>(
        `
        SELECT
          count(*)::int                                              AS total,
          sum(CASE WHEN status='signed'   THEN 1 ELSE 0 END)::int    AS signed,
          sum(CASE WHEN status='leftover' THEN 1 ELSE 0 END)::int    AS leftover,
          sum(CASE WHEN status='rejected' THEN 1 ELSE 0 END)::int    AS rejected,
          sum(CASE WHEN status='cancelled' THEN 1 ELSE 0 END)::int   AS cancelled,
          sum(CASE WHEN status IN ('scheduled','delivering') THEN 1 ELSE 0 END)::int AS in_progress,
          sum(CASE WHEN swapped_at IS NOT NULL THEN 1 ELSE 0 END)::int AS swapped
        FROM meal_orders
        WHERE station_id=$1 AND meal_date=$2::date
        `,
        [stationId, date],
      ),
      this.db.query<{ reason: string; count: number }>(
        `
        SELECT reject_reason AS reason, count(*)::int AS count
        FROM meal_orders
        WHERE station_id=$1 AND meal_date=$2::date AND status='rejected'
        GROUP BY reject_reason
        ORDER BY count DESC
        `,
        [stationId, date],
      ),
      this.db.query<ExceptionStatsRow>(
        `
        SELECT
          count(*)::int AS total,
          sum(CASE WHEN x.status='resolved' THEN 1 ELSE 0 END)::int  AS resolved,
          sum(CASE WHEN x.status<>'resolved' THEN 1 ELSE 0 END)::int AS open
        FROM delivery_exceptions x
        JOIN deliveries d ON d.id = x.delivery_id
        JOIN meal_orders o ON o.id = d.meal_order_id
        WHERE o.station_id=$1 AND o.meal_date=$2::date
        `,
        [stationId, date],
      ),
    ]);

    return {
      date,
      stationId,
      orders: orders.rows[0],
      rejectReasons: rejectReasons.rows,
      noResponseExceptions: exceptions.rows[0],
    };
  }

  // ========== 家属端（仅自己老人的数据） ==========

  /** 家属餐食记录：强制按本人关联老人过滤，实现数据隔离 */
  async familyMealRecords(family: AuthUser, from?: string, to?: string) {
    const params: unknown[] = [family.elderId];
    let where = 'WHERE o.elder_id = $1';
    if (from) {
      params.push(from);
      where += ` AND o.meal_date >= $${params.length}::date`;
    }
    if (to) {
      params.push(to);
      where += ` AND o.meal_date <= $${params.length}::date`;
    }
    const { rows } = await this.db.query<FamilyRecordQueryRow>(
      `
      SELECT o.id, o.meal_date AS meal_date, o.meal_type, o.menu_text,
             o.diet_tags, o.status, o.swap_note, o.reject_reason, o.leftover_note,
             o.swapped_at, d.status AS delivery_status, d.signed_at
      FROM meal_orders o
      LEFT JOIN deliveries d ON d.meal_order_id = o.id
      ${where}
      ORDER BY o.meal_date DESC, o.id DESC
      LIMIT 90
      `,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      mealDate: toDateStr(r.meal_date),
      mealType: r.meal_type,
      menuText: r.menu_text,
      dietTags: r.diet_tags ?? [],
      status: r.status,
      swapNote: r.swap_note,
      rejectReason: r.reject_reason,
      leftoverNote: r.leftover_note,
      swappedAt: r.swapped_at,
      deliveryStatus: r.delivery_status,
      signedAt: r.signed_at,
    }));
  }

  /** 家属首页：老人膳食档案 + 停餐记录 */
  async familyProfile(family: AuthUser) {
    const elder = await this.mustGetElder(family.elderId!);
    const { rows } = await this.db.query<SuspensionQueryRow>(
      `SELECT s.id, s.start_date, s.end_date,
              s.reason, s.created_at
       FROM meal_suspensions s
       WHERE s.elder_id=$1 ORDER BY s.start_date DESC LIMIT 30`,
      [family.elderId],
    );
    return {
      elder: {
        id: elder.id,
        name: elder.name,
        roomNo: elder.room_no,
        dietaryRestrictions: elder.dietary_restrictions ?? [],
        diabetic: elder.diabetic,
        chewingDifficulty: elder.chewing_difficulty,
      },
      suspensions: rows.map((r) => ({
        id: r.id,
        startDate: toDateStr(r.start_date),
        endDate: toDateStr(r.end_date),
        reason: r.reason,
        createdAt: r.created_at,
      })),
    };
  }

  /** 家属临时停餐：防重叠，自动取消期间未送达的餐单 */
  async createSuspension(family: AuthUser, dto: CreateSuspensionDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('结束日期不能早于开始日期');
    }
    const overlap = await this.db.query<{ id: number }>(
      `SELECT id FROM meal_suspensions
       WHERE elder_id=$1 AND start_date <= $3::date AND end_date >= $2::date`,
      [family.elderId, dto.startDate, dto.endDate],
    );
    if (overlap.rows.length) {
      throw new ConflictException('该时间段已有停餐申请，请勿重复提交');
    }
    const { rows } = await this.db.query<{ id: number }>(
      `INSERT INTO meal_suspensions (elder_id, start_date, end_date, reason, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [family.elderId, dto.startDate, dto.endDate, dto.reason, family.id],
    );
    const cancelled = await this.db.query(
      `UPDATE meal_orders SET status='cancelled', updated_at=now()
       WHERE elder_id=$1 AND meal_date BETWEEN $2::date AND $3::date
         AND status IN ('scheduled','delivering')`,
      [family.elderId, dto.startDate, dto.endDate],
    );
    return { id: rows[0].id, autoCancelledOrders: cancelled.rowCount };
  }

  // ========== 站内通知 ==========

  async myNotifications(staff: AuthUser) {
    const { rows } = await this.db.query<NoticeRow>(
      `SELECT id, type, title, content, read, created_at
       FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50`,
      [staff.id],
    );
    return rows;
  }

  async markNotificationRead(staff: AuthUser, id: number) {
    const res = await this.db.query(
      `UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2`,
      [id, staff.id],
    );
    if (!res.rowCount) throw new NotFoundException('通知不存在');
    return { id, read: true };
  }

  // ========== 私有工具 ==========

  /** 按老人档案推导膳食标签 */
  private deriveDietTags(elder: {
    diabetic: boolean;
    chewing_difficulty: boolean;
  }): string[] {
    const tags: string[] = [];
    if (elder.diabetic) tags.push('糖尿病餐');
    if (elder.chewing_difficulty) tags.push('软食');
    return tags;
  }

  private async mustGetElder(elderId: number): Promise<ElderRow> {
    const { rows } = await this.db.query<ElderRow>(
      'SELECT * FROM elders WHERE id=$1',
      [elderId],
    );
    if (!rows.length) throw new NotFoundException('老人不存在');
    return rows[0];
  }

  private async mustGetOrder(orderId: number): Promise<OrderRow> {
    const { rows } = await this.db.query<OrderRow>(
      'SELECT * FROM meal_orders WHERE id=$1',
      [orderId],
    );
    if (!rows.length) throw new NotFoundException('餐单不存在');
    return rows[0];
  }

  private async mustGetDeliveryForCourier(
    deliveryId: number,
    courierId: number,
  ): Promise<DeliveryCtxRow> {
    const { rows } = await this.db.query<DeliveryCtxRow>(
      `
      SELECT d.id, d.status AS delivery_status, d.courier_id, d.meal_order_id,
             o.id AS order_id, o.station_id,
             e.name AS elder_name, e.room_no, e.qr_code
      FROM deliveries d
      JOIN meal_orders o ON o.id = d.meal_order_id
      JOIN elders e ON e.id = o.elder_id
      WHERE d.id=$1
      `,
      [deliveryId],
    );
    if (!rows.length) throw new NotFoundException('配送单不存在');
    if (rows[0].courier_id !== courierId) {
      throw new ForbiddenException('只能操作自己的配送单');
    }
    return rows[0];
  }

  private async mustGetException(
    exceptionId: number,
    stationId: number,
  ): Promise<ExceptionCtxRow> {
    const { rows } = await this.db.query<ExceptionCtxRow>(
      `
      SELECT x.id, x.status, d.id AS delivery_id, d.courier_id, o.id AS order_id, o.station_id
      FROM delivery_exceptions x
      JOIN deliveries d ON d.id = x.delivery_id
      JOIN meal_orders o ON o.id = d.meal_order_id
      WHERE x.id=$1
      `,
      [exceptionId],
    );
    if (!rows.length) throw new NotFoundException('异常单不存在');
    if (rows[0].station_id !== stationId) {
      throw new ForbiddenException('只能处理本站点的异常');
    }
    return rows[0];
  }

  /** 排餐前校验：当日是否被家属临时停餐 */
  private async assertNotSuspended(elderId: number, date: string) {
    const { rows } = await this.db.query<{ reason: string; by_name: string }>(
      `SELECT s.reason, fm.name AS by_name
       FROM meal_suspensions s JOIN family_members fm ON fm.id = s.created_by
       WHERE s.elder_id=$1 AND $2::date BETWEEN s.start_date AND s.end_date`,
      [elderId, date],
    );
    if (rows.length) {
      throw new ConflictException(
        `该老人当日已被家属（${rows[0].by_name}）申请临时停餐：${rows[0].reason}`,
      );
    }
  }

  private assertStation(staff: AuthUser, stationId: number) {
    if (staff.stationId !== stationId) {
      throw new ForbiddenException('只能操作本站点的数据');
    }
  }
}
