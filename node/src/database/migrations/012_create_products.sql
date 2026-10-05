CREATE TABLE products (
    id SERIAL PRIMARY KEY,

    shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,

    description TEXT,
    type TEXT,

    category VARCHAR(100),
    subcategory VARCHAR(100),

    brand VARCHAR(100),

    images TEXT[] NOT NULL,
    thumbnail_url  TEXT NOT NULL,

    tags TEXT[] DEFAULT '{}',

    weight NUMERIC(10,2),

    dimensions JSONB DEFAULT '{"unit":"cm","width":null,"height":null,"length":null}',

    specifications JSONB DEFAULT '{}',

    status VARCHAR(20) DEFAULT 'draft'
        CHECK (status IN ('draft','active','archived')),

    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP,

    is_featured BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_shop ON products(shop_id);