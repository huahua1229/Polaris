-- 最近动态表
create table if not exists moments (
  id uuid primary key default gen_random_uuid(),
  date text not null,
  content text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table moments enable row level security;

drop policy if exists "public read moments" on moments;
create policy "public read moments" on moments for select using (true);

-- 增删改只走 Edge Function（service_role），不开放 anon
