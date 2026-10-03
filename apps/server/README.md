# server — 助餐模块后端（NestJS）

社区养老协作平台后端，当前包含**助餐模块**（`src/meal/`）。

## 模块结构

```
src/meal/
  meal.types.ts          # 领域模型（老人/订单/配送/异常/停餐）
  meal.store.ts          # 内存数据存储 + 种子数据（演示默认）
  schedule.service.ts    # 排餐：饮食标签聚合、一键生成、换餐、拒收
  delivery.service.ts    # 配送：出餐、扫码签收、未应答上报
  exceptions.service.ts  # 异常工单：管家二次确认闭环
  stats.service.ts       # 每日统计：剩餐/换餐/拒收原因
  family.service.ts      # 家属端：数据隔离、临时停餐
  *.controller.ts        # REST 接口（全局前缀 /api）
```

## 数据库

- 演示环境：内存存储（`MealStore`），服务重启即重置为种子数据。
- 生产环境：Supabase（Postgres）。建表迁移见 `supabase/migrations/20261002000000_meal_module.sql`，
  含家属端行级安全（RLS）策略：家属只能读到自家老人的餐食记录。

## 常用命令

```bash
npm run start:dev   # 开发（端口 3000，前缀 /api）
npm test            # 单元测试（22 个用例）
npm run test:e2e    # e2e
npm run lint        # ESLint + Prettier
```
