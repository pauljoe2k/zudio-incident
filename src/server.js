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

// BUG 1 & 2: SQL Injection & Plaintext Passwords
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Fixed: SQL Injection and Plaintext passwords check
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
    // Fixed: Plaintext Passwords
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

// BUG 3: Coupon Reuse
app.post('/api/apply-coupon', async (req, res) => {
  const { code, order_id } = req.body;
  try {
    const couponRes = await pool.query('SELECT * FROM coupons WHERE code = $1', [code]);
    if (couponRes.rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
    
    const coupon = couponRes.rows[0];
    
    // [BUG]: No check if coupon is already used
    await pool.query('UPDATE orders SET coupon_id = $1 WHERE id = $2', [coupon.id, order_id]);
    
    res.json({ success: true, discount: coupon.discount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BUG 4: Stock Decrement Bug (Race condition / No atomic decrement / Negative inventory)
app.post('/api/checkout', async (req, res) => {
  const { product_id, user_id } = req.body;
  try {
    const productRes = await pool.query('SELECT * FROM products WHERE id = $1', [product_id]);
    if (productRes.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    
    const product = productRes.rows[0];
    
    // [BUG]: Does not prevent stock from going below 0, not in a transaction
    if (product.stock > 0) {
      const newStock = product.stock - 1;
      await pool.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, product_id]);
      await pool.query('INSERT INTO orders (user_id, product_id) VALUES ($1, $2)', [user_id, product_id]);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Out of stock' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BUG 5: N+1 Query in Order History
app.get('/api/orders', async (req, res) => {
  try {
    // [BUG]: N+1 Query
    const ordersRes = await pool.query('SELECT * FROM orders');
    const orders = ordersRes.rows;
    
    const fullOrders = [];
    for (const order of orders) {
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [order.user_id]);
      const productRes = await pool.query('SELECT * FROM products WHERE id = $1', [order.product_id]);
      fullOrders.push({
        ...order,
        user: userRes.rows[0],
        product: productRes.rows[0]
      });
    }
    
    res.json(fullOrders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
