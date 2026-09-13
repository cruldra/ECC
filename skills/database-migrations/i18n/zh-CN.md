---
name: database-migrations
description: 针对 PostgreSQL、MySQL 以及常见 ORM（Prisma、Drizzle、Kysely、Django、TypeORM、golang-migrate）的数据库迁移最佳实践，涵盖 schema 变更、数据迁移、回滚和零停机部署。在编写 schema 或数据迁移、规划回滚或追求零停机部署时使用。
metadata:
  origin: ECC
locale: zh-CN
source_hash: ad7f2f04ca03e592a16e2a539d8c6e90bf4e08892408820ce99a53e9d07775de
translated_at: 2026-09-13T03:55:40Z
model: z-ai/glm-5.3-flash
---

# 数据库迁移模式

面向生产系统的安全、可逆的数据库 schema 变更。

## 何时激活

- 创建或修改数据库表
- 添加/删除列或索引
- 执行数据迁移（回填、转换）
- 规划零停机 schema 变更
- 为新项目搭建迁移工具

## 核心原则

1. **每次变更都是一个迁移** — 绝不手动修改生产数据库
2. **生产环境中的迁移只向前推进** — 回滚通过新增的向前迁移实现
3. **Schema 迁移与数据迁移相互分离** — 绝不在一个迁移中混合 DDL 和 DML
4. **用生产规模的数据测试迁移** — 在 100 行上可用的迁移在 1000 万行上可能造成锁表
5. **迁移一旦部署即不可变** — 绝不编辑已在生产中执行过的迁移

## 迁移安全清单

在应用任何迁移之前：

- [ ] 迁移同时包含 UP 和 DOWN（或被明确标记为不可逆）
- [ ] 对大表没有全表锁（使用并发操作）
- [ ] 新列有默认值或可为空（绝不在无默认值的情况下添加 NOT NULL）
- [ ] 索引以并发方式创建（对已存在的表不要在 CREATE TABLE 中内联创建）
- [ ] 数据回填与 schema 变更为相互独立的迁移
- [ ] 已在生产数据副本上测试
- [ ] 已记录回滚方案

## PostgreSQL 模式

### 安全地添加列

```sql
-- GOOD: 可空列，不锁表
ALTER TABLE users ADD COLUMN avatar_url TEXT;

-- GOOD: 带默认值的列（Postgres 11+ 立即完成，无需重写表）
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- BAD: 在已有表上添加无默认值的 NOT NULL（需要完整重写表）
ALTER TABLE users ADD COLUMN role TEXT NOT NULL;
-- 这会锁表并重写每一行
```

### 无停机添加索引

```sql
-- BAD: 在大表上阻塞写入
CREATE INDEX idx_users_email ON users (email);

-- GOOD: 非阻塞，允许并发写入
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- 注意：CONCURRENTLY 不能在事务块中运行
-- 大多数迁移工具需要对此做特殊处理
```

### 重命名列（零停机）

绝不在生产环境中直接重命名。使用 expand-contract 模式：

```sql
-- 步骤 1：添加新列（迁移 001）
ALTER TABLE users ADD COLUMN display_name TEXT;

-- 步骤 2：回填数据（迁移 002，数据迁移）
UPDATE users SET display_name = username WHERE display_name IS NULL;

-- 步骤 3：更新应用代码以同时读写两个列
-- 部署应用变更

-- 步骤 4：停止写入旧列，删除它（迁移 003）
ALTER TABLE users DROP COLUMN username;
```

### 安全地删除列

```sql
-- 步骤 1：移除应用中对该列的所有引用
-- 步骤 2：部署不含该列引用的应用
-- 步骤 3：在下一次迁移中删除该列
ALTER TABLE orders DROP COLUMN legacy_status;

-- 对于 Django：使用 SeparateDatabaseAndState 从模型中移除该字段，
-- 而不生成 DROP COLUMN（然后在下一次迁移中删除该列）
```

### 大规模数据迁移

```sql
-- BAD: 在一个事务中更新所有行（锁表）
UPDATE users SET normalized_email = LOWER(email);

-- GOOD: 分批更新并显示进度
DO $$
DECLARE
  batch_size INT := 10000;
  rows_updated INT;
BEGIN
  LOOP
    UPDATE users
    SET normalized_email = LOWER(email)
    WHERE id IN (
      SELECT id FROM users
      WHERE normalized_email IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    );
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % rows', rows_updated;
    EXIT WHEN rows_updated = 0;
    COMMIT;
  END LOOP;
END $$;
```

## Prisma (TypeScript/Node.js)

### 工作流

```bash
# 从 schema 变更创建迁移
npx prisma migrate dev --name add_user_avatar

# 在生产环境应用待执行的迁移
npx prisma migrate deploy

# 重置数据库（仅限开发环境）
npx prisma migrate reset

# schema 变更后生成客户端
npx prisma generate
```

### Schema 示例

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  orders    Order[]

  @@map("users")
  @@index([email])
}
```

### 自定义 SQL 迁移

对于 Prisma 无法表达的操作（并发索引、数据回填）：

```bash
# 创建空迁移，然后手动编辑 SQL
npx prisma migrate dev --create-only --name add_email_index
```

```sql
-- migrations/20240115_add_email_index/migration.sql
-- Prisma 无法生成 CONCURRENTLY，因此我们手动编写
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
```

## Drizzle (TypeScript/Node.js)

### 工作流

```bash
# 从 schema 变更生成迁移
npx drizzle-kit generate

# 应用迁移
npx drizzle-kit migrate

# 直接推送 schema（仅限开发环境，不生成迁移文件）
npx drizzle-kit push
```

### Schema 示例

```typescript
import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

## Kysely (TypeScript/Node.js)

### 工作流（kysely-ctl）

```bash
# 初始化配置文件（kysely.config.ts）
kysely init

# 创建新的迁移文件
kysely migrate make add_user_avatar

# 应用所有待执行的迁移
kysely migrate latest

# 回滚最近一次迁移
kysely migrate down

# 显示迁移状态
kysely migrate list
```

### 迁移文件

```typescript
// migrations/2024_01_15_001_create_user_profile.ts
import { type Kysely, sql } from 'kysely'

// 重要：始终使用 Kysely<any>，而不是你的类型化 DB 接口。
// 迁移在时间上是冻结的，不得依赖当前的 schema 类型。
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_profile')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('avatar_url', 'text')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .execute()

  await db.schema
    .createIndex('idx_user_profile_avatar')
    .on('user_profile')
    .column('avatar_url')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user_profile').execute()
}
```

### 编程式迁移器

```typescript
import { Migrator, FileMigrationProvider } from 'kysely'
import { promises as fs } from 'fs'
import * as path from 'path'
// 仅支持 ESM — CJS 可直接使用 __dirname
import { fileURLToPath } from 'url'
const migrationFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  './migrations',
)

// `db` 是你的 Kysely<any> 数据库实例
const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
  }),
  // 警告：仅在开发环境中启用。会禁用时间戳顺序校验，
  // 可能导致不同环境之间的 schema 漂移。
  // allowUnorderedMigrations: true,
})

const { error, results } = await migrator.migrateToLatest()

results?.forEach((it) => {
  if (it.status === 'Success') {
    console.log(`migration "${it.migrationName}" executed successfully`)
  } else if (it.status === 'Error') {
    console.error(`failed to execute migration "${it.migrationName}"`)
  }
})

if (error) {
  console.error('migration failed', error)
  process.exit(1)
}
```

## Django (Python)

### 工作流

```bash
# 从模型变更生成迁移
python manage.py makemigrations

# 应用迁移
python manage.py migrate

# 显示迁移状态
python manage.py showmigrations

# 生成用于自定义 SQL 的空迁移
python manage.py makemigrations --empty app_name -n description
```

### 数据迁移

```python
from django.db import migrations

def backfill_display_names(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    batch_size = 5000
    users = User.objects.filter(display_name="")
    while users.exists():
        batch = list(users[:batch_size])
        for user in batch:
            user.display_name = user.username
        User.objects.bulk_update(batch, ["display_name"], batch_size=batch_size)

def reverse_backfill(apps, schema_editor):
    pass  # 数据迁移，无需反向操作

class Migration(migrations.Migration):
    dependencies = [("accounts", "0015_add_display_name")]

    operations = [
        migrations.RunPython(backfill_display_names, reverse_backfill),
    ]
```

### SeparateDatabaseAndState

从 Django 模型中移除某列，但不立即从数据库中删除它：

```python
class Migration(migrations.Migration):
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RemoveField(model_name="user", name="legacy_field"),
            ],
            database_operations=[],  # 暂时不要动数据库
        ),
    ]
```

## golang-migrate (Go)

### 工作流

```bash
# 创建迁移对
migrate create -ext sql -dir migrations -seq add_user_avatar

# 应用所有待执行的迁移
migrate -path migrations -database "$DATABASE_URL" up

# 回滚最近一次迁移
migrate -path migrations -database "$DATABASE_URL" down 1

# 强制指定版本（修复 dirty 状态）
migrate -path migrations -database "$DATABASE_URL" force VERSION
```

### 迁移文件

```sql
-- migrations/000003_add_user_avatar.up.sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
CREATE INDEX CONCURRENTLY idx_users_avatar ON users (avatar_url) WHERE avatar_url IS NOT NULL;

-- migrations/000003_add_user_avatar.down.sql
DROP INDEX IF EXISTS idx_users_avatar;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
```

## 零停机迁移策略

对于关键的生产变更，遵循 expand-contract 模式：

```
阶段 1：EXPAND（扩展）
  - 添加新列/新表（可空或带默认值）
  - 部署：应用同时写入旧列和新列
  - 回填已有数据

阶段 2：MIGRATE（迁移）
  - 部署：应用从新列读取，同时写入新旧两列
  - 验证数据一致性

阶段 3：CONTRACT（收缩）
  - 部署：应用只使用新列
  - 在独立的迁移中删除旧列/旧表
```

### 时间线示例

```
第 1 天：迁移添加 new_status 列（可空）
第 1 天：部署应用 v2 — 同时写入 status 和 new_status
第 2 天：运行针对已有行的回填迁移
第 3 天：部署应用 v3 — 只从 new_status 读取
第 7 天：迁移删除旧的 status 列
```

## 反模式

| 反模式 | 失败原因 | 更好的做法 |
|-------------|-------------|-----------------|
| 在生产环境手动执行 SQL | 无审计记录，不可重复 | 始终使用迁移文件 |
| 编辑已部署的迁移 | 导致环境间 schema 漂移 | 改为创建新的迁移 |
| 无默认值的 NOT NULL | 锁表，重写所有行 | 先添加可空列，回填后再添加约束 |
| 在大表上内联创建索引 | 构建期间阻塞写入 | CREATE INDEX CONCURRENTLY |
| 一个迁移同时包含 schema 和数据 | 难以回滚，事务过长 | 分离为多个迁移 |
| 在移除代码之前删除列 | 应用因缺少列而报错 | 先移除代码，下次部署再删除列 |