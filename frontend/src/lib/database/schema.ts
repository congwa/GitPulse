/**
 * GitPulse SQLite Schema
 * 遵循设计文档 git-insight-design.md 的数据库定义
 * 遵循 SQLite skill: 参数化查询 + 外键 + WAL + 事务
 */

export const SCHEMA_VERSION = 2

/**
 * 所有 CREATE TABLE 语句
 * 严格对齐设计文档中的 11 张表 + 1 张 meta 表
 */
export const CREATE_TABLES = `
-- ============================================
-- 基础数据层
-- ============================================

-- 原始提交记录
CREATE TABLE IF NOT EXISTS raw_commits (
  hash          TEXT PRIMARY KEY,
  author_name   TEXT NOT NULL,
  author_email  TEXT NOT NULL,
  timestamp     INTEGER NOT NULL,
  message       TEXT,
  insertions    INTEGER DEFAULT 0,
  deletions     INTEGER DEFAULT 0,
  files_changed INTEGER DEFAULT 0,
  commit_type   TEXT,
  file_paths    TEXT   -- JSON 数组
);
CREATE INDEX IF NOT EXISTS idx_commits_author ON raw_commits(author_email);
CREATE INDEX IF NOT EXISTS idx_commits_time ON raw_commits(timestamp);
CREATE INDEX IF NOT EXISTS idx_commits_type ON raw_commits(commit_type);

-- ============================================
-- 聚合统计层（6 张表）
-- ============================================

-- 1. 按成员聚合
CREATE TABLE IF NOT EXISTS stats_by_author (
  author_email    TEXT PRIMARY KEY,
  author_name     TEXT,
  total_commits   INTEGER DEFAULT 0,
  total_insertions INTEGER DEFAULT 0,
  total_deletions INTEGER DEFAULT 0,
  files_touched   INTEGER DEFAULT 0,
  first_commit_at INTEGER,
  last_commit_at  INTEGER,
  active_days     INTEGER DEFAULT 0,
  avg_commit_size REAL DEFAULT 0
);

-- 2. 按时间聚合（日粒度）
CREATE TABLE IF NOT EXISTS stats_by_date (
  date            TEXT PRIMARY KEY,
  total_commits   INTEGER DEFAULT 0,
  total_insertions INTEGER DEFAULT 0,
  total_deletions INTEGER DEFAULT 0,
  active_authors  INTEGER DEFAULT 0,
  commit_types    TEXT   -- JSON: {"feat":5,"fix":3,...}
);

-- 3. 时间热力图（7×24）
CREATE TABLE IF NOT EXISTS stats_heatmap (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  author_email  TEXT,    -- NULL 表示全团队
  day_of_week   INTEGER NOT NULL,
  hour_of_day   INTEGER NOT NULL,
  commit_count  INTEGER DEFAULT 0,
  UNIQUE(author_email, day_of_week, hour_of_day)
);
CREATE INDEX IF NOT EXISTS idx_heatmap_author ON stats_heatmap(author_email);

-- 4. 模块归属
CREATE TABLE IF NOT EXISTS stats_module_ownership (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  directory     TEXT NOT NULL,
  author_email  TEXT NOT NULL,
  commits       INTEGER DEFAULT 0,
  insertions    INTEGER DEFAULT 0,
  deletions     INTEGER DEFAULT 0,
  last_commit_at INTEGER,
  UNIQUE(directory, author_email)
);
CREATE INDEX IF NOT EXISTS idx_module_dir ON stats_module_ownership(directory);

-- 5. 文件热度
CREATE TABLE IF NOT EXISTS stats_file_hotspots (
  file_path      TEXT PRIMARY KEY,
  total_changes  INTEGER DEFAULT 0,
  author_count   INTEGER DEFAULT 0,
  last_change_at INTEGER,
  primary_owner  TEXT
);

-- 6. 提交类型按月趋势
CREATE TABLE IF NOT EXISTS stats_type_trend (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  month        TEXT NOT NULL,
  commit_type  TEXT NOT NULL,
  count        INTEGER DEFAULT 0,
  UNIQUE(month, commit_type)
);

-- ============================================
-- 协作关系层
-- ============================================

-- 成员协作关系
CREATE TABLE IF NOT EXISTS collaboration_edges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  author_a      TEXT NOT NULL,
  author_b      TEXT NOT NULL,
  shared_files  INTEGER DEFAULT 0,
  strength      REAL DEFAULT 0,
  main_modules  TEXT,   -- JSON 数组
  UNIQUE(author_a, author_b)
);

-- 代码接力链
CREATE TABLE IF NOT EXISTS code_handoffs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  from_author  TEXT NOT NULL,
  to_author    TEXT NOT NULL,
  file_path    TEXT,
  handoff_count INTEGER DEFAULT 0,
  last_handoff  INTEGER
);

-- ============================================
-- AI 分析结果层
-- ============================================

-- AI 分析结果统一存储
CREATE TABLE IF NOT EXISTS ai_results (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  target       TEXT,
  result_json  TEXT NOT NULL,
  model        TEXT,
  token_used   INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_type ON ai_results(type, target);

-- ============================================
-- 元数据
-- ============================================

-- 分析元数据
CREATE TABLE IF NOT EXISTS analysis_meta (
  repo_path     TEXT PRIMARY KEY,
  repo_name     TEXT,
  last_analyzed INTEGER,
  total_commits INTEGER DEFAULT 0,
  total_authors INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'none',
  duration_ms   INTEGER DEFAULT 0,
  commit_range  TEXT,
  schema_version INTEGER DEFAULT ${SCHEMA_VERSION}
);

-- Schema 版本追踪
CREATE TABLE IF NOT EXISTS schema_migrations (
  version      INTEGER PRIMARY KEY,
  applied_at   INTEGER NOT NULL,
  description  TEXT
);

-- ============================================
-- 工贼检测层（v2）
-- ============================================

-- 无用功事件表 (DeepAgent 分析产出)
CREATE TABLE IF NOT EXISTS waste_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_id     TEXT NOT NULL,
  severity       TEXT NOT NULL,
  author_email   TEXT NOT NULL,
  related_authors TEXT,
  file_paths     TEXT,
  commit_hashes  TEXT,
  lines_wasted   INTEGER DEFAULT 0,
  was_passive    INTEGER DEFAULT 0,
  description    TEXT,
  evidence       TEXT,
  root_cause     TEXT,
  recommendation TEXT,
  detected_at    INTEGER NOT NULL,
  analysis_id    TEXT
);
CREATE INDEX IF NOT EXISTS idx_waste_author ON waste_events(author_email);
CREATE INDEX IF NOT EXISTS idx_waste_pattern ON waste_events(pattern_id);

-- 成员浪费评分表
CREATE TABLE IF NOT EXISTS waste_scores (
  author_email       TEXT PRIMARY KEY,
  author_name        TEXT,
  total_lines_added  INTEGER DEFAULT 0,
  total_lines_wasted INTEGER DEFAULT 0,
  waste_rate         REAL DEFAULT 0,
  net_effective_lines INTEGER DEFAULT 0,
  waste_score        REAL DEFAULT 0,
  pattern_counts     TEXT,
  top_pattern        TEXT,
  passive_waste_lines INTEGER DEFAULT 0,
  last_updated       INTEGER
);

-- 深度分析任务记录
CREATE TABLE IF NOT EXISTS waste_analysis_runs (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  completed_at    INTEGER,
  files_analyzed  INTEGER DEFAULT 0,
  events_found    INTEGER DEFAULT 0,
  agent_model     TEXT,
  total_tokens    INTEGER DEFAULT 0,
  report_json     TEXT
);
`

/**
 * SQLite 性能优化 PRAGMAs
 * 遵循 SQLite skill: WAL 模式 + 外键约束
 */
export const PRAGMA_SETTINGS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000000;
PRAGMA foreign_keys = ON;
PRAGMA page_size = 4096;
`
