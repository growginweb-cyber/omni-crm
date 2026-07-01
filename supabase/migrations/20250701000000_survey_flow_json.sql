-- survey_campaigns に flow_json カラムを追加（診断設計ノードフロー永続化）
ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS flow_json JSONB DEFAULT NULL;
