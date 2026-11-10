-- AFTERHOURS — photos in comments. Run once after 010. Safe to re-run.
alter table public.post_comments add column if not exists media_path text check (media_path is null or length(media_path) <= 400);
