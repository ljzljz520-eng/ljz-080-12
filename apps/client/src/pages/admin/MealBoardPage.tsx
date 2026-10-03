import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useOutletContext } from 'react-router-dom';
import {
  api,
  ORDER_STATUS,
  type Bootstrap,
  type Identity,
  type MealBoardRow,
} from '../../api';

const DIET_TAG_OPTIONS = ['糖尿病餐', '软食', '低盐', '低脂', '流食'];

/** 排餐看板：忌口 / 糖尿病餐 / 咀嚼困难 / 家属临时停餐说明一屏可见 */
export default function MealBoardPage() {
  const { message } = App.useApp();
  const { staff, bootstrap } = useOutletContext<{
    staff: Extract<Identity, { kind: 'staff' }>;
    bootstrap: Bootstrap | null;
  }>();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [rows, setRows] = useState<MealBoardRow[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = staff.role === 'station_admin';
  const couriers = useMemo(
    () => (bootstrap?.staff ?? []).filter((s) => s.role === 'courier'),
    [bootstrap],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<MealBoardRow[]>(
        `/stations/${staff.stationId}/meal-board?date=${date.format('YYYY-MM-DD')}`,
      );
      setRows(data);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [staff.stationId, date, message]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---------- 弹窗状态 ----------
  const [scheduleRow, setScheduleRow] = useState<MealBoardRow | null>(null);
  const [swapRow, setSwapRow] = useState<MealBoardRow | null>(null);
  const [dispatchRow, setDispatchRow] = useState<MealBoardRow | null>(null);
  const [rejectRow, setRejectRow] = useState<MealBoardRow | null>(null);
  const [leftoverRow, setLeftoverRow] = useState<MealBoardRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const derivedTags = (row: MealBoardRow) => {
    const tags: string[] = [];
    if (row.elder.diabetic) tags.push('糖尿病餐');
    if (row.elder.chewingDifficulty) tags.push('软食');
    return tags;
  };

  const openSchedule = (row: MealBoardRow) => {
    form.setFieldsValue({ menuText: '', dietTags: derivedTags(row) });
    setScheduleRow(row);
  };
  const openSwap = (row: MealBoardRow) => {
    form.setFieldsValue({
      menuText: row.order?.menuText ?? '',
      swapNote: '',
      dietTags: row.order?.dietTags ?? [],
    });
    setSwapRow(row);
  };

  const submit = async (fn: () => Promise<unknown>, ok: string) => {
    setSubmitting(true);
    try {
      await fn();
      message.success(ok);
      setScheduleRow(null);
      setSwapRow(null);
      setDispatchRow(null);
      setRejectRow(null);
      setLeftoverRow(null);
      form.resetFields();
      await load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const elderDietInfo = (row: MealBoardRow) => (
    <div className="diet-cell">
      {row.elder.dietaryRestrictions.length > 0 && (
        <div className="diet-line">
          <span className="diet-label">忌口</span>
          {row.elder.dietaryRestrictions.map((r) => (
            <Tag key={r} color="red">
              {r}
            </Tag>
          ))}
        </div>
      )}
      <div className="diet-line">
        {row.elder.diabetic && <Tag color="orange">糖尿病餐</Tag>}
        {row.elder.chewingDifficulty && <Tag color="geekblue">咀嚼困难·软食</Tag>}
        {!row.elder.diabetic &&
          !row.elder.chewingDifficulty &&
          row.elder.dietaryRestrictions.length === 0 && (
            <span style={{ color: '#bbb' }}>无特殊要求</span>
          )}
      </div>
      {row.elder.notes && (
        <Tooltip title={row.elder.notes}>
          <div className="diet-notes">备注：{row.elder.notes}</div>
        </Tooltip>
      )}
    </div>
  );

  const columns = [
    {
      title: '老人',
      key: 'elder',
      width: 150,
      render: (_: unknown, row: MealBoardRow) => (
        <div>
          <div className="elder-name">{row.elder.name}</div>
          <div className="elder-room">
            {row.elder.roomNo ?? '-'}
            {row.elder.age ? ` · ${row.elder.age}岁` : ''}
          </div>
        </div>
      ),
    },
    {
      title: '膳食要求（忌口 / 糖尿病餐 / 咀嚼困难）',
      key: 'diet',
      width: 260,
      render: (_: unknown, row: MealBoardRow) => elderDietInfo(row),
    },
    {
      title: '家属临时停餐',
      key: 'suspension',
      width: 220,
      render: (_: unknown, row: MealBoardRow) =>
        row.suspension ? (
          <div className="suspension-cell">
            <WarningOutlined /> {row.suspension.reason}
            <div className="suspension-meta">
              {row.suspension.startDate} ~ {row.suspension.endDate} · 家属：
              {row.suspension.createdByName}
            </div>
          </div>
        ) : (
          <span style={{ color: '#ccc' }}>—</span>
        ),
    },
    {
      title: '当日午餐',
      key: 'menu',
      render: (_: unknown, row: MealBoardRow) =>
        row.order ? (
          <div>
            <div className="menu-text">{row.order.menuText}</div>
            <Space size={4} wrap>
              {row.order.dietTags.map((t) => (
                <Tag key={t} color="green">
                  {t}
                </Tag>
              ))}
              {row.order.swappedAt && (
                <Tooltip title={`换餐说明：${row.order.swapNote ?? '-'}`}>
                  <Tag color="purple" icon={<SwapOutlined />}>
                    已换餐
                  </Tag>
                </Tooltip>
              )}
            </Space>
          </div>
        ) : (
          <span style={{ color: '#ccc' }}>未排餐</span>
        ),
    },
    {
      title: '状态 / 配送',
      key: 'status',
      width: 170,
      render: (_: unknown, row: MealBoardRow) => {
        if (!row.order) return <span style={{ color: '#ccc' }}>—</span>;
        const st = ORDER_STATUS[row.order.status] ?? {
          text: row.order.status,
          color: 'default',
        };
        return (
          <div>
            <Tag color={st.color}>{st.text}</Tag>
            {row.order.delivery && (
              <div className="delivery-meta">
                {row.order.delivery.courierName} 配送
                {row.order.delivery.signedAt &&
                  ` · ${dayjs(row.order.delivery.signedAt).format('HH:mm')} 签收`}
              </div>
            )}
            {row.order.rejectReason && (
              <div className="warn-meta">拒收：{row.order.rejectReason}</div>
            )}
            {row.order.leftoverNote && (
              <div className="warn-meta">剩餐：{row.order.leftoverNote}</div>
            )}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      render: (_: unknown, row: MealBoardRow) => {
        const order = row.order;
        const finished =
          order && ['signed', 'leftover', 'rejected', 'cancelled'].includes(order.status);
        return (
          <Space size={4} wrap>
            {!order && !row.suspension && isAdmin && (
              <Button size="small" type="primary" onClick={() => openSchedule(row)}>
                排餐
              </Button>
            )}
            {!order && row.suspension && (
              <Tooltip title="家属已申请临时停餐，当日不可排餐">
                <Button size="small" disabled icon={<StopOutlined />}>
                  已停餐
                </Button>
              </Tooltip>
            )}
            {order && !finished && isAdmin && (
              <>
                <Button size="small" icon={<EditOutlined />} onClick={() => openSwap(row)}>
                  换餐
                </Button>
                {order.status === 'scheduled' && (
                  <Button
                    size="small"
                    icon={<SendOutlined />}
                    onClick={() => { form.resetFields(); setDispatchRow(row); }}
                  >
                    派单
                  </Button>
                )}
              </>
            )}
            {order && !finished && (
              <>
                <Button size="small" onClick={() => { form.resetFields(); setLeftoverRow(row); }}>
                  剩餐
                </Button>
                <Button size="small" danger onClick={() => { form.resetFields(); setRejectRow(row); }}>
                  拒收
                </Button>
              </>
            )}
            {order?.status === 'signed' && (
              <Tag icon={<CheckCircleOutlined />} color="success">
                已完成
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  const summary = useMemo(() => {
    const scheduled = rows.filter((r) => r.order).length;
    const suspended = rows.filter((r) => r.suspension).length;
    const signed = rows.filter((r) => r.order?.status === 'signed').length;
    return { total: rows.length, scheduled, suspended, signed };
  }, [rows]);

  return (
    <div>
      <div className="board-toolbar">
        <Typography.Title level={4} style={{ margin: 0 }}>
          排餐看板
        </Typography.Title>
        <DatePicker
          value={date}
          allowClear={false}
          onChange={(d) => d && setDate(d)}
        />
        <Button onClick={() => setDate(dayjs())}>今天</Button>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} />
        <div className="board-summary">
          <Tag>老人 {summary.total}</Tag>
          <Tag color="blue">已排 {summary.scheduled}</Tag>
          <Tag color="orange">停餐 {summary.suspended}</Tag>
          <Tag color="success">已签收 {summary.signed}</Tag>
        </div>
      </div>

      <Spin spinning={loading}>
        <Table<MealBoardRow>
          rowKey={(r) => r.elder.id}
          columns={columns}
          dataSource={rows}
          pagination={false}
          locale={{ emptyText: <Empty description="该站点暂无老人档案" /> }}
          rowClassName={(r) =>
            r.suspension ? 'row-suspended' : r.order?.status === 'signed' ? 'row-done' : ''
          }
        />
      </Spin>

      {/* 排餐 */}
      <Modal
        title={`排午餐 · ${scheduleRow?.elder.name ?? ''}`}
        open={!!scheduleRow}
        confirmLoading={submitting}
        onCancel={() => setScheduleRow(null)}
        onOk={() =>
          form.validateFields().then((v) =>
            submit(
              () =>
                api(`/stations/${staff.stationId}/meal-orders`, {
                  method: 'POST',
                  body: {
                    elderId: scheduleRow!.elder.id,
                    mealDate: date.format('YYYY-MM-DD'),
                    menuText: v.menuText,
                    dietTags: v.dietTags,
                  },
                }),
              '排餐成功',
            ),
          )
        }
      >
        {scheduleRow && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="请核对老人膳食要求"
            description={
              <div>
                忌口：{scheduleRow.elder.dietaryRestrictions.join('、') || '无'}；
                {scheduleRow.elder.diabetic ? '需糖尿病餐；' : ''}
                {scheduleRow.elder.chewingDifficulty ? '咀嚼困难需软食；' : ''}
                {scheduleRow.elder.notes ?? ''}
              </div>
            }
          />
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="menuText"
            label="菜单"
            rules={[{ required: true, message: '请填写菜单' }]}
          >
            <Input.TextArea rows={2} placeholder="如：软米饭 + 蒸蛋羹 + 青菜碎 + 冬瓜汤" />
          </Form.Item>
          <Form.Item name="dietTags" label="膳食标签（默认按老人档案带出）">
            <Checkbox.Group options={DIET_TAG_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 换餐 */}
      <Modal
        title={`换餐 · ${swapRow?.elder.name ?? ''}`}
        open={!!swapRow}
        confirmLoading={submitting}
        onCancel={() => setSwapRow(null)}
        onOk={() =>
          form.validateFields().then((v) =>
            submit(
              () =>
                api(
                  `/stations/${staff.stationId}/meal-orders/${swapRow!.order!.id}/swap`,
                  {
                    method: 'PATCH',
                    body: {
                      menuText: v.menuText,
                      swapNote: v.swapNote,
                      dietTags: v.dietTags,
                    },
                  },
                ),
              '换餐成功',
            ),
          )
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="menuText"
            label="新菜单"
            rules={[{ required: true, message: '请填写新菜单' }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="swapNote"
            label="换餐说明"
            rules={[{ required: true, message: '请填写换餐说明' }]}
          >
            <Input placeholder="如：家属要求鸡腿换鱼 / 老人今日胃口差改软食" />
          </Form.Item>
          <Form.Item name="dietTags" label="膳食标签">
            <Checkbox.Group options={DIET_TAG_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 派单 */}
      <Modal
        title={`派单 · ${dispatchRow?.elder.name ?? ''}`}
        open={!!dispatchRow}
        confirmLoading={submitting}
        onCancel={() => setDispatchRow(null)}
        onOk={() =>
          form.validateFields().then((v) =>
            submit(
              () =>
                api(
                  `/stations/${staff.stationId}/meal-orders/${dispatchRow!.order!.id}/dispatch`,
                  { method: 'POST', body: { courierId: v.courierId } },
                ),
              '已派单',
            ),
          )
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="courierId"
            label="选择配送员"
            rules={[{ required: true, message: '请选择配送员' }]}
          >
            <Select
              options={couriers.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="选择本站点配送员"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 剩餐 */}
      <Modal
        title={`标记剩餐 · ${leftoverRow?.elder.name ?? ''}`}
        open={!!leftoverRow}
        confirmLoading={submitting}
        onCancel={() => setLeftoverRow(null)}
        onOk={() =>
          form.validateFields().then((v) =>
            submit(
              () =>
                api(
                  `/stations/${staff.stationId}/meal-orders/${leftoverRow!.order!.id}/leftover`,
                  { method: 'PATCH', body: { note: v.note } },
                ),
              '已标记剩餐',
            ),
          )
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="note" label="剩餐说明（可选）">
            <Input placeholder="如：老人食量减半，剩余约 1/2" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 拒收 */}
      <Modal
        title={`标记拒收 · ${rejectRow?.elder.name ?? ''}`}
        open={!!rejectRow}
        confirmLoading={submitting}
        onCancel={() => setRejectRow(null)}
        onOk={() =>
          form.validateFields().then((v) =>
            submit(
              () =>
                api(
                  `/stations/${staff.stationId}/meal-orders/${rejectRow!.order!.id}/reject`,
                  { method: 'PATCH', body: { reason: v.reason } },
                ),
              '已标记拒收',
            ),
          )
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label="拒收原因（必填，计入每日统计）"
            rules={[{ required: true, message: '拒收必须填写原因' }]}
          >
            <Input placeholder="如：菜品含忌口食材 / 老人身体不适拒食" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
