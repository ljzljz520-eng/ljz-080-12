# 助餐模块后端（NestJS）

- `src/meals/`：排餐看板、配送签收、无应答异常二次确认、每日统计、家属端、站内通知。
- `src/database/schema.sql`：全部建表语句（Supabase/Postgres 与 pg-mem 共用）。
- 启动时自动建表；库为空时写入演示数据（站点/员工/老人/家属/当日餐单）。
- 设置 `DATABASE_URL` 连接 Supabase Postgres；否则使用 pg-mem 内存库。
- 鉴权：请求头 `x-staff-id`（员工）/ `x-family-id`（家属），由 `common/auth.ts` 全局守卫校验角色。

```bash
npm run start:dev   # 开发（默认 3000 端口）
npm test            # 单元测试
npm run build       # 构建
```
