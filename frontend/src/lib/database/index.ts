/**
 * GitPulse SQLite Database Service
 *
 * 使用 sql.js (SQLite WASM) 实现浏览器端 SQLite
 * 数据持久化到 IndexedDB
 *
 * 遵循 SQLite skill:
 * - 参数化查询防止 SQL 注入
 * - 事务管理确保数据完整性
 * - WAL 模式 + 性能优化
 */

import type { Database as SqlJsDatabase } from 'sql.js'
import { CREATE_TABLES, PRAGMA_SETTINGS, SCHEMA_VERSION } from './schema'

const DB_NAME = 'gitpulse_db'
const IDB_STORE = 'gitpulse_sqlite'

// ============================================
// IndexedDB 持久化层
// ============================================

async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_STORE, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('databases')) {
        db.createObjectStore('databases')
      }
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('databases', 'readwrite')
      tx.objectStore('databases').put(data, DB_NAME)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  })
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_STORE, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('databases')) {
        db.createObjectStore('databases')
      }
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('databases', 'readonly')
      const getReq = tx.objectStore('databases').get(DB_NAME)
      getReq.onsuccess = () => resolve(getReq.result ?? null)
      getReq.onerror = () => reject(getReq.error)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function clearIndexedDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_STORE, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('databases')) {
        db.createObjectStore('databases')
      }
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('databases', 'readwrite')
      tx.objectStore('databases').delete(DB_NAME)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// Database 类
// ============================================

export class GitPulseDB {
  private db: SqlJsDatabase | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false

  /**
   * 初始化数据库
   * - 尝试从 IndexedDB 加载已有数据
   * - 如果没有则创建新数据库
   * - 执行 schema 迁移
   */
  async init(): Promise<void> {
    // sql.js 是 CJS 模块，不同环境下导入后的结构不同：
    // - Vite 预打包 (Chrome): { default: initSqlJs }
    // - 未预打包 (WebKit): { default: Module } 其中 Module 又包含 .default
    // - 直接 CJS: initSqlJs 函数本身
    // 策略：遍历所有可能位置找到 init 函数
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sqlJsModule: any = await import('sql.js')

    // 查找真正的 initSqlJs 函数
    const findInitFn = (mod: any): ((...args: any[]) => any) | null => {
      if (!mod) return null
      if (typeof mod === 'function') return mod
      if (typeof mod.default === 'function') return mod.default
      if (typeof mod.default?.default === 'function') return mod.default.default
      // 遍历模块所有导出属性
      for (const key of Object.keys(mod)) {
        if (typeof mod[key] === 'function' && key !== '__esModule') return mod[key]
      }
      // 深入一层 default
      if (mod.default && typeof mod.default === 'object') {
        for (const key of Object.keys(mod.default)) {
          if (typeof mod.default[key] === 'function' && key !== '__esModule') return mod.default[key]
        }
      }
      return null
    }

    const initFn = findInitFn(sqlJsModule)
    if (!initFn) {
      // 打印详细信息帮助调试
      console.error('[GitPulseDB] Module structure:', {
        type: typeof sqlJsModule,
        keys: Object.keys(sqlJsModule),
        defaultType: typeof sqlJsModule?.default,
        defaultKeys: sqlJsModule?.default ? Object.keys(sqlJsModule.default) : [],
      })
      throw new Error('[GitPulseDB] Cannot find sql.js init function')
    }

    // 从 public/ 目录加载 WASM 二进制（该文件已拷贝到 public/sql-wasm.wasm）
    const wasmResp = await fetch('/sql-wasm.wasm')
    if (!wasmResp.ok) {
      throw new Error(`[GitPulseDB] Failed to fetch WASM: ${wasmResp.status} ${wasmResp.statusText}`)
    }
    const wasmBinary = await wasmResp.arrayBuffer()
    const SQL = await initFn({ wasmBinary })

    const existing = await loadFromIndexedDB()
    if (existing) {
      this.db = new SQL.Database(existing)
      console.log('[GitPulseDB] Loaded from IndexedDB')
    } else {
      this.db = new SQL.Database()
      console.log('[GitPulseDB] Created new database')
    }

    // 应用 PRAGMAs（WAL 在 WASM 环境下不生效，但保持兼容性）
    try {
      this.db!.run(PRAGMA_SETTINGS)
    } catch {
      // WAL 在某些 WASM 环境可能不支持，降级
      this.db!.run('PRAGMA foreign_keys = ON;')
    }

    // 创建/迁移 schema
    this.runMigration()

    // 自动保存
    await this.persist()
  }

  /**
   * Schema 迁移
   */
  private runMigration(): void {
    if (!this.db) throw new Error('Database not initialized')

    let currentVersion = 0

    // 检查当前版本
    try {
      const result = this.db.exec(
        "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1"
      )
      currentVersion = result.length > 0 ? result[0].values[0][0] as number : 0

      if (currentVersion >= SCHEMA_VERSION) {
        // 即使版本号到位，也要验证 v2 表是否真正存在
        // （之前可能记录了版本号但建表失败）
        const tableCheck = this.db.exec(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='waste_analysis_runs'"
        )
        if (tableCheck.length > 0 && tableCheck[0].values.length > 0) {
          console.log(`[GitPulseDB] Schema up to date (v${currentVersion})`)
          return
        }
        // 表不存在，需要补建
        console.warn(`[GitPulseDB] Schema v${currentVersion} but waste tables missing, re-running migration`)
      }
    } catch {
      // 表不存在，需要完整初始化
    }

    // 使用 exec() 执行多语句建表（run() 在某些 WASM 环境可能只执行第一条语句）
    this.db.exec(CREATE_TABLES)

    // v1 → v2 增量迁移：确保工贼检测表存在
    // （对于全新数据库，CREATE_TABLES 已包含这些表；
    //   对于已有 v1 数据库，CREATE TABLE IF NOT EXISTS 保证幂等）
    if (currentVersion < 2) {
      this.runMigrationV2()
    }

    // 记录迁移版本
    this.db.run(
      "INSERT OR REPLACE INTO schema_migrations (version, applied_at, description) VALUES (?, ?, ?)",
      [SCHEMA_VERSION, Date.now(), currentVersion === 0 ? 'Initial schema' : `Migrated from v${currentVersion}`]
    )

    this.dirty = true
    console.log(`[GitPulseDB] Migrated to schema v${SCHEMA_VERSION} (from v${currentVersion})`)
  }

  /**
   * v2 迁移：新增工贼检测表
   * 使用 CREATE TABLE IF NOT EXISTS 保证幂等
   */
  private runMigrationV2(): void {
    if (!this.db) return

    const V2_TABLES = `
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

    try {
      this.db.exec(V2_TABLES)
      console.log('[GitPulseDB] v2 migration: waste detection tables created')
    } catch (err) {
      console.error('[GitPulseDB] v2 migration failed:', err)
    }
  }

  /**
   * 持久化到 IndexedDB
   */
  async persist(): Promise<void> {
    if (!this.db) return
    const data = this.db.export()
    await saveToIndexedDB(data)
    this.dirty = false
    console.log('[GitPulseDB] Persisted to IndexedDB')
  }

  /**
   * 延迟持久化（防抖）
   */
  private schedulePersist(): void {
    this.dirty = true
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.persist(), 1000)
  }

  /**
   * 获取数据库大小（字节）
   */
  getSize(): number {
    if (!this.db) return 0
    return this.db.export().length
  }

  // ============================================
  // 通用查询方法（参数化查询，防 SQL 注入）
  // ============================================

  /**
   * 执行查询，返回对象数组
   */
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized')
    const result = this.db.exec(sql, params as (string | number | null | Uint8Array)[])
    if (result.length === 0) return []

    const { columns, values } = result[0]
    return values.map((row) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj as T
    })
  }

  /**
   * 执行单条查询
   */
  queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
    const rows = this.query<T>(sql, params)
    return rows[0] ?? null
  }

  /**
   * 执行写操作（INSERT/UPDATE/DELETE）
   */
  run(sql: string, params: unknown[] = []): void {
    if (!this.db) throw new Error('Database not initialized')
    this.db.run(sql, params as (string | number | null | Uint8Array)[])
    this.schedulePersist()
  }

  /**
   * 事务执行（SQLite skill: 事务保证原子性）
   */
  transaction(fn: () => void): void {
    if (!this.db) throw new Error('Database not initialized')
    this.db.run('BEGIN TRANSACTION')
    try {
      fn()
      this.db.run('COMMIT')
      this.schedulePersist()
    } catch (err) {
      this.db.run('ROLLBACK')
      throw err
    }
  }

  /**
   * 批量插入（SQLite skill: 批量操作 100x 性能提升）
   */
  batchInsert(sql: string, rows: unknown[][]): void {
    this.transaction(() => {
      for (const row of rows) {
        this.db!.run(sql, row as (string | number | null | Uint8Array)[])
      }
    })
  }

  // ============================================
  // 业务查询方法
  // ============================================

  // --- Analysis Meta ---

  getAnalysisMeta(repoPath: string) {
    return this.queryOne<{
      repo_path: string
      repo_name: string
      last_analyzed: number
      total_commits: number
      total_authors: number
      status: string
      duration_ms: number
      commit_range: string | null
    }>(
      "SELECT * FROM analysis_meta WHERE repo_path = ?",
      [repoPath]
    )
  }

  upsertAnalysisMeta(meta: {
    repoPath: string
    repoName: string
    lastAnalyzed: number
    totalCommits: number
    totalAuthors: number
    status: string
    durationMs: number
    commitRange?: string | null
  }): void {
    this.run(
      `INSERT OR REPLACE INTO analysis_meta
       (repo_path, repo_name, last_analyzed, total_commits, total_authors, status, duration_ms, commit_range, schema_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [meta.repoPath, meta.repoName, meta.lastAnalyzed, meta.totalCommits, meta.totalAuthors, meta.status, meta.durationMs, meta.commitRange ?? null, SCHEMA_VERSION]
    )
  }

  getAllRepoMetas() {
    return this.query<{
      repo_path: string
      repo_name: string
      last_analyzed: number
      total_commits: number
      total_authors: number
      status: string
    }>(
      "SELECT * FROM analysis_meta ORDER BY last_analyzed DESC"
    )
  }

  // --- Raw Commits ---

  insertCommits(commits: {
    hash: string
    authorName: string
    authorEmail: string
    timestamp: number
    message: string
    insertions: number
    deletions: number
    filesChanged: number
    commitType: string
    filePaths: string[]
  }[]): void {
    this.batchInsert(
      `INSERT OR IGNORE INTO raw_commits
       (hash, author_name, author_email, timestamp, message, insertions, deletions, files_changed, commit_type, file_paths)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      commits.map((c) => [
        c.hash, c.authorName, c.authorEmail, c.timestamp,
        c.message, c.insertions, c.deletions, c.filesChanged,
        c.commitType, JSON.stringify(c.filePaths),
      ])
    )
  }

  getCommitCount(): number {
    const r = this.queryOne<{ cnt: number }>("SELECT COUNT(*) as cnt FROM raw_commits")
    return r?.cnt ?? 0
  }

  /**
   * 获取提交记录的时间范围（基于 Git 提交时间戳）
   */
  getCommitTimeRange(): { minTs: number; maxTs: number } | null {
    const r = this.queryOne<{ min_ts: number; max_ts: number }>(
      "SELECT MIN(timestamp) as min_ts, MAX(timestamp) as max_ts FROM raw_commits"
    )
    if (!r || r.min_ts === null || r.max_ts === null) return null
    return { minTs: r.min_ts, maxTs: r.max_ts }
  }

  getRecentCommits(limit = 20) {
    return this.query<{
      hash: string
      author_name: string
      author_email: string
      timestamp: number
      message: string
      commit_type: string
    }>(
      "SELECT hash, author_name, author_email, timestamp, message, commit_type FROM raw_commits ORDER BY timestamp DESC LIMIT ?",
      [limit]
    )
  }

  // --- Stats by Author ---

  upsertAuthorStats(stats: {
    authorEmail: string
    authorName: string
    totalCommits: number
    totalInsertions: number
    totalDeletions: number
    filesTouched: number
    firstCommitAt: number
    lastCommitAt: number
    activeDays: number
    avgCommitSize: number
  }[]): void {
    this.batchInsert(
      `INSERT OR REPLACE INTO stats_by_author
       (author_email, author_name, total_commits, total_insertions, total_deletions, files_touched, first_commit_at, last_commit_at, active_days, avg_commit_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      stats.map((s) => [
        s.authorEmail, s.authorName, s.totalCommits, s.totalInsertions,
        s.totalDeletions, s.filesTouched, s.firstCommitAt, s.lastCommitAt,
        s.activeDays, s.avgCommitSize,
      ])
    )
  }

  getAuthorStats() {
    return this.query<{
      author_email: string
      author_name: string
      total_commits: number
      total_insertions: number
      total_deletions: number
      files_touched: number
      first_commit_at: number
      last_commit_at: number
      active_days: number
      avg_commit_size: number
    }>(
      "SELECT * FROM stats_by_author ORDER BY total_insertions DESC"
    )
  }

  /**
   * 按时间范围获取作者统计（从 raw_commits 实时聚合）
   * @param startTs - 开始时间戳（毫秒）
   * @param endTs - 结束时间戳（毫秒）
   */
  getAuthorStatsByDateRange(startTs: number, endTs: number) {
    return this.query<{
      author_email: string
      author_name: string
      total_commits: number
      total_insertions: number
      total_deletions: number
      files_touched: number
      first_commit_at: number
      last_commit_at: number
      active_days: number
      avg_commit_size: number
    }>(
      `SELECT
         author_email,
         author_name,
         COUNT(*) as total_commits,
         SUM(insertions) as total_insertions,
         SUM(deletions) as total_deletions,
         SUM(files_changed) as files_touched,
         MIN(timestamp) as first_commit_at,
         MAX(timestamp) as last_commit_at,
         COUNT(DISTINCT date(timestamp / 1000, 'unixepoch')) as active_days,
         CAST(AVG(insertions + deletions) AS INTEGER) as avg_commit_size
       FROM raw_commits
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY author_email
       ORDER BY total_insertions DESC`,
      [startTs, endTs]
    )
  }

  // --- Stats by Date ---

  upsertDateStats(stats: {
    date: string
    totalCommits: number
    totalInsertions: number
    totalDeletions: number
    activeAuthors: number
    commitTypes: Record<string, number>
  }[]): void {
    this.batchInsert(
      `INSERT OR REPLACE INTO stats_by_date
       (date, total_commits, total_insertions, total_deletions, active_authors, commit_types)
       VALUES (?, ?, ?, ?, ?, ?)`,
      stats.map((s) => [
        s.date, s.totalCommits, s.totalInsertions, s.totalDeletions,
        s.activeAuthors, JSON.stringify(s.commitTypes),
      ])
    )
  }

  getDateStats(limit?: number) {
    const sql = limit
      ? "SELECT * FROM stats_by_date ORDER BY date DESC LIMIT ?"
      : "SELECT * FROM stats_by_date ORDER BY date ASC"
    return this.query<{
      date: string
      total_commits: number
      total_insertions: number
      total_deletions: number
      active_authors: number
      commit_types: string
    }>(sql, limit ? [limit] : [])
  }

  getWeeklyCommits(weeks = 12) {
    // 按周聚合
    return this.query<{ week: string; commits: number }>(
      `SELECT
         strftime('%Y-W%W', date) as week,
         SUM(total_commits) as commits
       FROM stats_by_date
       GROUP BY week
       ORDER BY week DESC
       LIMIT ?`,
      [weeks]
    )
  }

  // --- Heatmap ---

  upsertHeatmap(data: {
    authorEmail: string | null
    dayOfWeek: number
    hourOfDay: number
    commitCount: number
  }[]): void {
    this.batchInsert(
      `INSERT OR REPLACE INTO stats_heatmap
       (author_email, day_of_week, hour_of_day, commit_count)
       VALUES (?, ?, ?, ?)`,
      data.map((d) => [d.authorEmail, d.dayOfWeek, d.hourOfDay, d.commitCount])
    )
  }

  getTeamHeatmap() {
    return this.query<{
      day_of_week: number
      hour_of_day: number
      commit_count: number
    }>(
      "SELECT day_of_week, hour_of_day, commit_count FROM stats_heatmap WHERE author_email IS NULL ORDER BY day_of_week, hour_of_day"
    )
  }

  getAuthorHeatmap(email: string) {
    return this.query<{
      day_of_week: number
      hour_of_day: number
      commit_count: number
    }>(
      "SELECT day_of_week, hour_of_day, commit_count FROM stats_heatmap WHERE author_email = ? ORDER BY day_of_week, hour_of_day",
      [email]
    )
  }

  // --- Module Ownership ---

  upsertModuleOwnership(data: {
    directory: string
    authorEmail: string
    commits: number
    insertions: number
    deletions: number
    lastCommitAt: number
  }[]): void {
    this.batchInsert(
      `INSERT OR REPLACE INTO stats_module_ownership
       (directory, author_email, commits, insertions, deletions, last_commit_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      data.map((d) => [d.directory, d.authorEmail, d.commits, d.insertions, d.deletions, d.lastCommitAt])
    )
  }

  getModuleOwnership() {
    return this.query<{
      directory: string
      total_commits: number
      total_files: number
      owner_email: string
      owner_name: string
      heat: number
    }>(
      `SELECT
         m.directory,
         SUM(m.commits) as total_commits,
         COUNT(DISTINCT m.author_email) as total_files,
         (SELECT m2.author_email FROM stats_module_ownership m2
          WHERE m2.directory = m.directory
          ORDER BY m2.commits DESC LIMIT 1) as owner_email,
         (SELECT a.author_name FROM stats_by_author a
          WHERE a.author_email = (
            SELECT m3.author_email FROM stats_module_ownership m3
            WHERE m3.directory = m.directory
            ORDER BY m3.commits DESC LIMIT 1
          )) as owner_name,
         CAST(SUM(m.commits) * 100.0 / MAX(1, (SELECT MAX(s) FROM (SELECT SUM(commits) as s FROM stats_module_ownership GROUP BY directory))) AS INTEGER) as heat
       FROM stats_module_ownership m
       GROUP BY m.directory
       ORDER BY total_commits DESC`
    )
  }

  // --- File Hotspots ---

  upsertFileHotspots(data: {
    filePath: string
    totalChanges: number
    authorCount: number
    lastChangeAt: number
    primaryOwner: string
  }[]): void {
    this.batchInsert(
      `INSERT OR REPLACE INTO stats_file_hotspots
       (file_path, total_changes, author_count, last_change_at, primary_owner)
       VALUES (?, ?, ?, ?, ?)`,
      data.map((d) => [d.filePath, d.totalChanges, d.authorCount, d.lastChangeAt, d.primaryOwner])
    )
  }

  // --- Commit Type Trend ---

  upsertTypeTrend(data: {
    month: string
    commitType: string
    count: number
  }[]): void {
    this.batchInsert(
      `INSERT OR REPLACE INTO stats_type_trend (month, commit_type, count) VALUES (?, ?, ?)`,
      data.map((d) => [d.month, d.commitType, d.count])
    )
  }

  getCommitTypeSummary() {
    return this.query<{ commit_type: string; total: number }>(
      `SELECT commit_type, SUM(count) as total FROM stats_type_trend GROUP BY commit_type ORDER BY total DESC`
    )
  }

  // --- Collaboration ---

  upsertCollabEdges(data: {
    authorA: string
    authorB: string
    sharedFiles: number
    strength: number
    mainModules: string[]
  }[]): void {
    this.batchInsert(
      `INSERT OR REPLACE INTO collaboration_edges
       (author_a, author_b, shared_files, strength, main_modules)
       VALUES (?, ?, ?, ?, ?)`,
      data.map((d) => [d.authorA, d.authorB, d.sharedFiles, d.strength, JSON.stringify(d.mainModules)])
    )
  }

  getCollabEdges() {
    return this.query<{
      author_a: string
      author_b: string
      shared_files: number
      strength: number
      main_modules: string
    }>(
      "SELECT * FROM collaboration_edges ORDER BY strength DESC"
    )
  }

  // --- AI Results ---

  saveAIResult(data: {
    id: string
    type: string
    target: string | null
    resultJson: string
    model: string
    tokenUsed: number
    createdAt: number
    expiresAt: number | null
  }): void {
    this.run(
      `INSERT OR REPLACE INTO ai_results
       (id, type, target, result_json, model, token_used, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.id, data.type, data.target, data.resultJson, data.model, data.tokenUsed, data.createdAt, data.expiresAt]
    )
  }

  getAIResult(type: string, target?: string | null) {
    if (target !== undefined && target !== null) {
      return this.queryOne<{
        id: string; type: string; target: string; result_json: string;
        model: string; created_at: number
      }>(
        "SELECT * FROM ai_results WHERE type = ? AND target = ? ORDER BY created_at DESC LIMIT 1",
        [type, target]
      )
    }
    return this.queryOne<{
      id: string; type: string; target: string | null; result_json: string;
      model: string; created_at: number
    }>(
      "SELECT * FROM ai_results WHERE type = ? AND target IS NULL ORDER BY created_at DESC LIMIT 1",
      [type]
    )
  }

  getAllAIResults(type?: string) {
    if (type) {
      return this.query<{
        id: string; type: string; target: string | null; result_json: string;
        model: string; created_at: number
      }>(
        "SELECT * FROM ai_results WHERE type = ? ORDER BY created_at DESC",
        [type]
      )
    }
    return this.query<{
      id: string; type: string; target: string | null; result_json: string;
      model: string; created_at: number
    }>(
      "SELECT * FROM ai_results ORDER BY created_at DESC"
    )
  }

  // --- Dashboard aggregate helpers ---

  getDashboardStats() {
    const totalCommits = this.queryOne<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM raw_commits"
    )?.cnt ?? 0

    const activeMembers = this.queryOne<{ cnt: number }>(
      "SELECT COUNT(DISTINCT author_email) as cnt FROM raw_commits"
    )?.cnt ?? 0

    const filesInvolved = this.queryOne<{ cnt: number }>(
      "SELECT COUNT(DISTINCT file_path) as cnt FROM stats_file_hotspots"
    )?.cnt ?? 0

    const codeLines = this.queryOne<{ total: number }>(
      "SELECT SUM(total_insertions) - SUM(total_deletions) as total FROM stats_by_author"
    )?.total ?? 0

    return { totalCommits, activeMembers, filesInvolved, codeLines }
  }

  // --- 删除单个仓库 ---

  async deleteRepo(repoPath: string): Promise<void> {
    if (!this.db) return
    this.transaction(() => {
      // 删除该仓库相关的所有数据
      this.db!.run("DELETE FROM raw_commits WHERE hash IN (SELECT hash FROM raw_commits WHERE hash IS NOT NULL)")
      // 由于 raw_commits 没有 repo 字段，我们清除所有统计表重新聚合不划算
      // 直接按 analysis_meta 中的记录来删除
      this.db!.run("DELETE FROM analysis_meta WHERE repo_path = ?", [repoPath])
    })
    await this.persist()
  }

  /** 删除仓库及其关联的全部统计数据 */
  async deleteRepoFull(repoPath: string): Promise<void> {
    if (!this.db) return
    const tables = [
      'raw_commits', 'stats_by_author', 'stats_by_date', 'stats_heatmap',
      'stats_module_ownership', 'stats_file_hotspots', 'stats_type_trend',
      'collaboration_edges', 'code_handoffs', 'ai_results',
    ]
    this.transaction(() => {
      // 目前单仓库模式，删除所有统计数据
      for (const table of tables) {
        this.db!.run(`DELETE FROM ${table}`)
      }
      this.db!.run("DELETE FROM analysis_meta WHERE repo_path = ?", [repoPath])
    })
    await this.persist()
  }

  // --- Waste Detection ---

  getWasteEvents(analysisId?: string) {
    if (analysisId) {
      return this.query<{
        id: number; pattern_id: string; severity: string; author_email: string;
        related_authors: string; file_paths: string; commit_hashes: string;
        lines_wasted: number; was_passive: number; description: string;
        evidence: string; root_cause: string; recommendation: string;
        detected_at: number; analysis_id: string;
      }>(
        'SELECT * FROM waste_events WHERE analysis_id = ? ORDER BY lines_wasted DESC',
        [analysisId],
      )
    }
    return this.query<{
      id: number; pattern_id: string; severity: string; author_email: string;
      related_authors: string; file_paths: string; commit_hashes: string;
      lines_wasted: number; was_passive: number; description: string;
      evidence: string; root_cause: string; recommendation: string;
      detected_at: number; analysis_id: string;
    }>(
      'SELECT * FROM waste_events ORDER BY lines_wasted DESC',
    )
  }

  getWasteScores() {
    return this.query<{
      author_email: string; author_name: string;
      total_lines_added: number; total_lines_wasted: number;
      waste_rate: number; net_effective_lines: number;
      waste_score: number; pattern_counts: string;
      top_pattern: string; passive_waste_lines: number;
      last_updated: number;
    }>(
      'SELECT * FROM waste_scores ORDER BY waste_score DESC',
    )
  }

  getLatestWasteRun() {
    return this.queryOne<{
      id: string; status: string; started_at: number; completed_at: number;
      files_analyzed: number; events_found: number;
      report_json: string;
    }>(
      'SELECT * FROM waste_analysis_runs WHERE status = ? ORDER BY completed_at DESC LIMIT 1',
      ['completed'],
    )
  }

  clearWasteData(): void {
    this.transaction(() => {
      this.db!.run('DELETE FROM waste_events')
      this.db!.run('DELETE FROM waste_scores')
      this.db!.run('DELETE FROM waste_analysis_runs')
    })
  }

  // --- Cleanup ---

  async clearAll(): Promise<void> {
    if (!this.db) return
    const tables = [
      'raw_commits', 'stats_by_author', 'stats_by_date', 'stats_heatmap',
      'stats_module_ownership', 'stats_file_hotspots', 'stats_type_trend',
      'collaboration_edges', 'code_handoffs', 'ai_results', 'analysis_meta',
      'waste_events', 'waste_scores', 'waste_analysis_runs',
    ]
    this.transaction(() => {
      for (const table of tables) {
        this.db!.run(`DELETE FROM ${table}`)
      }
    })
    await this.persist()
  }

  close(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    if (this.dirty && this.db) {
      // 同步持久化
      const data = this.db.export()
      // fire-and-forget
      saveToIndexedDB(data).catch(console.error)
    }
    this.db?.close()
    this.db = null
  }
}

// ============================================
// 全局单例
// ============================================

let dbInstance: GitPulseDB | null = null
let dbInitPromise: Promise<GitPulseDB> | null = null

export async function getDB(): Promise<GitPulseDB> {
  // 使用 Promise 保证并发调用只初始化一次（React StrictMode 会双重执行 useEffect）
  if (dbInitPromise) return dbInitPromise
  dbInitPromise = (async () => {
    if (dbInstance) return dbInstance
    const instance = new GitPulseDB()
    await instance.init()
    dbInstance = instance
    return instance
  })()
  return dbInitPromise
}

export function getDBSync(): GitPulseDB | null {
  return dbInstance
}

export async function resetDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
  dbInitPromise = null
  await clearIndexedDB()
}

/**
 * 彻底重置：清除 IndexedDB + 所有 GitPulse 相关的 localStorage
 * 用于用户需要完全重新开始的场景
 */
export async function fullReset(): Promise<void> {
  await resetDB()
  // 清除 Zustand persist 的 localStorage 数据
  localStorage.removeItem('gitpulse-settings')
  localStorage.removeItem('gitpulse-project')
  localStorage.removeItem('gitpulse-theme')
}
