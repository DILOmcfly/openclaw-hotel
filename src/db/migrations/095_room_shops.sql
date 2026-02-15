-- Room Furniture Shops System
-- Room owners can set up stores selling furniture to visitors

CREATE TABLE IF NOT EXISTS room_shops (
  room_id INT PRIMARY KEY,
  shop_name VARCHAR(100),
  description TEXT,
  is_open BOOLEAN DEFAULT true,
  total_sales INT DEFAULT 0,
  total_revenue INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_items (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL,
  item_name VARCHAR(100),
  price INT NOT NULL CHECK (price >= 1),
  stock INT DEFAULT -1,
  sold INT DEFAULT 0,
  listed_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (room_id) REFERENCES room_shops(room_id) ON DELETE CASCADE
);

CREATE INDEX idx_shop_items_room ON shop_items(room_id);
CREATE INDEX idx_shop_items_price ON shop_items(price);
CREATE INDEX idx_room_shops_revenue ON room_shops(total_revenue DESC);
