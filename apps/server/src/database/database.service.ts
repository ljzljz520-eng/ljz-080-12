import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { todayStr } from '../common/date.util';

/**
 * 数据访问入口：
 * - 设置 DATABASE_URL 时连接 Supabase/Postgres；
 * - 否则使用 pg-mem 内存库，便于本地一键启动与演示。
 * 两种模式共用 src/database/schema.sql 这一套 DDL。
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;
  inMemory = false;

  async onModuleInit() {
    const url = process.env.DATABASE_URL;
    if (url) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pg = require('pg') as typeof import('pg');
      // DATE 列保持 'YYYY-MM-DD' 字符串，避免时区偏移
      pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);
      this.pool = new pg.Pool({ connectionString: url });
      this.inMemory = false;
      this.logger.log('Using Postgres from DATABASE_URL');
    } else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { newDb } = require('pg-mem') as typeof import('pg-mem');
      const db = newDb({ autoCreateForeignKeyIndices: true });
      const { Pool: MemPool } = db.adapters.createPg() as {
        Pool: new () => Pool;
      };
      this.pool = new MemPool();
      this.inMemory = true;
      this.logger.log(
        'DATABASE_URL not set, using in-memory Postgres (pg-mem)',
      );
    }
    await this.migrate();
    await this.seed();
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query(text, params);
  }

  /** 事务包装：全部成功才提交，任一失败回滚 */
  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async migrate() {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await this.pool.query(schema);
    this.logger.log('Schema migrated');
  }

  /** 首次启动写入演示数据（站点/员工/老人/家属/当日餐单） */
  private async seed() {
    const { rows } = await this.pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM stations',
    );
    if (Number(rows[0].count) > 0) return;

    await this.pool.query(`
      INSERT INTO stations (name, address) VALUES
        ('阳光社区养老服务站', '阳光路 12 号');

      INSERT INTO staff_users (station_id, name, role, phone) VALUES
        (1, '王慧',   'station_admin', '13800000001'),
        (1, '李强',   'courier',       '13800000002'),
        (1, '陈静',   'housekeeper',   '13800000003');

      INSERT INTO elders (station_id, name, room_no, age, dietary_restrictions, diabetic, chewing_difficulty, notes, qr_code) VALUES
        (1, '张福生', '1-201', 78, '["海鲜","辛辣"]', TRUE,  FALSE, '低血糖史，餐食需准时', 'ELDER-QR-1001'),
        (1, '李秀兰', '1-305', 82, '["牛羊肉"]',       FALSE, TRUE,  '义齿，饭菜需煮软',   'ELDER-QR-1002'),
        (1, '王建国', '2-102', 75, '[]',               FALSE, FALSE, NULL,                 'ELDER-QR-1003'),
        (1, '赵桂香', '2-208', 86, '["豆制品","生冷"]', TRUE,  TRUE,  '吞咽偏慢，需小块软食', 'ELDER-QR-1004'),
        (1, '刘德明', '3-101', 80, '["香菜"]',         FALSE, FALSE, '对香菜气味敏感',     'ELDER-QR-1005');

      INSERT INTO family_members (elder_id, name, relation, phone) VALUES
        (1, '张伟',   '儿子', '13900000001'),
        (2, '李芳',   '女儿', '13900000002'),
        (4, '赵磊',   '孙子', '13900000003');
    `);

    const today = todayStr();
    const tomorrow = todayStr(1);
    await this.pool.query(
      `
      -- 家属临时停餐：张福生 今天起到明天 外出就医停餐
      INSERT INTO meal_suspensions (elder_id, start_date, end_date, reason, created_by) VALUES
        (1, $1, $2, '家属陪同外出复查，暂停送餐两天', 1);

      -- 当日已排午餐（含膳食标签），其中一单配送中
      INSERT INTO meal_orders (elder_id, station_id, meal_date, meal_type, menu_text, diet_tags, status, created_by) VALUES
        (2, 1, $1, 'lunch', '软米饭 + 蒸蛋羹 + 青菜碎 + 冬瓜汤', '["软食"]', 'delivering', 1),
        (3, 1, $1, 'lunch', '米饭 + 红烧鸡腿 + 时蔬 + 紫菜汤',   '[]',       'scheduled',  1),
        (4, 1, $1, 'lunch', '软米饭 + 清蒸鱼(去刺) + 南瓜泥',     '["糖尿病餐","软食"]', 'scheduled', 1);

      INSERT INTO deliveries (meal_order_id, courier_id, status) VALUES
        (1, 2, 'out_for_delivery');
    `,
      [today, tomorrow],
    );
    this.logger.log('Seeded demo data');
  }
}
