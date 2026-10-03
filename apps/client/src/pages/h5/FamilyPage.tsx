import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  DatePicker,
  Empty,
  Input,
  List,
  Popup,
  SpinLoading,
  Tag,
  Toast,
} from 'antd-mobile';
import dayjs from 'dayjs';
import {
  api,
  fmtTime,
  ORDER_STATUS,
  todayStr,
  type FamilyProfile,
  type Identity,
  type MealRecord,
} from '../../api';

type FamilyIdentity = Extract<Identity, { kind: 'family' }>;

/** 家属端：只看自己老人的餐食记录 + 临时停餐申请 */
export default function FamilyPage({
  identity,
  onSwitch,
}: {
  identity: FamilyIdentity;
  onSwitch: () => void;
}) {
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 停餐申请表单
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState('');
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([
        api<FamilyProfile>('/family/profile'),
        api<MealRecord[]>('/family/meal-records'),
      ]);
      setProfile(p);
      setRecords(r);
    } catch (e) {
      Toast.show({ content: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openSuspend = () => {
    setStartDate(todayStr());
    setEndDate(todayStr());
    setReason('');
    setSuspendOpen(true);
  };

  const submitSuspension = async () => {
    if (!reason.trim()) {
      Toast.show({ content: '请填写停餐原因' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ autoCancelledOrders: number }>(
        '/family/suspensions',
        {
          method: 'POST',
          body: { startDate, endDate, reason: reason.trim() },
        },
      );
      Toast.show({
        icon: 'success',
        content: `停餐申请已提交${
          res.autoCancelledOrders
            ? `，已自动取消 ${res.autoCancelledOrders} 笔待送餐单`
            : ''
        }`,
      });
      setSuspendOpen(false);
      void load();
    } catch (e) {
      Toast.show({ icon: 'fail', content: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h5-page">
      <div className="h5-header">
        <div>
          <div className="h5-title">家属端</div>
          <div className="h5-sub">
            {identity.name}（{identity.relation}）
          </div>
        </div>
        <Button size="mini" fill="outline" onClick={onSwitch}>
          切换身份
        </Button>
      </div>

      {loading || !profile ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <SpinLoading />
        </div>
      ) : (
        <div className="h5-body">
          <div className="h5-card elder-card">
            <div className="h5-card-title">
              <span>
                {profile.elder.name}
                <span className="h5-room">{profile.elder.roomNo}</span>
              </span>
              <Tag color="primary">我家老人</Tag>
            </div>
            <div className="h5-tags" style={{ marginTop: 8 }}>
              {profile.elder.dietaryRestrictions.map((r) => (
                <Tag key={r} color="danger">
                  忌{r}
                </Tag>
              ))}
              {profile.elder.diabetic && <Tag color="warning">糖尿病餐</Tag>}
              {profile.elder.chewingDifficulty && (
                <Tag color="primary">咀嚼困难·软食</Tag>
              )}
            </div>
            <Button
              block
              color="warning"
              fill="outline"
              style={{ marginTop: 12 }}
              onClick={openSuspend}
            >
              申请临时停餐
            </Button>
          </div>

          {profile.suspensions.length > 0 && (
            <>
              <div className="h5-section-title">停餐记录</div>
              {profile.suspensions.map((s) => (
                <div className="h5-card" key={s.id}>
                  <div className="h5-card-sub">
                    {s.startDate} ~ {s.endDate}
                  </div>
                  <div>{s.reason}</div>
                </div>
              ))}
            </>
          )}

          <div className="h5-section-title">餐食记录（仅我家老人）</div>
          {records.length === 0 ? (
            <Empty description="暂无餐食记录" />
          ) : (
            <List>
              {records.map((r) => {
                const st = ORDER_STATUS[r.status];
                return (
                  <div className="h5-card" key={r.id}>
                    <div className="h5-card-title">
                      <span>{r.mealDate} 午餐</span>
                      <Tag color={st?.color}>{st?.text ?? r.status}</Tag>
                    </div>
                    <div className="h5-menu">{r.menuText}</div>
                    <div className="h5-tags">
                      {r.dietTags.map((t) => (
                        <Tag key={t} color="success">
                          {t}
                        </Tag>
                      ))}
                    </div>
                    <div className="h5-record-meta">
                      {r.signedAt && <div>签收时间 {fmtTime(r.signedAt)}</div>}
                      {r.swapNote && <div>换餐说明：{r.swapNote}</div>}
                      {r.rejectReason && <div>拒收原因：{r.rejectReason}</div>}
                      {r.leftoverNote && <div>剩餐说明：{r.leftoverNote}</div>}
                    </div>
                  </div>
                );
              })}
            </List>
          )}
        </div>
      )}

      {/* 临时停餐申请 */}
      <Popup
        visible={suspendOpen}
        onMaskClick={() => setSuspendOpen(false)}
        bodyStyle={{ borderRadius: '12px 12px 0 0', padding: 16 }}
      >
        <div className="suspend-popup">
          <div className="suspend-title">申请临时停餐</div>
          <div className="suspend-row" onClick={() => setPicker('start')}>
            <span>开始日期</span>
            <b>{startDate}</b>
          </div>
          <div className="suspend-row" onClick={() => setPicker('end')}>
            <span>结束日期</span>
            <b>{endDate}</b>
          </div>
          <Input
            placeholder="停餐原因（必填），如：外出就医暂停送餐"
            value={reason}
            onChange={setReason}
          />
          <Button
            block
            color="primary"
            style={{ marginTop: 16 }}
            loading={submitting}
            onClick={() => void submitSuspension()}
          >
            提交申请
          </Button>
        </div>
        <DatePicker
          visible={picker !== null}
          precision="day"
          min={new Date()}
          onClose={() => setPicker(null)}
          onConfirm={(v) => {
            const s = dayjs(v).format('YYYY-MM-DD');
            if (picker === 'start') setStartDate(s);
            else setEndDate(s);
          }}
        />
      </Popup>
    </div>
  );
}
