# 助餐模块前端（React + Vite）

- `/`：平台入口（管理端 / 用户端选择）
- `/admin`：管理端（PC，antd）——排餐看板、异常二次确认、每日统计
- `/h5`：用户端（H5，antd-mobile）——配送员任务/扫码签收/无应答上报，家属餐食记录/临时停餐

```bash
npm run dev       # 开发（/api 代理到 localhost:3000，可用 VITE_API_ORIGIN 覆盖）
npm run build     # 构建
```
