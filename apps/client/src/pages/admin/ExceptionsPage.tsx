import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Radio,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { ReloadOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useOutletContext } from 'react-router-dom';
import {
  api,
  EXCEPTION_STATUS,
  SECOND_CONFIRM_RESULT,
  type ExceptionItem,
  type Identity,
} from '../../api';

/** 配送异常（老人无应答）：管家认领 + 二次确认 */
export default function ExceptionsPage() {
  const { message } = App.useApp();
  const { staff } = useOutletContext<{
    staff: Extract<Identity, { kind: 'staff' }>;
  }>();
  const [status, setStatus] = useState<string>('all');
  const [rows, setRows] = useState<ExceptionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmRow, setConfirmRow] = useState<ExceptionItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const isHousekeeper = staff.role === 'housekeeper';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = status === 'all' ? '' : `?status=${status}`;
      setRows(await api<ExceptionItem[]>(`/exceptions${q}`));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const assign = async (row: ExceptionItem) => {
    try {
      await api(`/exceptions/${row.id}/assign`, { method: 'POST' });
      message.success('已认领，请尽快完成二次确认');
      void load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns = [
    {
      title: '异常单',
      key: 'id',
      width: 90,
      render: (_: unknown, r: ExceptionItem) => `#${r.id}`,
    },
    {
      title: '老人 / 房间',
      key: 'elder',
      width: 130,
      render: (_: unknown, r: ExceptionItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.elder.name}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.elder.roomNo}</div>
        </div>
      ),
    },
    {
      title: '餐单',
      key: 'order',
      render: (_: unknown, r: ExceptionItem) => (
        <div>
          <div>{r.order.menuText}</div>
          <div style={{ color: '#999', fontSize: 12 }}>{r.order.mealDate} 午餐</div>
        </div>
      ),
    },
    {
      title: '配送员上报',
      key: 'report',
      width: 220,
      render: (_: unknown, r: ExceptionItem) => (
        <div>
          <div>{r.courierName}</div>
          <div style={{ color: '#8a7360', fontSize: 12 }}>
            {r.courierNote || '老人无应答'}
          </div>
          <div style={{ color: '#bbb', fontSize: 12 }}>
            {dayjs(r.createdAt).format('MM-DD HH:mm')}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_: unknown, r: ExceptionItem) => {
        const st = EXCEPTION_STATUS[r.status];
        return <Tag color={st?.color}>{st?.text ?? r.status}</Tag>;
      },
    },
    {
      title: '管家 / 二次确认',
      key: 'confirm',
      width: 240,
      render: (_: unknown, r: ExceptionItem) => (
        <div>
          <div>
            <UserOutlined /> {r.housekeeper?.name ?? '待认领'}
          </div>
          {r.secondConfirm && (
            <Tooltip title={r.secondConfirm.note}>
              <div style={{ fontSize: 12, color: '#8a7360' }}>
                结论：{SECOND_CONFIRM_RESULT[r.secondConfirm.result]} ·{' '}
                {dayjs(r.secondConfirm.confirmedAt).format('MM-DD HH:mm')}
              </div>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 190,
      render: (_: unknown, r: ExceptionItem) => {
        if (r.status === 'resolved') return <Tag color="success">已办结</Tag>;
        if (!isHousekeeper)
          return <span style={{ color: '#bbb', fontSize: 12 }}>由管家处理</span>;
        return (
          <Space size={4}>
            {r.status === 'pending' && (
              <Button size="small" onClick={() => void assign(r)}>
                认领
              </Button>
            )}
            <Button
              size="small"
              type="primary"
              onClick={() => {
                form.resetFields();
                setConfirmRow(r);
              }}
            >
              二次确认
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div className="board-toolbar">
        <Typography.Title level={4} style={{ margin: 0 }}>
          配送异常 · 二次确认
        </Typography.Title>
        <Segmented
          value={status}
          onChange={(v) => setStatus(v as string)}
          options={[
            { label: '全部', value: 'all' },
            { label: '待处理', value: 'pending' },
            { label: '确认中', value: 'confirming' },
            { label: '已办结', value: 'resolved' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load()} />
      </div>

      <Spin spinning={loading}>
        <Table<ExceptionItem>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无配送异常" /> }}
        />
      </Spin>

      <Modal
        title={`二次确认 · 异常单 #${confirmRow?.id ?? ''}`}
        open={!!confirmRow}
        confirmLoading={submitting}
        onCancel={() => setConfirmRow(null)}
        onOk={() =>
          form.validateFields().then(async (v) => {
            setSubmitting(true);
            try {
              await api(`/exceptions/${confirmRow!.id}/second-confirm`, {
                method: 'POST',
                body: { result: v.result, note: v.note },
              });
              message.success('二次确认已提交');
              setConfirmRow(null);
              void load();
            } catch (e) {
              message.error((e as Error).message);
            } finally {
              setSubmitting(false);
            }
          })
        }
      >
        {confirmRow && (
          <div className="exception-brief">
            老人 <b>{confirmRow.elder.name}</b>（{confirmRow.elder.roomNo}）配送无应答，
            配送员：{confirmRow.courierName}
            {confirmRow.courierNote ? `，备注：${confirmRow.courierNote}` : ''}
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="result"
            label="确认结论"
            rules={[{ required: true, message: '请选择确认结论' }]}
          >
            <Radio.Group>
              <Radio.Button value="reschedule">补送</Radio.Button>
              <Radio.Button value="recycle">回收记剩餐</Radio.Button>
              <Radio.Button value="cancel">取消订餐</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="note"
            label="确认说明（必填）"
            rules={[{ required: true, message: '二次确认必须填写说明' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="如：已电话联系家属，老人在午睡，安排 13:30 补送"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
