import { PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtDate, today } from '../../shared/api';
import type { MealType, ScheduleRow } from '../../shared/types';
import { MEAL_TYPE_LABELS, ORDER_STATUS_LABELS } from '../../shared/types';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'blue',
  OUT_FOR_DELIVERY: 'processing',
  DELIVERED: 'success',
  NO_RESPONSE: 'error',
  CANCELLED: 'default',
  REJECTED: 'warning',
};

const MEAL_COLORS: Record<MealType, string> = {
  REGULAR: 'default',
  DIABETIC: 'orange',
  SOFT: 'purple',
};

export default function SchedulePage() {
  const { message } = App.useApp();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [swapTarget, setSwapTarget] = useState<ScheduleRow | null>(null);
  const [planTarget, setPlanTarget] = useState<ScheduleRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ScheduleRow | null>(null);
  const [swapForm] = Form.useForm();
  const [planForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  const dateStr = useMemo(() => fmtDate(date.toDate()), [date]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.schedule(dateStr);
      setRows(res.rows);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dateStr, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const suspendedRows = rows.filter((r) => r.suspension);
  const plannedCount = rows.filter((r) => r.order).length;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateSchedule(dateStr);
      message.success(
        `已生成 ${res.created.length} 份排餐` +
          (res.skippedSuspended.length
            ? `，${res.skippedSuspended.length} 位老人因家属停餐已跳过`
            : ''),
      );
      await load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSwap = async () => {
    if (!swapTarget?.order) return;
    const values = await swapForm.validateFields();
    try {
      await api.swapMeal(swapTarget.order.id, values.mealType, values.reason);
      message.success(
        `已为 ${swapTarget.elder.name} 换餐：${MEAL_TYPE_LABELS[swapTarget.order.mealType as MealType]} → ${MEAL_TYPE_LABELS[values.mealType as MealType]}`,
      );
      setSwapTarget(null);
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handlePlan = async () => {
    if (!planTarget) return;
    const values = await planForm.validateFields();
    try {
      await api.createOrder(planTarget.elder.id, dateStr, values.mealType);
      message.success(`已为 ${planTarget.elder.name} 排餐`);
      setPlanTarget(null);
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget?.order) return;
    const values = await rejectForm.validateFields();
    try {
      await api.rejectOrder(rejectTarget.order.id, values.reason);
      message.warning(
        `已登记 ${rejectTarget.elder.name} 拒收，原因将计入今日统计`,
      );
      setRejectTarget(null);
      await load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ColumnsType<ScheduleRow> = [
    {
      title: '老人',
      key: 'elder',
      width: 170,
      render: (_, r) => (
        <Space>
          <div className="elder-avatar">{r.elder.name.slice(0, 1)}</div>
          <div>
            <div className="elder-name">{r.elder.name}</div>
            <div className="elder-meta">
              {r.elder.age}岁 · {r.elder.room}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: '饮食要求（排餐前必看）',
      key: 'dietary',
      render: (_, r) => (
        <Space size={[4, 4]} wrap>
          {r.elder.dietaryRestrictions.map((item) => (
            <Tag key={item} color="red">
              忌口·{item}
            </Tag>
          ))}
          {r.elder.diabetic && <Tag color="orange">糖尿病餐</Tag>}
          {r.elder.chewingDifficulty && <Tag color="purple">咀嚼困难·软食</Tag>}
          {!r.elder.dietaryRestrictions.length &&
            !r.elder.diabetic &&
            !r.elder.chewingDifficulty && (
              <span className="muted">无特殊要求</span>
            )}
          {r.elder.note && (
            <Tooltip title={r.elder.note}>
              <Tag color="gold">照护备注</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '家属停餐说明',
      key: 'suspension',
      width: 220,
      render: (_, r) =>
        r.suspension ? (
          <div className="suspension-note">
            <div className="suspension-tag">临时停餐</div>
            <div className="suspension-reason">{r.suspension.reason}</div>
          </div>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: '餐型',
      key: 'mealType',
      width: 150,
      render: (_, r) => {
        if (!r.order) {
          return <span className="muted">建议：{MEAL_TYPE_LABELS[r.suggestedMealType]}</span>;
        }
        return (
          <Space size={4} wrap>
            <Tag color={MEAL_COLORS[r.order.mealType]}>
              {MEAL_TYPE_LABELS[r.order.mealType]}
            </Tag>
            {r.order.swappedFrom && (
              <Tooltip title={`换餐原因：${r.order.swapReason ?? '—'}`}>
                <Tag icon={<SwapOutlined />} color="cyan">
                  由{MEAL_TYPE_LABELS[r.order.swappedFrom]}换餐
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_, r) => {
        if (r.suspension && r.order?.status === 'CANCELLED') {
          return <Tag>已停餐</Tag>;
        }
        if (!r.order) return <Tag color="default">未排餐</Tag>;
        return (
          <Tag color={STATUS_COLORS[r.order.status]}>
            {ORDER_STATUS_LABELS[r.order.status]}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, r) => {
        if (r.suspension) return <span className="muted">家属已停餐</span>;
        if (!r.order) {
          return (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<PlusOutlined />}
              onClick={() => {
                setPlanTarget(r);
                planForm.setFieldsValue({ mealType: r.suggestedMealType });
              }}
            >
              排餐
            </Button>
          );
        }
        if (['SCHEDULED', 'OUT_FOR_DELIVERY'].includes(r.order.status)) {
          return (
            <Space size={8}>
              <Button
                size="small"
                icon={<SwapOutlined />}
                onClick={() => {
                  setSwapTarget(r);
                  swapForm.setFieldsValue({
                    mealType: r.order!.mealType,
                    reason: '',
                  });
                }}
              >
                换餐
              </Button>
              <Button
                size="small"
                danger
                onClick={() => {
                  setRejectTarget(r);
                  rejectForm.setFieldsValue({ reason: '' });
                }}
              >
                拒收
              </Button>
            </Space>
          );
        }
        return <span className="muted">—</span>;
      },
    },
  ];

  return (
    <div>
      <Card className="page-card">
        <div className="page-toolbar">
          <div>
            <Typography.Title level={4} className="page-title">
              午餐排餐
            </Typography.Title>
            <div className="muted">
              排餐时请核对每位老人的忌口、糖尿病餐、咀嚼困难与家属停餐说明
            </div>
          </div>
          <Space>
            <DatePicker
              value={date}
              allowClear={false}
              onChange={(d) => d && setDate(d)}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              刷新
            </Button>
            <Button
              type="primary"
              loading={generating}
              onClick={() => void handleGenerate()}
            >
              一键生成排餐
            </Button>
          </Space>
        </div>

        {suspendedRows.length > 0 && (
          <Alert
            className="suspension-alert"
            type="warning"
            showIcon
            message={`${dateStr === today() ? '今日' : dateStr}有 ${suspendedRows.length} 位老人家属临时停餐`}
            description={
              <ul className="suspension-list">
                {suspendedRows.map((r) => (
                  <li key={r.elder.id}>
                    <b>{r.elder.name}</b>（{r.elder.room}）：
                    {r.suspension!.reason}
                  </li>
                ))}
              </ul>
            }
          />
        )}

        <div className="schedule-summary">
          共 {rows.length} 位老人 · 已排餐 {plannedCount} 位 · 家属停餐{' '}
          {suspendedRows.length} 位
        </div>

        <Table<ScheduleRow>
          rowKey={(r) => r.elder.id}
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          rowClassName={(r) => (r.suspension ? 'row-suspended' : '')}
        />
      </Card>

      <Modal
        title={swapTarget ? `换餐 · ${swapTarget.elder.name}` : '换餐'}
        open={!!swapTarget}
        onOk={() => void handleSwap()}
        onCancel={() => setSwapTarget(null)}
        okText="确认换餐"
        cancelText="取消"
        destroyOnHidden
      >
        {swapTarget && (
          <Alert
            type="info"
            showIcon
            className="modal-alert"
            message={`当前餐型：${MEAL_TYPE_LABELS[swapTarget.order!.mealType]}`}
            description={
              swapTarget.dietaryAlerts.length
                ? `饮食要求：${swapTarget.dietaryAlerts.join('；')}`
                : '该老人无特殊饮食要求'
            }
          />
        )}
        <Form form={swapForm} layout="vertical">
          <Form.Item
            name="mealType"
            label="新餐型"
            rules={[{ required: true, message: '请选择新餐型' }]}
          >
            <Select
              options={Object.entries(MEAL_TYPE_LABELS).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="换餐原因"
            rules={[{ required: true, message: '请填写换餐原因' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="如：老人今天牙口不适，临时换软食"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={planTarget ? `排餐 · ${planTarget.elder.name}` : '排餐'}
        open={!!planTarget}
        onOk={() => void handlePlan()}
        onCancel={() => setPlanTarget(null)}
        okText="确认排餐"
        cancelText="取消"
        destroyOnHidden
      >
        {planTarget && (
          <Alert
            type="warning"
            showIcon
            className="modal-alert"
            message="请核对饮食要求"
            description={
              planTarget.dietaryAlerts.length
                ? planTarget.dietaryAlerts.join('；')
                : '该老人无特殊饮食要求'
            }
          />
        )}
        <Form form={planForm} layout="vertical">
          <Form.Item
            name="mealType"
            label="餐型"
            rules={[{ required: true, message: '请选择餐型' }]}
          >
            <Select
              options={Object.entries(MEAL_TYPE_LABELS).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={rejectTarget ? `拒收登记 · ${rejectTarget.elder.name}` : '拒收登记'}
        open={!!rejectTarget}
        onOk={() => void handleReject()}
        onCancel={() => setRejectTarget(null)}
        okText="确认拒收"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          className="modal-alert"
          message="拒收后该餐将计入今日剩餐，并进入拒收原因统计"
        />
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="拒收原因"
            rules={[{ required: true, message: '请填写拒收原因' }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="如：老人临时去医院，家属要求退回"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
