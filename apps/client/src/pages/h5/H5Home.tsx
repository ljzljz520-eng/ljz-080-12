import { useEffect, useState } from 'react';
import { Button, Empty, SpinLoading, Tabs, Toast } from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import {
  api,
  getIdentity,
  saveIdentity,
  type Bootstrap,
  type Identity,
} from '../../api';
import CourierPage from './CourierPage';
import FamilyPage from './FamilyPage';

/** H5 用户端：配送员 / 家属 两种身份 */
export default function H5Home() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<Identity | null>(() => getIdentity());
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [tab, setTab] = useState<'courier' | 'family'>('courier');

  useEffect(() => {
    api<Bootstrap>('/meta/bootstrap')
      .then(setBootstrap)
      .catch((e) => Toast.show({ content: (e as Error).message }));
  }, []);

  const pick = (next: Identity) => {
    saveIdentity(next);
    setIdentity(next);
  };

  const switchIdentity = () => {
    saveIdentity(null);
    setIdentity(null);
  };

  // 已选身份 → 直接进入对应页面
  if (identity?.kind === 'staff' && identity.role === 'courier') {
    return <CourierPage identity={identity} onSwitch={switchIdentity} />;
  }
  if (identity?.kind === 'family') {
    return <FamilyPage identity={identity} onSwitch={switchIdentity} />;
  }

  // 身份选择页
  return (
    <div className="h5-page">
      <div className="h5-header">
        <div>
          <div className="h5-title">助餐用户端</div>
          <div className="h5-sub">请选择使用身份（演示免登录）</div>
        </div>
        <Button size="mini" fill="outline" onClick={() => navigate('/')}>
          返回入口
        </Button>
      </div>
      <Tabs activeKey={tab} onChange={(k) => setTab(k as 'courier' | 'family')}>
        <Tabs.Tab title="配送员" key="courier" />
        <Tabs.Tab title="家属" key="family" />
      </Tabs>
      <div className="h5-body">
        {!bootstrap ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SpinLoading />
          </div>
        ) : tab === 'courier' ? (
          bootstrap.staff
            .filter((s) => s.role === 'courier')
            .map((s) => (
              <div className="identity-item" key={s.id}>
                <div>
                  <div className="identity-name">{s.name}</div>
                  <div className="identity-desc">配送员 · {s.station_name}</div>
                </div>
                <Button
                  size="small"
                  color="primary"
                  onClick={() =>
                    pick({
                      kind: 'staff',
                      id: s.id,
                      name: s.name,
                      role: s.role,
                      stationId: s.station_id,
                      stationName: s.station_name,
                    })
                  }
                >
                  进入
                </Button>
              </div>
            ))
        ) : bootstrap.families.length === 0 ? (
          <Empty description="暂无家属账号" />
        ) : (
          bootstrap.families.map((f) => (
            <div className="identity-item" key={f.id}>
              <div>
                <div className="identity-name">
                  {f.name}（{f.relation}）
                </div>
                <div className="identity-desc">老人：{f.elder_name}</div>
              </div>
              <Button
                size="small"
                color="primary"
                onClick={() =>
                  pick({
                    kind: 'family',
                    id: f.id,
                    name: f.name,
                    relation: f.relation,
                    elderId: f.elder_id,
                    elderName: f.elder_name,
                  })
                }
              >
                进入
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
