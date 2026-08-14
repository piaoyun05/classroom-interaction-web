-- ============================================================
-- AI 赋能课堂互动 · Supabase 数据库 Schema
-- 用途：让教师创建的课程、学生的发帖/留言/讨论在设备间共享同步
-- 使用方式：在 Supabase 控制台 → SQL Editor 中粘贴执行本文件
-- 安全说明：本策略为演示用「宽松策略」，任何人可读写，便于课堂演示；
--          生产环境请改用带 teacher_token 的 RLS 限制写权限。
-- ============================================================

-- ---------- 课程基本信息 ----------
create table if not exists courses (
  id text primary key,
  name text not null,
  class_name text,
  semester text,
  intro text,
  teacher_name text,
  created_at bigint
);

-- ---------- 教师发布内容 ----------
create table if not exists publishes (
  id text primary key,
  course_id text references courses(id) on delete cascade,
  title text,
  category text,
  content text,
  summary text,
  author text,
  create_time bigint,
  is_top boolean default false,
  views int default 0,
  deadline bigint,
  attachments jsonb default '[]'::jsonb
);

-- ---------- 学生留言 ----------
create table if not exists messages (
  id text primary key,
  course_id text references courses(id) on delete cascade,
  student_name text,
  is_anonymous boolean default false,
  type text,
  content text,
  create_time bigint,
  replied boolean default false,
  reply text,
  reply_time bigint,
  status text default 'approved'
);

-- ---------- 讨论区帖子 ----------
create table if not exists discussions (
  id text primary key,
  course_id text references courses(id) on delete cascade,
  author text,
  avatar text,
  category text,
  title text,
  content text,
  create_time bigint,
  likes int default 0,
  liked boolean default false,
  comments jsonb default '[]'::jsonb,
  ai_answer text,
  ai_answer_time bigint,
  ai_pinned boolean default false,
  reviewed boolean default false
);

-- ---------- 课程配置 ----------
create table if not exists course_config (
  course_id text primary key references courses(id) on delete cascade,
  page_style text default 'default',
  message_review_enabled boolean default false,
  discussion_post_enabled boolean default true,
  ai_answer_enabled boolean default true
);

-- ---------- 行级安全策略（演示版：宽松开放） ----------
alter table courses enable row level security;
alter table publishes enable row level security;
alter table messages enable row level security;
alter table discussions enable row level security;
alter table course_config enable row level security;

drop policy if exists "courses_all" on courses;
create policy "courses_all" on courses for all using (true) with check (true);
drop policy if exists "publishes_all" on publishes;
create policy "publishes_all" on publishes for all using (true) with check (true);
drop policy if exists "messages_all" on messages;
create policy "messages_all" on messages for all using (true) with check (true);
drop policy if exists "discussions_all" on discussions;
create policy "discussions_all" on discussions for all using (true) with check (true);
drop policy if exists "course_config_all" on course_config;
create policy "course_config_all" on course_config for all using (true) with check (true);

-- ---------- 启用 Realtime（实时同步） ----------
alter publication supabase_realtime add table courses;
alter publication supabase_realtime add table publishes;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table discussions;
alter publication supabase_realtime add table course_config;
