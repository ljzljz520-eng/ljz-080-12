import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Avatar,
  Badge,
  Button,
  Empty,
  Layout,
  List,
  Menu,
  Popover,
  Select,
  Spin,
  Tag,
} from 'antd';
import {
  AlertOutlined,
  BarChartOutlined,
  BellOutlined,
  HomeOutlined,
  LogoutOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  api,
  getIdentity,
  ROLE_NAME,
  saveIdentity,
  type Bootstrap,
  type Identity,
  type Notice,
} from '../../api';

const { Sider, Header, Content } = Layout;

/** 管理端只允许站点管理员与管家进入，配送员走 H5 */
const ADMIN_ROLES = ['station_admin', 'housekeeper'] as const;

export default function AdminLayout() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [identity, setIdentity] = useState<Identity | null>(() => getIdentity());
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    api<Bootstrap>('/meta/bootstrap').then(setBootstrap).catch(() => undefined);
  }, []);

  const staff =
    identity?.kind === 'staff' && (ADMIN_ROLES as readonly string[]).includes(identity.role)
      ? identity
      : null;

  const loadNotices = useCallback(() => {
    if (!staff) return;
    api<Notice[]>('/notifications').then(setNotices).catch(() => undefined);
  }, [staff]);

  useEffect(() => {
    loadNotices();
    const timer = setInterval(loadNotices, 10000);
    return () => clearInterval(timer);
  }, [loadNotices]);

  const unread = useMemo(() => notices.filter((n) => !n.read).length, [notices]);

  const pickStaff = (staffId: number) => {
    const s = bootstrap?.staff.find((x) => x.id === staffId);
    if (!s) return;
    const next: Identity = {
      kind: 'staff',
      id: s.id,
      name: s.name,
      role: s.role,
      stationId: s.station_id,
      stationName: s.station_name,
    };
    saveIdentity(next);
    setIdentity(next);
    message.success(`已切换为 ${s.name}（${ROLE_NAME[s.role]}）`);
  };

  if (!staff) {
    return (
      <div className="identity-page">
        <div className="identity-panel">
          <h2 style={{ marginTop: 0 }}>助餐管理端 · 选择工作人员身份</h2>
          <p style={{ color: '#8a7360', fontSize: 13 }}>
            演示环境免登录。配送员请使用「用户端（H5）」进行扫码签收。
          </p>
          {!bootstrap ? (
            <Spin />
          ) : (
            <List
              dataSource={bootstrap.staff.filter((s) =>
                (ADMIN_ROLES as readonly string[]).includes(s.role),
              )}
              renderItem={(s) => (
                <div className="identity-item">
                  <div>
                    <div className="identity-name">{s.name}</div>
                    <div className="identity-desc">
                      {ROLE_NAME[s.role]} · {s.station_name}
                    </div>
                  </div>
                  <Button type="primary" onClick={() => pickStaff(s.id)}>
                    进入
                  </Button>
                </div>
              )}
            />
          )}
          <Button
            type="link"
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            style={{ paddingLeft: 0 }}
          >
            返回平台入口
          </Button>
        </div>
      </div>
    );
  }

  const menuKey = location.pathname.split('/')[2] || 'board';

  const noticeContent = (
    <div style={{ width: 340, maxHeight: 400, overflow: 'auto' }}>
      <List
        size="small"
        dataSource={notices}
        locale={{ emptyText: <Empty description="暂无通知" /> }}
        renderItem={(n) => (
          <List.Item
            style={{ opacity: n.read ? 0.55 : 1, cursor: 'pointer' }}
            onClick={async () => {
              if (n.read) return;
              await api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(
                () => undefined,
              );
              loadNotices();
            }}
          >
            <List.Item.Meta
              title={
                <span>
                  {!n.read && <Badge status="processing" />} {n.title}
                </span>
              }
              description={n.content}
            />
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Layout className="admin-layout">
      <Sider theme="dark" width={208} breakpoint="lg">
        <div className="admin-logo">🍱 助餐管理</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuKey]}
          onClick={({ key }) => navigate(`/admin/${key}`)}
          items={[
            { key: 'board', icon: <ScheduleOutlined />, label: '排餐看板' },
            { key: 'exceptions', icon: <AlertOutlined />, label: '异常二次确认' },
            { key: 'stats', icon: <BarChartOutlined />, label: '每日统计' },
          ]}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <span className="station-name">{staff.stationName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Popover
              content={noticeContent}
              title={`站内通知（未读 ${unread}）`}
              trigger="click"
              placement="bottomRight"
            >
              <Badge count={unread} size="small">
                <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
              </Badge>
            </Popover>
            <Select
              size="small"
              style={{ width: 190 }}
              value={staff.id}
              onChange={pickStaff}
              options={bootstrap?.staff
                .filter((s) => (ADMIN_ROLES as readonly string[]).includes(s.role))
                .map((s) => ({
                  value: s.id,
                  label: `${s.name} · ${ROLE_NAME[s.role]}`,
                }))}
            />
            <Tag color="orange" style={{ marginInlineEnd: 0 }}>
              {ROLE_NAME[staff.role]}
            </Tag>
            <Avatar style={{ background: '#d9622b' }}>{staff.name[0]}</Avatar>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => {
                saveIdentity(null);
                navigate('/');
              }}
            />
          </div>
        </Header>
        <Content className="admin-content">
          <Outlet context={{ staff, bootstrap }} />
        </Content>
      </Layout>
    </Layout>
  );
}
