import {
  AlertOutlined,
  BarChartOutlined,
  CarOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { App as AntApp, ConfigProvider, Layout, Menu } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import DeliveriesPage from './pages/DeliveriesPage';
import ExceptionsPage from './pages/ExceptionsPage';
import SchedulePage from './pages/SchedulePage';
import StatsPage from './pages/StatsPage';

dayjs.locale('zh-cn');

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/schedule', icon: <ScheduleOutlined />, label: '排餐管理' },
  { key: '/deliveries', icon: <CarOutlined />, label: '配送签收' },
  { key: '/exceptions', icon: <AlertOutlined />, label: '异常工单' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计分析' },
];

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const selected =
    menuItems.find((m) => location.pathname.startsWith(m.key))?.key ??
    '/schedule';

  return (
    <Layout className="admin-shell">
      <Sider width={216} className="admin-sider">
        <div className="brand">
          <div className="brand-logo">膳</div>
          <div>
            <div className="brand-name">社区助餐平台</div>
            <div className="brand-sub">阳光社区养老服务站</div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
        <div className="sider-footer">
          {dayjs().format('YYYY年M月D日 dddd')}
        </div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <span className="header-title">助餐服务管理台</span>
          <span className="header-user">陈站长 · 站点管理员</span>
        </Header>
        <Content className="admin-content">
          <Routes>
            <Route path="/" element={<Navigate to="/schedule" replace />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/deliveries" element={<DeliveriesPage />} />
            <Route path="/exceptions" element={<ExceptionsPage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function AdminApp() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#d9682b',
          colorInfo: '#d9682b',
          borderRadius: 8,
        },
      }}
    >
      <AntApp>
        <Shell />
      </AntApp>
    </ConfigProvider>
  );
}
