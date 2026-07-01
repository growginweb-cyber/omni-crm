-- customers に tags 配列カラムを追加（複数タグ管理）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- タグでの検索を高速化
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN(tags);
