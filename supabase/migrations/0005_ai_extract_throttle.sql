-- ════════════════════════════════════════════════════════════════════════════
-- OpenRoles — 0005_ai_extract_throttle.sql
-- Tracks the last time AI (Gemini) extraction was attempted for a company,
-- so the recurring ingest cron can retry non-ATS/non-JSON-LD companies
-- without re-running AI extraction on every 30-minute pass.
-- ════════════════════════════════════════════════════════════════════════════

alter table companies add column if not exists ai_extract_attempted_at timestamptz;
