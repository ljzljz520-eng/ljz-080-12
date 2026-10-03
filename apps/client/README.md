# client — 前端（双入口）

## 入口

| 入口 | 端 | 技术 | 页面 |
| --- | --- | --- | --- |
| `index.html` | PC 管理端 | antd | 排餐管理 / 配送签收 / 异常工单 / 统计分析 |
| `h5.html` | H5 用户端 | antd-mobile | 家属端（餐食记录、临时停餐）/ 配送员端（扫码签收、未应答上报） |

## 目录

```
src/
  admin/    # PC 管理端（站点排餐、配送、异常、统计）
  h5/       # H5 用户端（家属 + 配送员）
  shared/   # 共享类型与 API 封装
```

## 开发

```bash
npm run dev     # Vite 开发服务器，/api 代理到 http://localhost:3000
npm run build   # 产物输出 dist/（index.html + h5.html）
```

生产环境由 nginx 承载（见 `nginx.conf`）：`/api` 反向代理到后端，`/h5.html` 为 H5 入口。
