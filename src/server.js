require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Profiling middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[PROFILE] ${req.method} ${req.originalUrl} took ${duration}ms`);
  });
  next();
});

const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM users WHERE username = $1`, [username]
    );
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        res.json({ success: true, user: { id: user.id, username: user.username } });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (username, password) VALUES ($1, $2)`,
      [username, hashedPassword]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/apply-coupon', async (req, res) => {
  const { code, order_id } = req.body;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const couponRes = await client.query('SELECT * FROM coupons WHERE code = $1 FOR UPDATE', [code]);
      if (couponRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Coupon not found' });
      }
      
      const coupon = couponRes.rows[0];
      if (coupon.used) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Coupon already used' });
      }
      
      await client.query('UPDATE coupons SET used = TRUE WHERE id = $1', [coupon.id]);
      await client.query('UPDATE orders SET coupon_id = $1 WHERE id = $2', [coupon.id, order_id]);
      
      await client.query('COMMIT');
      res.json({ success: true, discount: coupon.discount });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/checkout', async (req, res) => {
  const { product_id, user_id } = req.body;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productRes = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);
      if (productRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }
      
      const product = productRes.rows[0];
      
      if (product.stock > 0) {
        await client.query('UPDATE products SET stock = stock - 1 WHERE id = $1', [product_id]);
        await client.query('INSERT INTO orders (user_id, product_id) VALUES ($1, $2)', [user_id, product_id]);
        await client.query('COMMIT');
        res.json({ success: true });
      } else {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Out of stock' });
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const ordersRes = await pool.query(`
      SELECT 
        o.id as order_id, o.status,
        u.id as user_id, u.username,
        p.id as product_id, p.name as product_name, p.price
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN products p ON o.product_id = p.id
    `);
    
    const fullOrders = ordersRes.rows.map(row => ({
      id: row.order_id, 
      status: row.status,
      user: { id:  row.user_id, username: row.username },
      product: { id: row.product_id, name: row.product_name, price: row.price }
    }));
    
    res.json(fullOrders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running in ${PORT}`);
});
