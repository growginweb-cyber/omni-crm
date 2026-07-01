-- broadcast_templates に html_content カラムを追加（メールHTMLテンプレート保存用）
ALTER TABLE broadcast_templates ADD COLUMN IF NOT EXISTS html_content text DEFAULT NULL;
