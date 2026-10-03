import { QrcodeOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtDate } from '../../shared/api';
import type { Delivery, Staff } from '../../shared/types';
import {
  DELIVERY_STATUS_LABELS,
  MEAL_TYPE_LABELS,
} from '../../shared/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'processing',
  SIGNED: 'success',
  NO_RESPONSE: 'error',
  CLOSED: 'default',
};

function signUrl(token: string): string {
  return `${window.location.origin}/h5.html#/sign/${token}`;
}

function QrPopover({ token }: { token: string }) {
  const [img, setImg] = useState<string>('');
  const url = signUrl(token);
  return (
    <Popover
      trigger="click"
      placement="left"
      onOpenChange={async (open) => {
        if (open && !img) {
          setImg(await QRCode.toDataURL(url, { width: 200, margin: 1 }));
        }
      }}
      content={
        <div className="qr-pop">
          {img ? <img src={img} alt="签收二维码" /> : '生成中…'}
          <div className="qr-tip">配送员到门口后用 H5 扫码签收</div>
          <div className="qr-token">{token}</div>
        </div>
      }
    >
      <Button size="small" icon={<QrcodeOutlined />}>
        签收码
      </Button>
    </Popover>
  );
}

export default function DeliveriesPage() {
  const { message } = App.useApp();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [couriers, setCouriers] = useState<Staff[]>([]);
  const [courierId, setCourierId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const dateStr = useMemo(() => fmtDate(date.toDate()), [date]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDeliveries(await api.deliveries(dateStr));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [dateStr, message]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .staff('COURIER')
      .then((list) => {
        setCouriers(list);
        if (list.length) setCourierId(list[0].id);
      })
      .catch((e) => message.error((e as Error).message));
  }, [message]);

  const handleDispatch = async () => {
    if (!courierId) {
      message.warning('请先选择配送员');
      return;
    }
    setDispatching(true);
    try {
      const res = await api.dispatch(dateStr, courierId);
      if (res.created.length === 0) {
        message.info('没有可出餐的订单（需先完成排餐，且订单未在配送中）');
      } else {
        message.success(`已生成 ${res.created.length} 个配送任务`);
      }
      await load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setDispatching(false);
    }
  };

  const columns: ColumnsType<Delivery> = [
    {
      title: '配送单',
      dataIndex: 'id',
      width: 100,
      render: (id: string) => <span className="mono">{id}</span>,
    },
    {
      title: '老人 / 地址',
      key: 'elder',
      render: (_, d) => (
        <div>
          <div className="elder-name">
            {d.elder?.name}
            <span className="elder-meta">（{d.elder?.room}）</span>
          </div>
          <div className="muted">{d.elder?.address}</div>
        </div>
      ),
    },
    {
      title: '餐型',
      key: 'mealType',
      width: 100,
      render: (_, d) =>
        d.order ? (
          <Tag>{MEAL_TYPE_LABELS[d.order.mealType]}</Tag>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: Delivery['status']) => (
        <Tag color={STATUS_COLORS[s]}>{DELIVERY_STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: '签收信息',
      key: 'signed',
      width: 220,
      render: (_, d) =>
        d.signedAt ? (
          <div>
            <div>{dayjs(d.signedAt).format('HH:mm:ss')} 签收</div>
            <div className="muted">
              {d.signChannel === 'QR_SCAN' ? '门口扫码签收' : '管家二次确认签收'}
            </div>
          </div>
        ) : (
          <span className="muted">未签收</span>
        ),
    },
    {
      title: '签收二维码',
      key: 'qr',
      width: 120,
      render: (_, d) =>
        d.status === 'PENDING' ? (
          <QrPopover token={d.qrToken} />
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <Card className="page-card">
      <div className="page-toolbar">
        <div>
          <Typography.Title level={4} className="page-title">
            配送签收
          </Typography.Title>
          <div className="muted">
            出餐后生成签收二维码，配送员到老人门口扫码签收；未应答将自动生成异常工单
          </div>
        </div>
        <Space>
          <DatePicker
            value={date}
            allowClear={false}
            onChange={(d) => d && setDate(d)}
          />
          <Select
            className="courier-select"
            value={courierId || undefined}
            placeholder="选择配送员"
            onChange={setCourierId}
            options={couriers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={dispatching}
            onClick={() => void handleDispatch()}
          >
            出餐并生成交付任务
          </Button>
        </Space>
      </div>

      <Table<Delivery>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={deliveries}
        pagination={false}
        locale={{
          emptyText: (
            <Empty description="当日暂无配送任务，请先排餐后点击右上角出餐" />
          ),
        }}
      />
    </Card>
  );
}
