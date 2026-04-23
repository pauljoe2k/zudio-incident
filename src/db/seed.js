require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO users (username, password) VALUES 
      ('admin', 'admin123'),
      ('john', 'password123');

      INSERT INTO products (name, stock, price) VALUES 
      ('Zudio T-Shirt', 10, 299.99),
      ('Zudio Jeans', 5, 899.99);

      INSERT INTO coupons (code, discount) VALUES 
      ('WELCOME50', 50.00),
      ('SALE100', 100.00);

      INSERT INTO orders (user_id, product_id, status) VALUES 
      (1, 1, 'DELIVERED'),
      (2, 2, 'PENDING');
    `);
    console.log('Seeding successful');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
