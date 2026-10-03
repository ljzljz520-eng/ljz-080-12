import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  App,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Statistic,
  Table,
  Typography,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtDate } from '../../shared/api';
import type { DailyStats } from '../../shared/types';

export default function StatsPage() {
  const { message } = App.useApp();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);

  const dateStr = useMemo(() => fmtDate(date.toDate()), [date]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await api.dailyStats(dateStr));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dateStr, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const deliveredRate =
    stats && stats.totalOrders > 0
      ? Math.round((stats.delivered / stats.totalOrders) * 100)
      : 0;

  return (
    <div>
      <Card className="page-card">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={4} className="page-title">
              每日助餐统计
            </Typography.Title>
            <div className="muted">剩餐、换餐、拒收原因与配送完成情况</div>
          </div>
          <DatePicker
            value={date}
            allowClear={false}
            onChange={(d) => d && setDate(d)}
          />
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={12} md={8} lg={4}>
            <Card className="stat-card" loading={loading}>
              <Statistic title="排餐总数" value={stats?.totalOrders ?? 0} suffix="份" />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card className="stat-card stat-green" loading={loading}>
              <Statistic
                title="已送达"
                value={stats?.delivered ?? 0}
                suffix="份"
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card className="stat-card stat-orange" loading={loading}>
              <Statistic
                title="剩餐"
                value={stats?.leftoverCount ?? 0}
                suffix="份"
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card className="stat-card stat-cyan" loading={loading}>
              <Statistic
                title="换餐"
                value={stats?.swapCount ?? 0}
                suffix="单"
                prefix={<SwapOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card className="stat-card stat-red" loading={loading}>
              <Statistic
                title="拒收"
                value={stats?.rejected ?? 0}
                suffix="单"
                prefix={<StopOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} md={8} lg={4}>
            <Card className="stat-card stat-purple" loading={loading}>
              <Statistic
                title="未应答异常"
                value={stats?.noResponse ?? 0}
                suffix="单"
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="stats-detail">
          <Col xs={24} lg={8}>
            <Card title="配送完成情况" className="detail-card">
              <div className="progress-wrap">
                <Progress
                  type="dashboard"
                  percent={deliveredRate}
                  strokeColor="#d9682b"
                />
                <div className="progress-legend">
                  <div>送达率 {deliveredRate}%</div>
                  <div className="muted">
                    配送中 {stats?.outForDelivery ?? 0} · 待配送{' '}
                    {stats?.scheduled ?? 0} · 取消/停餐 {stats?.cancelled ?? 0} ·
                    家属停餐 {stats?.suspensionCount ?? 0}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="拒收原因分布" className="detail-card">
              <Table
                rowKey="reason"
                size="small"
                pagination={false}
                dataSource={stats?.rejectionReasons ?? []}
                locale={{ emptyText: <Empty description="当日无拒收" /> }}
                columns={[
                  { title: '拒收原因', dataIndex: 'reason' },
                  {
                    title: '单数',
                    dataIndex: 'count',
                    width: 70,
                    align: 'right',
                  },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="剩餐来源" className="detail-card">
              <Table
                rowKey="reason"
                size="small"
                pagination={false}
                dataSource={stats?.leftoverSources ?? []}
                locale={{ emptyText: <Empty description="当日无剩餐" /> }}
                columns={[
                  { title: '来源', dataIndex: 'reason' },
                  {
                    title: '份数',
                    dataIndex: 'count',
                    width: 70,
                    align: 'right',
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
