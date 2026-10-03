import { RightOutline } from 'antd-mobile-icons';
import { DotLoading, List, Tag } from 'antd-mobile';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/api';
import type { FamilyMember, Staff } from '../../shared/types';
import { setRole } from '../role';

export default function RolePage() {
  const navigate = useNavigate();
  const [families, setFamilies] = useState<FamilyMember[]>([]);
  const [couriers, setCouriers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.families(), api.staff('COURIER')])
      .then(([f, c]) => {
        setFamilies(f);
        setCouriers(c);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-wrap">
        <DotLoading color="primary" />
      </div>
    );
  }

  return (
    <div className="role-page">
      <div className="role-hero">
        <div className="role-hero-logo">膳</div>
        <div className="role-hero-title">社区助餐服务</div>
        <div className="role-hero-sub">阳光社区养老服务站 · 请选择您的身份</div>
      </div>

      <List header="家属入口（查看自家老人餐食）">
        {families.map((f) => (
          <List.Item
            key={f.id}
            arrowIcon={<RightOutline />}
            description={`关联老人：${f.elders?.map((e) => e.name).join('、') ?? ''}`}
            onClick={() => {
              setRole({ kind: 'family', id: f.id, name: f.name });
              navigate('/family');
            }}
          >
            {f.name}
            <Tag color="primary" className="role-tag">
              {f.relation}
            </Tag>
          </List.Item>
        ))}
      </List>

      <List header="配送员入口（扫码签收）">
        {couriers.map((c) => (
          <List.Item
            key={c.id}
            arrowIcon={<RightOutline />}
            description={c.phone}
            onClick={() => {
              setRole({ kind: 'courier', id: c.id, name: c.name });
              navigate('/courier');
            }}
          >
            {c.name}
          </List.Item>
        ))}
      </List>
    </div>
  );
}
