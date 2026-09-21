-- Polaris 小站 · 投稿队列表
-- 在 Supabase SQL Editor 里执行一次即可
create table if not exists posts_queue (
  id text primary key,
  name text not null,
  email text not null,
  type text not null,            -- 'project' 或 'blog'
  title text not null,
  desc text,
  content text,
  tags text,
  created_at timestamptz default now()
);
