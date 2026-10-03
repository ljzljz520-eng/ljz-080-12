# 社区养老协作平台 · 助餐模块

在既有平台（React 前端 + NestJS 后端 + Supabase/Postgres）上新增的**助餐模块**，覆盖：
站点排餐 → 配送扫码签收 → 无应答异常二次确认 → 剩餐/换餐/拒收统计 → 家属端查看与临时停餐。

## 功能一览

| 角色 | 端 | 能力 |
| --- | --- | --- |
| 站点管理员 | 管理端（PC） | 排餐看板（老人忌口 / 糖尿病餐 / 咀嚼困难 / 家属临时停餐说明一屏可见）、排餐、换餐、派单、剩餐、拒收、每日统计 |
| 管家 | 管理端（PC） | 接收无应答异常站内通知，认领异常单并二次确认（补送 / 回收记剩餐 / 取消订餐） |
| 配送员 | 用户端（H5） | 当日配送任务、到门口扫码签收（二维码与老人档案校验）、老人无应答上报（**不会**直接算完成） |
| 家属 | 用户端（H5） | 只看自己老人的餐食记录（数据隔离）、申请临时停餐（自动取消期间未送达餐单） |

## 技术栈

- **前端**：React 18+ / TypeScript / Vite / React Router v6+ / antd（PC 管理端）/ antd-mobile（H5 用户端）/ LESS
- **后端**：Node.js 20+ / NestJS / TypeScript / class-validator
- **数据库**：Supabase Postgres（`DATABASE_URL`）；未配置时自动回退 pg-mem 内存库，便于本地一键演示

## 项目结构

```
apps/
  client/                # React 前端（/ 入口选择，/admin 管理端，/h5 用户端）
    src/pages/admin/     #   排餐看板、异常二次确认、每日统计
    src/pages/h5/        #   配送员任务、家属餐食记录与停餐
  server/                # NestJS 后端
    src/database/        #   连接（pg / pg-mem）+ schema.sql + 演示数据
    src/meals/           #   助餐模块：排餐/配送/异常/统计/家属/通知
    src/common/          #   鉴权守卫（x-staff-id / x-family-id 头）、日期工具
```

## 快速开始

### Docker（推荐）

```bash
docker compose up --build
```

- 前端：http://localhost:3000 （`/admin` 管理端，`/h5` 用户端）
- 后端：http://localhost:8000/api
- 数据库：localhost:5432（postgres / password）

### 本地开发

```bash
npm install

# 后端（默认 3000 端口；不设置 DATABASE_URL 时使用 pg-mem 内存库并自动灌入演示数据）
npm run dev:server

# 前端（5173 端口，/api 代理到 3000；可用 VITE_API_ORIGIN 覆盖）
npm run dev:client
```

## 演示账号（种子数据）

| 账号 | 姓名 | 角色 | 说明 |
| --- | --- | --- | --- |
| 员工 #1 | 王慧 | 站点管理员 | 排餐 / 换餐 / 派单 / 统计 |
| 员工 #2 | 李强 | 配送员 | H5 扫码签收 / 无应答上报 |
| 员工 #3 | 陈静 | 管家 | 异常认领与二次确认 |
| 家属 #1 | 张伟 | 张福生之子 | 已申请今明两天临时停餐 |
| 家属 #2 | 李芳 | 李秀兰之女 | 可查看母亲餐食记录 |
| 家属 #3 | 赵磊 | 赵桂香之孙 | 仅能看到赵桂香的记录 |

演示身份在页面上直接选择即可（免登录，请求头 `x-staff-id` / `x-family-id` 标识身份，后端校验账号与角色）。
老人门口签收二维码见配送任务卡片（如 `ELDER-QR-1002`），H5 提供「模拟扫码」。

## 核心业务流程

1. **排餐**：站点管理员在看板为老人排午餐。看板强制展示忌口、糖尿病餐、咀嚼困难与家属临时停餐说明；停餐期间排餐会被后端拒绝（409）。膳食标签（糖尿病餐/软食）按档案自动带出。
2. **配送**：派单后配送员在 H5 看到任务与老人忌口信息；到门口扫码签收，二维码与老人档案不匹配则拒绝。
3. **无应答异常**：老人无应答时配送员上报，配送单置为异常（不能签收），生成异常单并通知站点全体管家；管家认领后二次确认——补送（生成新配送单）/ 回收记剩餐 / 取消订餐。
4. **统计**：每日剩餐、换餐、拒收（含原因排行）、无应答异常办结情况。
5. **家属**：仅能看到自己老人的餐食记录；临时停餐自动取消期间未送达的餐单。

## API 一览（前缀 `/api`）

| 方法 | 路径 | 角色 | 说明 |
| --- | --- | --- | --- |
| GET | `/meta/bootstrap` | 公开 | 站点/员工/家属清单（演示身份选择） |
| GET | `/stations/:id/meal-board?date=` | 管理员/管家 | 排餐看板 |
| POST | `/stations/:id/meal-orders` | 管理员 | 排午餐 |
| PATCH | `/stations/:id/meal-orders/:id/swap` | 管理员 | 换餐 |
| PATCH | `/stations/:id/meal-orders/:id/leftover` | 管理员/管家 | 标记剩餐 |
| PATCH | `/stations/:id/meal-orders/:id/reject` | 管理员/管家 | 标记拒收（必填原因） |
| POST | `/stations/:id/meal-orders/:id/dispatch` | 管理员 | 派单给配送员 |
| GET | `/courier/deliveries?date=` | 配送员 | 我的配送任务 |
| POST | `/courier/deliveries/:id/scan-sign` | 配送员 | 扫码签收 |
| POST | `/courier/deliveries/:id/no-response` | 配送员 | 无应答上报 |
| GET | `/exceptions?status=` | 管家/管理员 | 异常单列表 |
| POST | `/exceptions/:id/assign` | 管家 | 认领异常 |
| POST | `/exceptions/:id/second-confirm` | 管家 | 二次确认（补送/回收/取消） |
| GET/PATCH | `/notifications`, `/notifications/:id/read` | 员工 | 站内通知 |
| GET | `/stats/daily?date=` | 管理员/管家 | 每日统计 |
| GET | `/family/profile` | 家属 | 老人膳食档案+停餐记录 |
| GET | `/family/meal-records` | 家属 | 仅自己老人的餐食记录 |
| POST | `/family/suspensions` | 家属 | 临时停餐申请 |

## 验证

```bash
# 后端单元测试
cd apps/server && npm test

# 代码检查
cd apps/server && npx eslint "src/**/*.ts"
cd apps/client && npx eslint .

# 构建
cd apps/server && npm run build
cd apps/client && npm run build
```
