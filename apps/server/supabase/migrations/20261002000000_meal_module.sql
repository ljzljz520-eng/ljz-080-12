-- =============================================================
-- 社区养老协作平台 · 助餐模块
-- Supabase (Postgres) 数据库迁移
-- 说明：演示环境默认使用服务内存存储（MealStore），表结构与此文件一致；
--       接入真实 Supabase 时执行本迁移并以同名仓储替换即可。
-- =============================================================

-- 老人档案：饮食照护标签（忌口 / 糖尿病餐 / 咀嚼困难）
create table if not exists elders (
  id                    text primary key,
  station_id            text not null,
  name                  text not null,
  age                   int  not null,
  gender                char(1) not null check (gender in ('M','F')),
  room                  text not null,
  address               text not null,
  dietary_restrictions  text[] not null default '{}',  -- 忌口
  diabetic              boolean not null default false, -- 糖尿病餐
  chewing_difficulty    boolean not null default false, -- 咀嚼困难
  note                  text
);

-- 家属账号（家属端数据隔离：仅能查看 elder_ids 关联的老人）
create table if not exists family_members (
  id         text primary key,
  name       text not null,
  relation   text not null,
  phone      text not null,
  elder_ids  text[] not null default '{}'
);

-- 员工：站长 / 管家 / 配送员
create table if not exists staff (
  id    text primary key,
  name  text not null,
  role  text not null check (role in ('STATION_ADMIN','HOUSEKEEPER','COURIER')),
  phone text not null
);

-- 午餐订单（排餐）
create table if not exists meal_orders (
  id            text primary key,
  elder_id      text not null references elders(id),
  date          date not null,
  meal_type     text not null check (meal_type in ('REGULAR','DIABETIC','SOFT')),
  status        text not null default 'SCHEDULED' check (status in
                ('SCHEDULED','OUT_FOR_DELIVERY','DELIVERED','NO_RESPONSE',
                 'CANCELLED','REJECTED')),
  swapped_from  text check (swapped_from in ('REGULAR','DIABETIC','SOFT')),
  swap_reason   text,
  reject_reason text,
  leftover      boolean not null default false, -- 是否计入剩餐
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (elder_id, date)
);
create index if not exists idx_meal_orders_date on meal_orders(date);

-- 家属临时停餐
create table if not exists meal_suspensions (
  id         text primary key,
  elder_id   text not null references elders(id),
  date       date not null,
  reason     text not null,
  family_id  text not null references family_members(id),
  created_at timestamptz not null default now(),
  unique (elder_id, date)
);

-- 配送任务（含扫码签收令牌）
create table if not exists deliveries (
  id           text primary key,
  order_id     text not null references meal_orders(id),
  elder_id     text not null references elders(id),
  courier_id   text not null references staff(id),
  qr_token     text not null unique,
  status       text not null default 'PENDING' check (status in
               ('PENDING','SIGNED','NO_RESPONSE','CLOSED')),
  signed_at    timestamptz,
  sign_channel text check (sign_channel in ('QR_SCAN','HOUSEKEEPER_CONFIRM')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_deliveries_order on deliveries(order_id);

-- 配送异常工单（老人未应答 → 管家二次确认）
create table if not exists delivery_exceptions (
  id           text primary key,
  delivery_id  text not null references deliveries(id),
  order_id     text not null references meal_orders(id),
  elder_id     text not null references elders(id),
  reason       text not null default 'NO_RESPONSE',
  note         text,
  status       text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  assignee_id  text not null references staff(id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- 管家二次确认记录
create table if not exists exception_confirmations (
  id            bigint generated always as identity primary key,
  exception_id  text not null references delivery_exceptions(id),
  at            timestamptz not null default now(),
  by_staff_id   text not null references staff(id),
  method        text not null check (method in ('PHONE','VISIT','FAMILY_CONTACT')),
  result        text not null check (result in
                ('DELIVERED_CONFIRMED','REDELIVER','CANCELLED')),
  note          text
);

-- 家属端行级安全：家属只能读到自家老人的餐食记录
alter table meal_orders enable row level security;
create policy family_read_own_orders on meal_orders
  for select using (
    elder_id = any (
      select unnest(elder_ids) from family_members
      where id = current_setting('app.family_id', true)
    )
  );
