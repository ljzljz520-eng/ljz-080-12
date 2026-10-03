import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** 演示环境引导数据：站点 / 员工 / 家属账号清单（用于身份选择） */
@Controller('meta')
export class MetaController {
  constructor(private readonly db: DatabaseService) {}

  @Get('bootstrap')
  async bootstrap() {
    const [stations, staff, families] = await Promise.all([
      this.db.query<{ id: number; name: string; address: string }>(
        'SELECT id, name, address FROM stations ORDER BY id',
      ),
      this.db.query<{
        id: number;
        name: string;
        role: string;
        station_id: number;
        station_name: string;
      }>(
        `SELECT s.id, s.name, s.role, s.station_id, st.name AS station_name
         FROM staff_users s JOIN stations st ON st.id = s.station_id ORDER BY s.id`,
      ),
      this.db.query<{
        id: number;
        name: string;
        relation: string;
        elder_id: number;
        elder_name: string;
      }>(
        `SELECT f.id, f.name, f.relation, f.elder_id, e.name AS elder_name
         FROM family_members f JOIN elders e ON e.id = f.elder_id ORDER BY f.id`,
      ),
    ]);
    return {
      stations: stations.rows,
      staff: staff.rows,
      families: families.rows,
    };
  }
}
