# 社区养老协作平台 · 助餐模块

基于 React + NestJS 的社区养老协作平台 Monorepo。本次在现有骨架上补齐**助餐模块**：站点排餐、扫码签收配送、异常二次确认、每日统计与家属端查看。

## 技术栈

- **前端**：React 18+ / TypeScript / Vite / React Router v6 / antd（PC 管理端）/ antd-mobile（H5 用户端）/ LESS
- **后端**：Node.js 20+ / NestJS / TypeScript，数据库选型 Supabase（Postgres）
- **工程规范**：ESLint + Prettier

## 项目结构

```
apps/
  client/                 # React 前端（双入口）
    index.html            # PC 管理端入口（站点排餐 / 配送 / 异常 / 统计）
    h5.html               # H5 用户端入口（家属端 + 配送员端）
    src/
      admin/              # PC 管理端页面
      h5/                 # H5 用户端页面
      shared/             # 共享类型与 API 客户端
  server/                 # NestJS 后端
    src/meal/             # 助餐模块（排餐 / 配送 / 异常 / 统计 / 家属端）
    supabase/migrations/  # Supabase(Postgres) 建表迁移
```

## 助餐模块功能

| 角色 | 能力 |
| --- | --- |
| 站点（PC 管理端） | 排餐时可见每位老人的**忌口、糖尿病餐、咀嚼困难**标签与**家属临时停餐说明**；一键生成排餐、换餐（留痕原因） |
| 配送员（H5） | 到门口**扫码签收**；老人未应答时上报，订单**不会**被计为完成 |
| 管家/管家台（PC 管理端） | 接收「老人未应答」异常工单，**二次确认**（确认送达 / 重新配送 / 取消）后闭环 |
| 运营（PC 管理端） | 每日统计：**剩餐、换餐、拒收原因**分布与送达率 |
| 家属（H5） | 仅查看**自家老人**的餐食记录；提交临时停餐申请 |

### 关键业务规则

- 老人未应答 → 订单进入 `NO_RESPONSE` 异常态，**不计完成**，自动生成异常工单指派管家；管家二次确认前该配送单无法扫码签收。
- 家属临时停餐 → 自动取消当日未配送订单；**当天**临时停餐/取消/拒收的已备餐食计入**剩餐**统计。
- 换餐、拒收均记录原因，进入每日统计（剩餐 / 换餐 / 拒收原因）。
- 家属端数据隔离在服务端强制过滤，家属只能看到关联老人的记录。

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
docker compose up --build
```

- PC 管理端：http://localhost:3000/ （排餐管理 / 配送签收 / 异常工单 / 统计分析）
- H5 用户端：http://localhost:3000/h5.html （家属 / 配送员）
- 后端 API：http://localhost:8000/api
- 数据库（Supabase Postgres）：localhost:5432

### 方式二：本地开发

```bash
npm install

# 终端 1：后端（内存演示数据，端口 3000）
npm run dev:server

# 终端 2：前端（端口 5173，/api 代理到 3000）
npm run dev:client
```

- PC 管理端：http://localhost:5173/
- H5 用户端：http://localhost:5173/h5.html

> 演示环境默认使用内存数据（`MealStore`，含种子数据：6 位老人、3 位家属、停餐/换餐/拒收样例）。
> 生产部署时执行 `apps/server/supabase/migrations/` 下的 SQL 迁移，并以 Supabase 仓储替换内存实现即可。

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/schedule?date=` | 站点排餐视图（含饮食标签与停餐说明） |
| POST | `/api/schedule/generate` | 一键生成某日排餐（自动跳过停餐老人） |
| PATCH | `/api/orders/:id/swap` | 换餐（记录原餐型与原因） |
| POST | `/api/orders/:id/reject` | 老人拒收（记录原因，计剩餐） |
| POST | `/api/deliveries/dispatch` | 出餐，生成配送任务与签收二维码令牌 |
| POST | `/api/deliveries/scan` | 扫码签收 |
| POST | `/api/deliveries/:id/no-response` | 老人未应答 → 生成异常工单 |
| GET | `/api/exceptions?status=` | 异常工单列表（管家） |
| POST | `/api/exceptions/:id/confirm` | 管家二次确认（送达/重送/取消） |
| GET | `/api/stats/daily?date=` | 每日统计（剩餐/换餐/拒收原因） |
| GET | `/api/families/:id/meal-records` | 家属端餐食记录（仅自家老人） |
| POST | `/api/families/:id/suspensions` | 家属临时停餐 |

## 测试与验证

```bash
# 后端单元测试（22 个用例：排餐规则 / 签收异常 / 二次确认 / 统计 / 家属数据隔离）
cd apps/server && npm test

# 前端构建
cd apps/client && npm run build
```

手工验证路径：
1. 管理端「排餐管理」：张桂兰行可见「忌口·海鲜过敏 / 糖尿病餐 / 咀嚼困难·软食」及「临时停餐」说明。
2. 管理端「配送签收」：出餐后点击「签收码」得二维码；用 H5 打开 `/h5.html#/sign/<token>` 签收。
3. H5 配送员端对某单点「老人未应答」→ 管理端「异常工单」出现待处理工单 → 「二次确认」选择结果后闭环。
4. 管理端「统计分析」查看当日剩餐 / 换餐 / 拒收原因。
5. H5 家属端（如张敏）仅显示张桂兰的餐食记录。
