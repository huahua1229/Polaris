-- 相册表
CREATE TABLE IF NOT EXISTS albums (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT true,
  password_hash TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 照片表
CREATE TABLE IF NOT EXISTS album_photos (
  id SERIAL PRIMARY KEY,
  album_id INT REFERENCES albums(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;

-- 公开相册可读
CREATE POLICY "公开相册可读" ON albums FOR SELECT USING (is_public = true);
CREATE POLICY "公开相册照片可读" ON album_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM albums WHERE albums.id = album_photos.album_id AND albums.is_public = true)
);

-- 插入
INSERT INTO albums (title, description, is_public, sort_order) VALUES
  ('日常随拍', '生活中的小美好', true, 0),
  ('珍藏回忆', '需要密码查看', false, 1);
