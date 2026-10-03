import {
  Button,
  DatePicker,
  Empty,
  Form,
  NavBar,
  Selector,
  Tabs,
  Tag,
  TextArea,
  Toast,
} from 'antd-mobile';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtDate } from '../../shared/api';
import type { FamilyMealRecord, FamilyMealRecords } from '../../shared/types';
import { MEAL_TYPE_LABELS, ORDER_STATUS_LABELS } from '../../shared/types';
import { getRole } from '../role';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: '#1677ff',
  OUT_FOR_DELIVERY: '#ff8f1f',
  DELIVERED: '#00b578',
  NO_RESPONSE: '#ff3141',
  CANCELLED: '#999999',
  REJECTED: '#ff3141',
};

function RecordCard({ record }: { record: FamilyMealRecord }) {
  return (
    <div className="meal-card">
      <div className="meal-card-head">
        <span className="meal-card-elder">{record.elderName}</span>
        <Tag color={STATUS_COLORS[record.status]} fill="solid" round>
          {ORDER_STATUS_LABELS[record.status]}
        </Tag>
      </div>
      <div className="meal-card-body">
        <span className="meal-type">{MEAL_TYPE_LABELS[record.mealType]}</span>
        {record.swappedFrom && (
          <span className="meal-swap">
            由「{MEAL_TYPE_LABELS[record.swappedFrom]}」换餐
            {record.swapReason ? `：${record.swapReason}` : ''}
          </span>
        )}
        {record.suspensionReason && (
          <div className="meal-suspension">停餐说明:{record.suspensionReason}</div>
        )}
        {record.rejectReason && (
          <div className="meal-reject">拒收原因：{record.rejectReason}</div>
        )}
        {record.signedAt && (
          <div className="meal-signed">
            签收时间 {new Date(record.signedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FamilyPage() {
  const navigate = useNavigate();
  const role = getRole();
  const [data, setData] = useState<FamilyMealRecords | null>(null);
  const [tab, setTab] = useState('records');

  // 停餐表单
  const [elderId, setElderId] = useState<string>('');
  const [dateVisible, setDateVisible] = useState(false);
  const [suspendDate, setSuspendDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!role || role.kind !== 'family') return;
    setData(await api.familyMealRecords(role.id));
  }, [role]);

  useEffect(() => {
    if (!role || role.kind !== 'family') {
      navigate('/', { replace: true });
      return;
    }
    void load();
  }, [role, navigate, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, FamilyMealRecord[]>();
    for (const r of data?.records ?? []) {
      const list = map.get(r.date) ?? [];
      list.push(r);
      map.set(r.date, list);
    }
    return [...map.entries()];
  }, [data]);

  const submitSuspension = async () => {
    if (!role) return;
    if (!elderId) {
      Toast.show({ content: '请选择老人' });
      return;
    }
    if (!suspendDate) {
      Toast.show({ content: '请选择停餐日期' });
      return;
    }
    if (!reason.trim()) {
      Toast.show({ content: '请填写停餐说明' });
      return;
    }
    setSubmitting(true);
    try {
      await api.createSuspension(role.id, elderId, fmtDate(suspendDate), reason.trim());
      Toast.show({ icon: 'success', content: '停餐申请已提交，站点已收到' });
      setElderId('');
      setSuspendDate(null);
      setReason('');
      setTab('records');
      await load();
    } catch (e) {
      Toast.show({ icon: 'fail', content: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <NavBar onBack={() => navigate('/')}>我家老人的餐</NavBar>
      <div className="family-banner">
        <div>
          <div className="family-name">{data?.family.name ?? role?.name}</div>
          <div className="family-elders">
            关联老人：{data?.elders.map((e) => e.name).join('、') ?? '…'}
          </div>
        </div>
        <Tag color="warning" fill="outline">
          仅显示自家老人
        </Tag>
      </div>

      <Tabs activeKey={tab} onChange={setTab}>
        <Tabs.Tab title="餐食记录" key="records">
          <div className="tab-body">
            {grouped.length === 0 && <Empty description="暂无餐食记录" />}
            {grouped.map(([date, records]) => (
              <div key={date}>
                <div className="date-divider">{date}</div>
                {records.map((r) => (
                  <RecordCard key={r.id} record={r} />
                ))}
              </div>
            ))}
          </div>
        </Tabs.Tab>
        <Tabs.Tab title="临时停餐" key="suspend">
          <div className="tab-body">
            <div className="suspend-tip">
              老人临时不在家吃饭时，可提前申请停餐，站点排餐时会看到说明。
              当天临时停餐的已备餐食将计入剩餐。
            </div>
            <Form layout="horizontal">
              <Form.Item label="选择老人">
                <Selector
                  options={(data?.elders ?? []).map((e) => ({
                    label: e.name,
                    value: e.id,
                  }))}
                  value={elderId ? [elderId] : []}
                  onChange={(v) => setElderId(v[0] ?? '')}
                />
              </Form.Item>
              <Form.Item
                label="停餐日期"
                onClick={() => setDateVisible(true)}
                extra={suspendDate ? fmtDate(suspendDate) : '请选择'}
              />
              <Form.Item label="停餐说明">
                <TextArea
                  placeholder="如：今天接老人外出复查，午餐不在家吃"
                  value={reason}
                  onChange={setReason}
                  rows={3}
                  maxLength={100}
                  showCount
                />
              </Form.Item>
            </Form>
            <Button
              block
              color="primary"
              size="large"
              loading={submitting}
              className="submit-btn"
              onClick={() => void submitSuspension()}
            >
              提交停餐申请
            </Button>
          </div>
        </Tabs.Tab>
      </Tabs>

      <DatePicker
        visible={dateVisible}
        min={new Date()}
        onClose={() => setDateVisible(false)}
        onConfirm={(val) => {
          setSuspendDate(val);
          setDateVisible(false);
        }}
      />
    </div>
  );
}
