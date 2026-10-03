import {
  Button,
  Dialog,
  DotLoading,
  Empty,
  NavBar,
  Tag,
  TextArea,
  Toast,
} from 'antd-mobile';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/api';
import type { Delivery } from '../../shared/types';
import { MEAL_TYPE_LABELS } from '../../shared/types';

export default function SignPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [nrOpen, setNrOpen] = useState(false);
  const [nrNote, setNrNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDelivery(await api.deliveryByToken(token));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const sign = async () => {
    setSigning(true);
    try {
      const res = await api.scanSign(token);
      setDelivery(res);
      Toast.show({ icon: 'success', content: '签收成功，本单已完成' });
    } catch (e) {
      Toast.show({ icon: 'fail', content: (e as Error).message });
      await load();
    } finally {
      setSigning(false);
    }
  };

  const reportNoResponse = async () => {
    if (!delivery) return;
    try {
      await api.reportNoResponse(delivery.id, nrNote.trim() || undefined);
      Toast.show({ content: '已上报异常，管家将安排二次确认' });
      setNrOpen(false);
      await load();
    } catch (e) {
      Toast.show({ icon: 'fail', content: (e as Error).message });
    }
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate(-1)}>扫码签收</NavBar>
      {loading && (
        <div className="loading-wrap">
          <DotLoading color="primary" />
        </div>
      )}
      {!loading && error && (
        <div>
          <Empty description={error} />
          <div className="sign-body">
            <Button block color="primary" onClick={() => navigate('/')}>
              返回首页
            </Button>
          </div>
        </div>
      )}
      {!loading && delivery && (
        <div className="sign-body">
          <div className="sign-card">
            <div className="sign-elder">{delivery.elder?.name}</div>
            <div className="sign-addr">{delivery.elder?.address}</div>
            <div className="delivery-tags sign-tags">
              <Tag color="primary" fill="outline">
                {delivery.order ? MEAL_TYPE_LABELS[delivery.order.mealType] : '—'}
              </Tag>
              {delivery.elder?.dietaryRestrictions.map((r) => (
                <Tag key={r} color="danger" fill="outline">
                  忌口·{r}
                </Tag>
              ))}
              {delivery.elder?.diabetic && (
                <Tag color="warning" fill="outline">
                  糖尿病餐
                </Tag>
              )}
              {delivery.elder?.chewingDifficulty && (
                <Tag color="#722ed1" fill="outline">
                  咀嚼困难
                </Tag>
              )}
            </div>
            {delivery.elder?.note && (
              <div className="delivery-note">{delivery.elder.note}</div>
            )}
          </div>

          {delivery.status === 'PENDING' && (
            <>
              <Button
                block
                color="primary"
                size="large"
                loading={signing}
                className="sign-btn"
                onClick={() => void sign()}
              >
                确认送达并签收
              </Button>
              <Button
                block
                color="danger"
                fill="outline"
                className="nr-btn"
                onClick={() => setNrOpen(true)}
              >
                老人未应答
              </Button>
              <div className="sign-hint">
                老人未应答时订单不会算完成，将自动生成异常工单通知管家二次确认
              </div>
            </>
          )}
          {delivery.status === 'SIGNED' && (
            <div className="sign-result success">
              <div className="sign-result-icon">✓</div>
              <div className="sign-result-text">本单已签收</div>
              {delivery.signedAt && (
                <div className="sign-result-sub">
                  {new Date(delivery.signedAt).toLocaleString('zh-CN')}
                  {delivery.signChannel === 'HOUSEKEEPER_CONFIRM'
                    ? ' · 管家二次确认'
                    : ' · 扫码签收'}
                </div>
              )}
            </div>
          )}
          {delivery.status === 'NO_RESPONSE' && (
            <div className="sign-result warn">
              <div className="sign-result-icon">!</div>
              <div className="sign-result-text">老人未应答，异常处理中</div>
              <div className="sign-result-sub">
                本单暂不能签收，等待管家二次确认
              </div>
            </div>
          )}
          {delivery.status === 'CLOSED' && (
            <div className="sign-result closed">
              <div className="sign-result-text">本单已关闭（订单已取消）</div>
            </div>
          )}
        </div>
      )}

      <Dialog
        visible={nrOpen}
        title="上报老人未应答"
        content={
          <TextArea
            placeholder="补充说明（选填），如：敲门3分钟无人应答，电话未接"
            value={nrNote}
            onChange={setNrNote}
            rows={3}
            maxLength={100}
          />
        }
        actions={[
          [
            { key: 'cancel', text: '取消', onClick: () => setNrOpen(false) },
            {
              key: 'ok',
              text: '确认上报',
              danger: true,
              onClick: () => void reportNoResponse(),
            },
          ],
        ]}
        onClose={() => setNrOpen(false)}
      />
    </div>
  );
}
