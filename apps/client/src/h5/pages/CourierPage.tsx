import {
  Button,
  Dialog,
  Empty,
  Input,
  NavBar,
  Space,
  Tag,
  Toast,
} from 'antd-mobile';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, today } from '../../shared/api';
import type { Delivery } from '../../shared/types';
import { DELIVERY_STATUS_LABELS, MEAL_TYPE_LABELS } from '../../shared/types';
import { getRole } from '../role';

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#ff8f1f',
  SIGNED: '#00b578',
  NO_RESPONSE: '#ff3141',
  CLOSED: '#999999',
};

export default function CourierPage() {
  const navigate = useNavigate();
  const role = getRole();
  const [list, setList] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  const load = useCallback(async () => {
    if (!role || role.kind !== 'courier') return;
    setLoading(true);
    try {
      setList(await api.deliveries(today(), role.id));
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!role || role.kind !== 'courier') {
      navigate('/', { replace: true });
      return;
    }
    void load();
  }, [role, navigate, load]);

  const reportNoResponse = async (d: Delivery) => {
    const confirmed = await Dialog.confirm({
      title: '老人未应答？',
      content: `确认 ${d.elder?.name} 家敲门无人应答吗？上报后订单不会算完成，将通知管家二次确认。`,
      confirmText: '确认上报',
      cancelText: '再敲敲门',
    });
    if (!confirmed) return;
    try {
      await api.reportNoResponse(d.id, '敲门无人应答');
      Toast.show({ content: '已上报，管家将安排二次确认' });
      await load();
    } catch (e) {
      Toast.show({ icon: 'fail', content: (e as Error).message });
    }
  };

  const openManualToken = () => {
    const token = tokenInput.trim();
    if (!token) {
      Toast.show({ content: '请输入签收码' });
      return;
    }
    navigate(`/sign/${encodeURIComponent(token)}`);
  };

  const pending = list.filter((d) => d.status === 'PENDING');
  const finished = list.filter((d) => d.status !== 'PENDING');

  return (
    <div className="page">
      <NavBar onBack={() => navigate('/')}>今日配送</NavBar>
      <div className="courier-banner">
        <div>
          <div className="family-name">{role?.name}</div>
          <div className="family-elders">
            {today()} · 待送 {pending.length} 单 · 已处理 {finished.length} 单
          </div>
        </div>
        <Button size="small" color="primary" fill="outline" loading={loading} onClick={() => void load()}>
          刷新
        </Button>
      </div>

      <div className="manual-token">
        <Input
          placeholder="手动输入签收码（如 QR-XXXX）"
          value={tokenInput}
          onChange={setTokenInput}
          clearable
        />
        <Button color="primary" onClick={openManualToken}>
          打开签收
        </Button>
      </div>

      <div className="tab-body">
        {list.length === 0 && !loading && (
          <Empty description="今日暂无配送任务" />
        )}
        {list.map((d) => (
          <div key={d.id} className="delivery-card">
            <div className="meal-card-head">
              <span className="meal-card-elder">
                {d.elder?.name}
                <span className="delivery-room">{d.elder?.room}</span>
              </span>
              <Tag color={STATUS_COLORS[d.status]} fill="solid" round>
                {DELIVERY_STATUS_LABELS[d.status]}
              </Tag>
            </div>
            <div className="delivery-addr">{d.elder?.address}</div>
            <div className="delivery-tags">
              <Tag color="primary" fill="outline">
                {d.order ? MEAL_TYPE_LABELS[d.order.mealType] : '—'}
              </Tag>
              {d.elder?.dietaryRestrictions.map((r) => (
                <Tag key={r} color="danger" fill="outline">
                  忌口·{r}
                </Tag>
              ))}
              {d.elder?.diabetic && (
                <Tag color="warning" fill="outline">
                  糖尿病餐
                </Tag>
              )}
              {d.elder?.chewingDifficulty && (
                <Tag color="#722ed1" fill="outline">
                  咀嚼困难
                </Tag>
              )}
            </div>
            {d.elder?.note && <div className="delivery-note">{d.elder.note}</div>}
            {d.status === 'PENDING' && (
              <Space block className="delivery-actions">
                <Button
                  block
                  color="primary"
                  onClick={() => navigate(`/sign/${encodeURIComponent(d.qrToken)}`)}
                >
                  扫码签收
                </Button>
                <Button
                  block
                  color="danger"
                  fill="outline"
                  onClick={() => void reportNoResponse(d)}
                >
                  老人未应答
                </Button>
              </Space>
            )}
            {d.status === 'NO_RESPONSE' && (
              <div className="no-response-tip">
                已上报异常，等待管家二次确认，暂不能签收
              </div>
            )}
            {d.status === 'SIGNED' && d.signedAt && (
              <div className="signed-tip">
                {new Date(d.signedAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                已签收（{d.signChannel === 'QR_SCAN' ? '扫码签收' : '管家确认'}）
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
