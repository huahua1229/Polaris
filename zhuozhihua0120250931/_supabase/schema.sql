-- ============================================================
-- Polaris 小站 · Supabase 建表与权限脚本
-- 在 Supabase 控制台 → SQL Editor 中整段粘贴执行
-- ============================================================

-- 1) 站点内容（作者维护，所有人可读）
create table if not exists site_content (
    id         int primary key default 1 check (id = 1),
    data       jsonb not null,
    updated_at timestamptz not null default now()
);

-- 2) 留言板（所有人可读、可写新留言；删除/管理走服务端函数）
create table if not exists guestbook_messages (
    id         text primary key,          -- 前端生成的唯一 id
    name       text not null default '',
    message    text not null,
    time       bigint not null,           -- Date.now()
    likes      int not null default 0,
    replies    jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);

-- 3) 作者口令（仅服务端可读写，前端永远拿不到）
create table if not exists admin_auth (
    id            int primary key default 1 check (id = 1),
    password_hash text not null,
    salt          text not null,
    updated_at    timestamptz not null default now()
);

-- 初始口令：zhuozhihua@123（PBKDF2-SHA256 ×60000，登录后可在管理面板修改）
insert into admin_auth (id, password_hash, salt)
values (1, '3ef6aca57ab493fb03d4e1df4aac2ffdfe790306f65ebecf9a94efe35462fe6c', 'polaris_salt_v1')
on conflict (id) do nothing;

-- ============================================================
-- 行级安全（RLS）：默认全部拒绝，仅放开公开读取与访客发留言
-- 更新/删除/口令校验全部走 Edge Function（service role，绕过 RLS）
-- ============================================================
alter table site_content      enable row level security;
alter table guestbook_messages enable row level security;
alter table admin_auth        enable row level security;

-- 所有人可读站点内容
drop policy if exists "public read content" on site_content;
create policy "public read content" on site_content
    for select using (true);

-- 所有人可读留言
drop policy if exists "public read messages" on guestbook_messages;
create policy "public read messages" on guestbook_messages
    for select using (true);

-- 访客可发布新留言
drop policy if exists "public insert messages" on guestbook_messages;
create policy "public insert messages" on guestbook_messages
    for insert with check (true);

-- admin_auth 无任何公开策略：匿名/anon 一律拒绝
-- site_content 无公开 update/delete：匿名一律拒绝
-- guestbook_messages 无公开 update/delete：匿名一律拒绝
