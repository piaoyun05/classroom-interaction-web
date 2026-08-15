-- ============================================================
-- Supabase 表结构与安全策略（课堂演示用）
-- 在 Supabase 控制台 -> SQL Editor 中粘贴并执行本文件。
-- 安全说明：本策略为「所有用户可读可写」的宽松模式，仅适合
-- 课堂教学演示。生产使用请按 auth.uid() 等收紧 RLS。
-- ============================================================

-- 课程表
create table if not exists courses (
  id text primary key,
  name text,
  class_name text,
  semester text,
  intro text,
  teacher_name text,
  created_at bigint
);

-- 教师发布表
create table if not exists publishes (
  id text primary key,
  course_id text,
  title text,
  category text,
  content text,
  summary text,
  author text,
  create_time bigint,
  is_top boolean,
  views int,
  deadline bigint,
  attachments jsonb
);

-- 留言表
create table if not exists messages (
  id text primary key,
  course_id text,
  student_name text,
  is_anonymous boolean,
  type text,
  content text,
  create_time bigint,
  replied boolean,
  reply text,
  reply_time bigint,
  status text,
  images jsonb
);

-- 讨论帖表
create table if not exists discussions (
  id text primary key,
  course_id text,
  author text,
  avatar text,
  category text,
  title text,
  content text,
  create_time bigint,
  likes int,
  liked boolean,
  comments jsonb,
  ai_answer text,
  ai_answer_time bigint,
  ai_pinned boolean,
  reviewed boolean,
  images jsonb
);

-- 课程配置表
create table if not exists course_config (
  course_id text primary key,
  page_style text,
  message_review_enabled boolean,
  discussion_post_enabled boolean,
  ai_answer_enabled boolean
);

-- 全局应用配置表（单行：id='global'）
-- 用于存共享的 DeepSeek API key，学生端可读取后直接使用真实 AI
create table if not exists app_config (
  id text primary key,
  ai_key text
);

-- 开启实时推送（Realtime），供网页端实时同步
alter publication supabase_realtime add table courses;
alter publication supabase_realtime add table publishes;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table discussions;
alter publication supabase_realtime add table course_config;
alter publication supabase_realtime add table app_config;

-- ============================================================
-- 宽松 RLS：所有用户可读可写（课堂演示用）
-- ============================================================
alter table courses enable row level security;
alter table publishes enable row level security;
alter table messages enable row level security;
alter table discussions enable row level security;
alter table course_config enable row level security;
alter table app_config enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['courses','publishes','messages','discussions','course_config','app_config']
  loop
    execute format('create policy "public_select_%s" on %I for select using (true);', t, t);
    execute format('create policy "public_insert_%s" on %I for insert with check (true);', t, t);
    execute format('create policy "public_update_%s" on %I for update using (true) with check (true);', t, t);
    execute format('create policy "public_delete_%s" on %I for delete using (true);', t, t);
  end loop;
end $$;
