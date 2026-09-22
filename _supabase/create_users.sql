-- ============================================================
-- Polaris 小站 · 用户账号系统建表脚本
-- 用法：Supabase 控制台 → SQL Editor → New query → 粘贴 → Run
-- 作用：创建「用户表 users」和「留言点赞记录表 message_likes」
-- 安全：开启 RLS 并不建策略，匿名公钥(anon)无法直接读写，
--       只有 Edge Function（service_role 密钥）能访问，安全。
-- 可重复执行（IF NOT EXISTS），不会影响现有数据。
-- ============================================================

-- 1. 用户表：QQ 邮箱作为唯一账号
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,           -- QQ 邮箱（小写），全站唯一
  password_hash text not null,                  -- PBKDF2 加盐哈希，不存明文
  salt          text not null,                  -- 每个用户独立盐值
  nickname      text not null,                  -- 昵称（可重复、可修改）
  created_at    timestamptz not null default now()
);

-- 2. 留言点赞记录表：一个用户对一条留言只能赞一次（复合主键去重）
create table if not exists public.message_likes (
  user_id     text not null,                    -- 点赞用户 id（开发者为 'developer'）
  message_id  text not null,                    -- 留言 id
  created_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);

-- 3. 开启行级安全并保持“无策略”，阻止公钥直连访问（Edge Function 不受限）
alter table public.users enable row level security;
alter table public.message_likes enable row level security;

-- 完成。成功后会看到 “Success. No rows returned”。
