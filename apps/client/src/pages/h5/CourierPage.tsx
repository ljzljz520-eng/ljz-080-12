import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  Empty,
  Input,
  List,
  PullToRefresh,
  SpinLoading,
  Tag,
  Toast,
} from 'antd-mobile';
import { useNavigate } from 'react-router-dom';
import {
  api,
  DELIVERY_STATUS,
  fmtTime,
  todayStr,
  type CourierTask,
  type Identity,
} from '../../api';

type CourierIdentity = Extract<Identity, { kind: 'staff' }>;

/** 配送员：当日任务、到门扫码签收、无应答上报 */
export default function CourierPage({
  identity,
  onSwitch,
}: {
  identity: CourierIdentity;
  onSwitch: () => void;
}) {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayStr());
  const [tasks, setTasks] = useState<CourierTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTasks(await api<CourierTask[]>(`/courier/deliveries?date=${date}`));
    } catch (e) {
      Toast.show({ content: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const shiftDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    const p = (n: number) => String(n).padStart(2, '0');
    setDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  };

  /** 扫码签收：演示环境用输入框模拟扫码枪 */
  const scanSign = (task: CourierTask) => {
    let qr = '';
    Dialog.confirm({
      title: `扫码签收 · ${task.elder.name}`,
      content: (
        <div>
          <div style={{ fontSize: 13, color: '#8a7360', marginBottom: 8 }}>
            请扫描老人家门口的签收二维码
          </div>
          <Input
            placeholder="扫描或输入二维码内容"
            onChange={(v) => {
              qr = v;
            }}
          />
          <Button
            size="small"
            fill="outline"
            style={{ marginTop: 8 }}
            onClick={() => {
              qr = task.elder.qrCode;
              Toast.show({ content: '已模拟扫码，请点击确认' });
            }}
          >
            模拟扫码（演示）
          </Button>
        </div>
      ),
      confirmText: '确认签收',
      onConfirm: async () => {
        try {
          await api(`/courier/deliveries/${task.deliveryId}/scan-sign`, {
            method: 'POST',
            body: { qrCode: qr },
          });
          Toast.show({ icon: 'success', content: '签收成功' });
          void load();
        } catch (e) {
          Toast.show({ icon: 'fail', content: (e as Error).message });
          throw e;
        }
      },
    });
  };

  /** 无应答：不能直接算完成，上报后由管家二次确认 */
  const noResponse = (task: CourierTask) => {
    let note = '';
    Dialog.confirm({
      title: '老人无应答',
      content: (
        <div>
          <div style={{ fontSize: 13, color: '#8a7360', marginBottom: 8 }}>
            上报后将生成异常单并通知管家二次确认，本单不会自动完成
          </div>
          <Input
            placeholder="情况说明（如：敲门无人应答，电话未接）"
            onChange={(v) => {
              note = v;
            }}
          />
        </div>
      ),
      confirmText: '上报异常',
      onConfirm: async () => {
        try {
          await api(`/courier/deliveries/${task.deliveryId}/no-response`, {
            method: 'POST',
            body: { note },
          });
          Toast.show({ content: '已上报，等待管家二次确认' });
          void load();
        } catch (e) {
          Toast.show({ icon: 'fail', content: (e as Error).message });
          throw e;
        }
      },
    });
  };

  const pending = tasks.filter((t) =>
    ['pending', 'out_for_delivery'].includes(t.deliveryStatus),
  ).length;

  return (
    <div className="h5-page">
      <div className="h5-header">
        <div>
          <div className="h5-title">配送任务</div>
          <div className="h5-sub">
            {identity.name} · {identity.stationName}
          </div>
        </div>
        <Button size="mini" fill="outline" onClick={onSwitch}>
          切换身份
        </Button>
      </div>

      <div className="h5-datebar">
        <Button size="small" fill="none" onClick={() => shiftDate(-1)}>
          ‹ 前一天
        </Button>
        <div className="h5-date">
          {date}
          {date === todayStr() && <Tag color="primary">今天</Tag>}
        </div>
        <Button size="small" fill="none" onClick={() => shiftDate(1)}>
          后一天 ›
        </Button>
      </div>

      <div className="h5-summary">
        今日 {tasks.length} 单 · 待配送 {pending} 单
      </div>

      <PullToRefresh onRefresh={load}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <SpinLoading />
          </div>
        ) : tasks.length === 0 ? (
          <Empty description="当日暂无配送任务" />
        ) : (
          <List>
            {tasks.map((t) => {
              const st = DELIVERY_STATUS[t.deliveryStatus];
              const actionable = ['pending', 'out_for_delivery'].includes(
                t.deliveryStatus,
              );
              return (
                <div className="h5-card" key={t.deliveryId}>
                  <div className="h5-card-title">
                    <span>
                      {t.elder.name}
                      <span className="h5-room">{t.elder.roomNo}</span>
                    </span>
                    <Tag color={st?.color}>{st?.text ?? t.deliveryStatus}</Tag>
                  </div>
                  <div className="h5-card-sub">配送单 #{t.deliveryId}</div>
                  <div className="h5-menu">{t.menuText}</div>
                  <div className="h5-tags">
                    {t.dietTags.map((tag) => (
                      <Tag key={tag} color="success">
                        {tag}
                      </Tag>
                    ))}
                    {t.elder.dietaryRestrictions.map((r) => (
                      <Tag key={r} color="danger">
                        忌{r}
                      </Tag>
                    ))}
                    {t.elder.diabetic && <Tag color="warning">糖尿病餐</Tag>}
                    {t.elder.chewingDifficulty && <Tag color="primary">咀嚼困难</Tag>}
                  </div>
                  {t.deliveryStatus === 'signed' && (
                    <div className="h5-signed">已签收 {fmtTime(t.signedAt)}</div>
                  )}
                  {t.deliveryStatus === 'exception' && (
                    <div className="h5-exception">
                      已上报异常{t.exception ? `（#${t.exception.id}）` : ''}
                      ，等待管家二次确认
                    </div>
                  )}
                  {actionable && (
                    <div className="h5-actions">
                      <Button block color="primary" onClick={() => scanSign(t)}>
                        扫码签收
                      </Button>
                      <Button block color="warning" fill="outline" onClick={() => noResponse(t)}>
                        无应答
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </List>
        )}
      </PullToRefresh>
      <div className="h5-footer-link" onClick={() => navigate('/')}>
        返回平台入口
      </div>
    </div>
  );
}
