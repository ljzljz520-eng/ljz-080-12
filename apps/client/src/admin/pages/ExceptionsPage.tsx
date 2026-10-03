import { PhoneOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  App,
  Badge,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Segmented,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../shared/api';
import type { DeliveryException } from '../../shared/types';
import { MEAL_TYPE_LABELS } from '../../shared/types';

const METHOD_LABELS = {
  PHONE: '电话联系老人',
  VISIT: '上门查看',
  FAMILY_CONTACT: '联系家属',
} as const;

const RESULT_LABELS = {
  DELIVERED_CONFIRMED: '确认老人已收到餐',
  REDELIVER: '安排重新配送',
  CANCELLED: '确认取消（计入剩餐）',
} as const;

export default function ExceptionsPage() {
  const { message } = App.useApp();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED'>('OPEN');
  const [list, setList] = useState<DeliveryException[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<DeliveryException | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await api.exceptions(status));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirm = async () => {
    if (!target) return;
    const values = await form.validateFields();
    try {
      await api.confirmException(target.id, values.method, values.result, values.note);
      message.success('二次确认已提交，工单已闭环');
      setTarget(null);
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ColumnsType<DeliveryException> = [
    {
      title: '工单',
      dataIndex: 'id',
      width: 90,
      render: (id: string) => <span className="mono">{id}</span>,
    },
    {
      title: '老人',
      key: 'elder',
      width: 160,
      render: (_, e) => (
        <div>
          <div className="elder-name">{e.elder?.name}</div>
          <div className="muted">{e.elder?.address}</div>
        </div>
      ),
    },
    {
      title: '异常',
      key: 'reason',
      width: 200,
      render: (_, e) => (
        <div>
          <Tag color="error">老人未应答</Tag>
          {e.note && <div className="muted">配送员备注：{e.note}</div>}
        </div>
      ),
    },
    {
      title: '餐型 / 订单',
      key: 'order',
      width: 130,
      render: (_, e) =>
        e.order ? (
          <div>
            <Tag>{MEAL_TYPE_LABELS[e.order.mealType]}</Tag>
            <div className="muted mono">{e.orderId}</div>
          </div>
        ) : (
          '—'
        ),
    },
    {
      title: '上报时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm'),
    },
    {
      title: '状态 / 处理',
      key: 'status',
      render: (_, e) =>
        e.status === 'OPEN' ? (
          <Space direction="vertical" size={4}>
            <Badge status="processing" text="待管家二次确认" />
            <div className="muted">负责人：{e.assignee?.name ?? e.assigneeId}</div>
          </Space>
        ) : (
          <Timeline
            className="confirm-timeline"
            items={e.confirmations.map((c) => ({
              color: 'green',
              children: (
                <div>
                  <div>
                    {METHOD_LABELS[c.method]} → {RESULT_LABELS[c.result]}
                  </div>
                  <div className="muted">
                    {dayjs(c.at).format('MM-DD HH:mm')}
                    {c.note ? ` · ${c.note}` : ''}
                  </div>
                </div>
              ),
            }))}
          />
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      render: (_, e) =>
        e.status === 'OPEN' ? (
          <Button
            type="primary"
            size="small"
            icon={<PhoneOutlined />}
            onClick={() => {
              setTarget(e);
              form.setFieldsValue({ method: 'PHONE', result: undefined, note: '' });
            }}
          >
            二次确认
          </Button>
        ) : (
          <Tag color="success">已闭环</Tag>
        ),
    },
  ];

  return (
    <Card className="page-card">
      <div className="page-toolbar">
        <div>
          <Typography.Title level={4} className="page-title">
            配送异常工单
          </Typography.Title>
          <div className="muted">
            老人未应答的配送不会自动完成，需管家二次确认后闭环
          </div>
        </div>
        <Space>
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as 'OPEN' | 'RESOLVED')}
            options={[
              { label: '待处理', value: 'OPEN' },
              { label: '已闭环', value: 'RESOLVED' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
        </Space>
      </div>

      <Table<DeliveryException>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description={status === 'OPEN' ? '暂无待处理异常，一切正常' : '暂无已闭环工单'}
            />
          ),
        }}
      />

      <Modal
        title={target ? `二次确认 · ${target.elder?.name}` : '二次确认'}
        open={!!target}
        onOk={() => void handleConfirm()}
        onCancel={() => setTarget(null)}
        okText="提交确认结果"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="method"
            label="确认方式"
            rules={[{ required: true, message: '请选择确认方式' }]}
          >
            <Radio.Group
              options={Object.entries(METHOD_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="result"
            label="确认结果"
            rules={[{ required: true, message: '请选择确认结果' }]}
          >
            <Radio.Group
              className="result-radios"
              options={Object.entries(RESULT_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="如：电话联系老人，餐已放门口保温箱" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
