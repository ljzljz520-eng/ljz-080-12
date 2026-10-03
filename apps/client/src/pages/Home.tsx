import { useNavigate } from 'react-router-dom';

/** 平台入口：管理端（PC）/ 用户端（H5） */
export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="home-page">
      <div className="home-title">社区养老协作平台</div>
      <div className="home-sub">助餐模块 · 排餐 / 配送 / 异常二次确认 / 剩餐统计</div>
      <div className="entry-cards">
        <div className="entry-card" onClick={() => navigate('/admin')}>
          <div className="entry-icon">🍱</div>
          <h2>管理端（PC）</h2>
          <p>
            站点排餐看板：老人忌口、糖尿病餐、咀嚼困难、家属临时停餐说明一屏掌握；
            换餐 / 剩餐 / 拒收登记，配送异常二次确认与每日统计。
          </p>
        </div>
        <div className="entry-card" onClick={() => navigate('/h5')}>
          <div className="entry-icon">📱</div>
          <h2>用户端（H5）</h2>
          <p>
            配送员：送餐任务、到门扫码签收、老人无应答上报；
            家属：查看自家老人餐食记录、申请临时停餐。
          </p>
        </div>
      </div>
    </div>
  );
}
