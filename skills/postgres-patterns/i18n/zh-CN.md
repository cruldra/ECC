---
name: postgres-patterns
description: PostgreSQL 数据库模式，涵盖查询优化、模式设计、索引与安全性。基于 Supabase 最佳实践。在设计 PostgreSQL 模式、索引或 RLS 策略时，或在查询过慢时使用。
metadata:
  origin: ECC
locale: zh-CN
source_hash: 9c8c391ae9e9aa87faa7ca091e1d395c97766df14080d0bfbea8a97721776163
translated_at: 2026-09-13T03:58:17Z
model: z-ai/glm-5.3-flash
---

# PostgreSQL 模式

PostgreSQL 最佳实践速查手册。如需详细指导，请使用 `database-reviewer` agent。

## 何时激活

- 编写 SQL 查询或迁移脚本
- 设计数据库模式
- 排查慢查询
- 实现行级安全（Row Level Security）
- 配置连接池

## 快速参考

### 索引速查表

| 查询模式 | 索引类型 | 示例 |
|--------------|------------|---------|
| `WHERE col = value` | B-tree（默认） | `CREATE INDEX idx ON t (col)` |
| `WHERE col > value` | B-tree | `CREATE INDEX idx ON t (col)` |
| `WHERE a = x AND b > y` | 复合索引 | `CREATE INDEX idx ON t (a, b)` |
| `WHERE jsonb @> '{}'` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| `WHERE tsv @@ query` | GIN | `CREATE INDEX idx ON t USING gin (col)` |
| 时间序列范围查询 | BRIN | `CREATE INDEX idx ON t USING brin (col)` |

### 数据类型速查表

| 使用场景 | 正确类型 | 应避免 |
|----------|-------------|-------|
| ID | `bigint` | `int`、随机 UUID |
| 字符串 | `text` | `varchar(255)` |
| 时间戳 | `timestamptz` | `timestamp` |
| 金额 | `numeric(10,2)` | `float` |
| 布尔标记 | `boolean` | `varchar`、`int` |

### 常见模式

**复合索引顺序：**
```sql
-- 等值列在前，范围列在后
CREATE INDEX idx ON orders (status, created_at);
-- 适用于：WHERE status = 'pending' AND created_at > '2024-01-01'
```

**覆盖索引：**
```sql
CREATE INDEX idx ON users (email) INCLUDE (name, created_at);
-- 避免 SELECT email, name, created_at 时的回表查找
```

**部分索引：**
```sql
CREATE INDEX idx ON users (email) WHERE deleted_at IS NULL;
-- 更小的索引，仅包含活跃用户
```

**RLS 策略（优化版）：**
```sql
CREATE POLICY policy ON orders
  USING ((SELECT auth.uid()) = user_id);  -- 务必用 SELECT 包裹！
```

**UPSERT：**
```sql
INSERT INTO settings (user_id, key, value)
VALUES (123, 'theme', 'dark')
ON CONFLICT (user_id, key)
DO UPDATE SET value = EXCLUDED.value;
```

**游标分页：**
```sql
SELECT * FROM products WHERE id > $last_id ORDER BY id LIMIT 20;
-- O(1)，而 OFFSET 是 O(n)
```

**队列处理：**
```sql
UPDATE jobs SET status = 'processing'
WHERE id = (
  SELECT id FROM jobs WHERE status = 'pending'
  ORDER BY created_at LIMIT 1
  FOR UPDATE SKIP LOCKED
) RETURNING *;
```

### 反模式检测

```sql
-- 查找未被索引的外键
SELECT conrelid::regclass, a.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)
  );

-- 查找慢查询
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- 检查表膨胀
SELECT relname, n_dead_tup, last_vacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### 配置模板

```sql
-- 连接数上限（根据内存调整）
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET work_mem = '8MB';

-- 超时设置
ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
ALTER SYSTEM SET statement_timeout = '30s';

-- 监控
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 安全默认值
REVOKE ALL ON SCHEMA public FROM public;

SELECT pg_reload_conf();
```

## 相关资源

- Agent：`database-reviewer` - 完整的数据库审查流程
- Skill：`clickhouse-io` - ClickHouse 分析模式
- Skill：`backend-patterns` - API 与后端模式

---

*基于 Supabase Agent Skills（致谢：Supabase 团队）（MIT 许可证）*