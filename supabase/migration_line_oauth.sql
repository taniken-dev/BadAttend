-- LINEOAuth対応: handle_new_user トリガー関数を更新
-- LINEが提供するメタデータ:
--   full_name  → LINE表示名
--   avatar_url → LINEプロフィール画像URL
--   grade      → LINEログイン時は存在しない（メール登録時のみ）

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    avatar_url,
    grade,
    role,
    skill_rank,
    is_approved
  )
  VALUES (
    new.id,
    -- full_name: メール登録・LINEどちらも同じキー名
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)  -- フォールバック: メアドのローカル部
    ),
    -- avatar_url: LINEプロフィール画像（メール登録時はNULL）
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    -- grade: メール登録時のみ存在、LINEは1をデフォルト
    COALESCE((new.raw_user_meta_data->>'grade')::int, 1),
    'member',
    3,       -- C級（標準）
    false    -- 承認待ち
  )
  ON CONFLICT (id) DO NOTHING;  -- 既存プロフィールは上書きしない

  RETURN new;
END;
$$;

-- トリガー自体は既に存在するはずだが、念のため再作成
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- SECURITY DEFINER 関数の実行権限を public/anon/authenticated から剥奪
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
