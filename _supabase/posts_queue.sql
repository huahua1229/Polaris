-- Polaris 小站 · 投稿队列表（desc 是 SQL 保留字，改用 summary）
create table if not exists posts_queue (
  id text primary key,
  name text not null,
  email text not null,
  type text not null,
  title text not null,
  summary text,
  content text,
  tags text,
  created_at timestamptz default now()
);
