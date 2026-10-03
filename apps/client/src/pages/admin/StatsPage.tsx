import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { api, type DailyStats } from '../../api';

/** 每日统计：剩餐 / 换餐 / 拒收原因 / 无应答异常 */
export default function StatsPage() {
  const { message } = App.useApp();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStats(
        await api<DailyStats>(`/stats/daily?date=${date.format('YYYY-MM-DD')}`),
      );
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const o = stats?.orders;
  const maxReject = Math.max(1, ...(stats?.rejectReasons.map((r) => r.count) ?? [1]));

  return (
    <div>
      <div className="board-toolbar">
        <Typography.Title level={4} style={{ margin: 0 }}>
          每日统计
        </Typography.Title>
        <DatePicker value={date} allowClear={false} onChange={(d) => d && setDate(d)} />
      </div>

      <Spin spinning={loading}>
        {stats && o && (
          <>
            <Row gutter={[12, 12]} className="stat-cards">
              {[
                { title: '订餐总数', value: o.total, color: '#4a3423' },
                { title: '已签收', value: o.signed, color: '#3f8600' },
                { title: '剩餐', value: o.leftover, color: '#cf8a1e' },
                { title: '换餐', value: o.swapped, color: '#722ed1' },
                { title: '拒收', value: o.rejected, color: '#cf1322' },
                { title: '进行中', value: o.in_progress, color: '#1677ff' },
                { title: '已取消', value: o.cancelled, color: '#999' },
              ].map((s) => (
                <Col key={s.title} flex="1 1 120px">
                  <Card size="small">
                    <Statistic
                      title={s.title}
                      value={s.value}
                      valueStyle={{ color: s.color, fontSize: 26 }}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} lg={14}>
                <Card
                  title="拒收原因统计"
                  size="small"
                  extra={<Tag color="red">{o.rejected} 单</Tag>}
                >
                  {stats.rejectReasons.length === 0 ? (
                    <Empty description="当日无拒收" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <Table
                      rowKey="reason"
                      size="small"
                      pagination={false}
                      dataSource={stats.rejectReasons}
                      columns={[
                        { title: '拒收原因', dataIndex: 'reason' },
                        {
                          title: '次数',
                          dataIndex: 'count',
                          width: 220,
                          render: (count: number) => (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Progress
                                percent={Math.round((count / maxReject) * 100)}
                                showInfo={false}
                                strokeColor="#cf1322"
                                style={{ flex: 1 }}
                              />
                              <b>{count}</b>
                            </div>
                          ),
                        },
                      ]}
                    />
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card title="无应答异常（二次确认）" size="small">
                  <Row gutter={12}>
                    <Col span={8}>
                      <Statistic title="异常总数" value={stats.noResponseExceptions.total} />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="已办结"
                        value={stats.noResponseExceptions.resolved}
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="待处理"
                        value={stats.noResponseExceptions.open}
                        valueStyle={{
                          color: stats.noResponseExceptions.open > 0 ? '#cf1322' : '#999',
                        }}
                      />
                    </Col>
                  </Row>
                  <div style={{ marginTop: 12, color: '#8a7360', fontSize: 12 }}>
                    老人无应答时配送单不会自动完成，须管家二次确认（补送 / 回收记剩餐 /
                    取消订餐）后办结。
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}
