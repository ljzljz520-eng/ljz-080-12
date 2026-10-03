-- =============================================================
-- 社区养老协作平台 · 助餐模块 数据库结构（Supabase / Postgres）
-- 说明：本文件同时用于 docker-compose 中的 supabase/postgres
-- 与本地 pg-mem 内存库，保持同一套 DDL。
-- =============================================================

-- 养老站点
CREATE TABLE IF NOT EXISTS stations (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 员工账号（站点管理员 / 配送员 / 管家）
CREATE TABLE IF NOT EXISTS staff_users (
  id          BIGSERIAL PRIMARY KEY,
  station_id  BIGINT NOT NULL REFERENCES stations(id),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('station_admin', 'courier', 'housekeeper')),
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 老人档案：忌口 / 糖尿病餐 / 咀嚼困难 等助餐关键信息
CREATE TABLE IF NOT EXISTS elders (
  id                   BIGSERIAL PRIMARY KEY,
  station_id           BIGINT NOT NULL REFERENCES stations(id),
  name                 TEXT NOT NULL,
  room_no              TEXT,
  age                  INT,
  dietary_restrictions JSONB NOT NULL DEFAULT '[]',  -- 忌口，如 ["海鲜","辛辣"]
  diabetic             BOOLEAN NOT NULL DEFAULT FALSE, -- 是否糖尿病餐
  chewing_difficulty   BOOLEAN NOT NULL DEFAULT FALSE, -- 是否咀嚼困难（需软食/糊状）
  notes                TEXT,
  qr_code              TEXT NOT NULL UNIQUE,           -- 门口签收二维码内容
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 家属账号，与老人关联（家属端数据隔离的依据）
CREATE TABLE IF NOT EXISTS family_members (
  id          BIGSERIAL PRIMARY KEY,
  elder_id    BIGINT NOT NULL REFERENCES elders(id),
  name        TEXT NOT NULL,
  relation    TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 家属临时停餐说明
CREATE TABLE IF NOT EXISTS meal_suspensions (
  id          BIGSERIAL PRIMARY KEY,
  elder_id    BIGINT NOT NULL REFERENCES elders(id),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT NOT NULL,
  created_by  BIGINT NOT NULL REFERENCES family_members(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 排餐单（目前仅午餐 lunch）
CREATE TABLE IF NOT EXISTS meal_orders (
  id            BIGSERIAL PRIMARY KEY,
  elder_id      BIGINT NOT NULL REFERENCES elders(id),
  station_id    BIGINT NOT NULL REFERENCES stations(id),
  meal_date     DATE NOT NULL,
  meal_type     TEXT NOT NULL DEFAULT 'lunch' CHECK (meal_type IN ('lunch')),
  menu_text     TEXT NOT NULL,
  diet_tags     JSONB NOT NULL DEFAULT '[]',  -- 实际执行的膳食标签，如 ["糖尿病餐","软食"]
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','delivering','signed','leftover','rejected','cancelled')),
  swapped_at    TIMESTAMPTZ, -- 换餐时间（换餐为事件，不打断配送状态机）
  swap_note     TEXT,        -- 换餐说明
  reject_reason TEXT,        -- 拒收原因
  leftover_note TEXT,        -- 剩餐说明
  created_by    BIGINT REFERENCES staff_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (elder_id, meal_date, meal_type)
);

-- 配送单
CREATE TABLE IF NOT EXISTS deliveries (
  id             BIGSERIAL PRIMARY KEY,
  meal_order_id  BIGINT NOT NULL REFERENCES meal_orders(id),
  courier_id     BIGINT NOT NULL REFERENCES staff_users(id),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','out_for_delivery','signed','exception')),
  sign_method    TEXT,  -- 签收方式：qr_code
  signed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 配送异常（老人无应答等）→ 管家二次确认
CREATE TABLE IF NOT EXISTS delivery_exceptions (
  id                    BIGSERIAL PRIMARY KEY,
  delivery_id           BIGINT NOT NULL REFERENCES deliveries(id),
  type                  TEXT NOT NULL DEFAULT 'no_response' CHECK (type IN ('no_response')),
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirming','resolved')),
  housekeeper_id        BIGINT REFERENCES staff_users(id),   -- 负责二次确认的管家
  courier_note          TEXT,                                -- 配送员上报说明
  second_confirm_result TEXT,  -- reschedule 补送 / recycle 回收记剩餐 / cancel 取消订餐
  second_confirm_note   TEXT,
  confirmed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 站内通知（异常产生时推给管家）
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES staff_users(id),
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_orders_station_date ON meal_orders (station_id, meal_date);
CREATE INDEX IF NOT EXISTS idx_meal_orders_elder_date   ON meal_orders (elder_id, meal_date);
CREATE INDEX IF NOT EXISTS idx_suspensions_elder        ON meal_suspensions (elder_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_courier       ON deliveries (courier_id, status);
CREATE INDEX IF NOT EXISTS idx_exceptions_status        ON delivery_exceptions (status);
CREATE INDEX IF NOT EXISTS idx_notifications_user       ON notifications (user_id, read);
