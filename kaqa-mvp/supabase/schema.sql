-- ═══════════════════════════════════════════════════
--  جائزة الملك عبدالعزيز للجودة — قاعدة البيانات
-- ═══════════════════════════════════════════════════

-- ─── جدول الملفات المرفوعة ──────────────────────────
create table if not exists uploaded_files (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references assessments(id) on delete cascade,
  name text not null,
  size integer,
  type text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ─── جدول التقييمات ─────────────────────────────────
create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  sector text default 'government',
  total_score integer,
  total_possible integer default 1000,
  percentage numeric(5,2),
  maturity_level text,
  maturity_level_en text,
  overall_confidence text,
  enablers_actual integer,
  results_actual integer,
  result jsonb,
  status text default 'draft' check (status in ('draft','completed','approved')),
  created_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── جدول المستخدمين (امتداد للـ auth) ───────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'assessor' check (role in ('admin','manager','assessor')),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ─── جدول سجل التدقيق ───────────────────────────────
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────
alter table assessments enable row level security;
alter table profiles enable row level security;
alter table audit_log enable row level security;
alter table uploaded_files enable row level security;

-- المستخدمون المسجلون يرون جميع التقييمات
create policy "authenticated users can view assessments"
  on assessments for select
  using (auth.role() = 'authenticated');

-- فقط صاحب التقييم أو الأدمن يعدل
create policy "creator or admin can modify assessments"
  on assessments for all
  using (
    auth.uid() = created_by
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- كل مستخدم يرى ملفه الشخصي
create policy "users view own profile"
  on profiles for select
  using (auth.uid() = id);

-- الأدمن يرى كل الملفات الشخصية
create policy "admin views all profiles"
  on profiles for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ─── Function: تحديث updated_at تلقائياً ─────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger assessments_updated_at
  before update on assessments
  for each row execute function update_updated_at();

-- ─── Function: إنشاء profile تلقائياً ───────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'assessor')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
