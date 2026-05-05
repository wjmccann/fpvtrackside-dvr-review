const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');

router.post('/register', (req, res) => {
  try {
    const { name, pin } = req.body;
    if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
    if (pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 characters' });

    const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: 'Name already taken' });

    const id = uuidv4();
    const pinHash = bcrypt.hashSync(pin, 10);
    db.prepare('INSERT INTO users (id, name, pin_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, pinHash, 'official', new Date().toISOString());

    const token = jwt.sign({ id, name, role: 'official' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id, name, role: 'official' }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { name, pin } = req.body;
    if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });

    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
    if (!user || !bcrypt.compareSync(pin, user.pin_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, name: user.name, role: user.role }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authRequired, (req, res) => {
  res.json(req.user);
});

module.exports = router;
