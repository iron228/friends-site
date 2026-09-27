const express = require('express');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const DISCOUNTS_FILE = path.join(__dirname, 'discounts.json');
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'store-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

function readDb() {
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  db.users = db.users || [];
  db.products = readProducts();
  db.orders = db.orders || [];
  db.notifications = db.notifications || [];
  db.users = db.users.map(user => ({
    ...user,
    permissions: user.permissions || [],
    verified: user.verified !== false
  }));
  return db;
}

function readProducts() {
  if (!fs.existsSync(PRODUCTS_FILE)) return [];
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
  if (!Array.isArray(products)) throw new Error('products.json must contain an array of products');
  return products.map(product => ({
    ...product,
    price: Number(product.price) || 0,
    quantity: Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : 1,
    unlimitedStock: product.unlimitedStock === true,
    attachments: (product.attachments || []).map(attachment => ({
      ...attachment,
      path: attachment.path || `/uploads/${attachment.filename}`
    })),
    stats: { views: 0, sales: 0, revenue: 0, ...(product.stats || {}) }
  }));
}

function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf-8');
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function readDiscounts() {
  if (!fs.existsSync(DISCOUNTS_FILE)) return {};
  const discounts = JSON.parse(fs.readFileSync(DISCOUNTS_FILE, 'utf-8'));
  return Object.fromEntries(Object.entries(discounts).map(([code, discount]) => [code.trim().toUpperCase(), discount]));
}

const isAdminName = name => {
  const normalized = name?.trim().toLowerCase();
  return normalized === 'asser' || normalized === 'asseramir2004@gmail.com';
};
let mailTransporter = null;

async function initMailer() {
  if (mailTransporter) return;
  const isDummyHost = !process.env.EMAIL_HOST || process.env.EMAIL_HOST === 'smtp.example.com';
  const isDummyUser = !process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_smtp_user';
  if (isDummyHost || isDummyUser) {
    mailTransporter = {
      sendMail: async (options) => {
        console.log('\n========================================');
        console.log('📬  [MOCK EMAIL SENT]');
        console.log(`To:      ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body:    ${options.text}`);
        console.log('========================================\n');
        return { messageId: 'mock-message-id' };
      },
      verify: async () => true
    };
    return;
  }
  const nodemailer = require('nodemailer');
  mailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await mailTransporter.verify();
}

async function sendVerificationEmail(email, name, code) {
  await initMailer();
  await mailTransporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@korynlabs.local',
    to: email,
    subject: 'Your RoMarketplace verification code',
    text: `Hello ${name}, your verification code is ${code}`,
    html: `<p>Hello <strong>${name}</strong>,</p><p>Your verification code is <strong>${code}</strong>.</p>`
  });
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: 'Not authenticated' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!req.session.user.permissions.includes('admin:full')) return res.status(403).json({ message: 'Forbidden' });
  next();
}

app.post('/api/signup', async (req, res) => {
  return res.status(410).json({ message: 'Account creation is no longer available. Guest checkout is enabled.' });
  /* Legacy account creation retained here for reference only.
  const { email, password } = req.body;
  const name = email;
  const db = readDb();
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'Email already exists' });

  const code = generateVerificationCode();
  const user = {
    id: uuidv4(),
    email,
    name,
    password,
    permissions: isAdminName(email) ? ['admin:full'] : [],
    verified: false,
    verifyCode: code
  };

  db.users.push(user);
  db.notifications.push({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    message: `Account signup pending verification: ${email}`,
    type: 'team',
    read: false,
    userId: user.id
  });
  writeDb(db);

  try {
    await sendVerificationEmail(email, name, code);
  } catch (error) {
    console.error('Email send failed:', error);
    return res.status(500).json({ message: 'Failed to send verification email. Please check the email configuration.' });
  }

  res.json({ message: 'Account created. Verification code sent to email.' });
  */
});

app.post('/api/verify', (req, res) => {
  return res.status(410).json({ message: 'Account verification is no longer available.' });
  /* Legacy verification retained here for reference only.
  const { email, code } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.email === email && u.verifyCode === code);
  if (!user) return res.status(400).json({ message: 'Invalid email or code' });
  user.verified = true;
  user.verifyCode = null;
  req.session.user = { id: user.id, email: user.email, name: user.name, permissions: user.permissions };
  writeDb(db);
  res.json({ user: req.session.user });
  */
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.verified === false) return res.status(403).json({ message: 'Account not verified. Check email for code.' });
  req.session.user = { id: user.id, email: user.email, name: user.name, permissions: user.permissions };
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ message: 'Not authenticated' });
  res.json({ user: req.session.user });
});

app.get('/api/products', (req, res) => {
  res.json(readProducts());
});

app.get('/api/my-orders', requireAuth, (req, res) => {
  const db = readDb();
  const orders = db.orders.filter(order => order.userId === req.session.user.id).map(order => {
    const attachments = order.items.flatMap(item => {
      const product = db.products.find(p => p.id === item.productId);
      return product ? product.attachments : [];
    });
    return { ...order, attachments };
  });
  res.json(orders);
});

app.post('/api/products', requireAdmin, upload.array('attachments', 5), (req, res) => {
  const products = readProducts();
  const { title, description, price, quantity, category } = req.body;
  const unlimitedStock = req.body.unlimitedStock === 'true';
  const product = {
    id: uuidv4(),
    title,
    description,
    price: Number(price) || 0,
    quantity: Number(quantity) || 0,
    unlimitedStock,
    category,
    attachments: req.files.map(file => ({ filename: file.filename, originalname: file.originalname, path: `/uploads/${file.filename}` })),
    createdAt: new Date().toISOString(),
    stats: {
      views: 0,
      sales: 0,
      revenue: 0
    }
  };
  products.push(product);
  writeProducts(products);
  res.json(product);
});

app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const products = readProducts();
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Product not found' });
  products.splice(index, 1);
  writeProducts(products);
  res.json({ success: true });
});

app.post('/api/users', requireAdmin, (req, res) => {
  const db = readDb();
  const { email, name, permissions, password } = req.body;
  if (!email || !name || !permissions) return res.status(400).json({ message: 'Missing fields' });
  if (db.users.some(u => u.email === email)) return res.status(409).json({ message: 'Email already exists' });
  const user = {
    id: uuidv4(),
    email,
    name,
    password: password || 'ChangeMe123!',
    permissions: Array.isArray(permissions) ? permissions : permissions.split(',').map(p => p.trim())
  };
  db.users.push(user);
  db.notifications.push({
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    message: `New team member invited: ${name}`,
    type: 'team',
    read: false,
    userId: user.id
  });
  writeDb(db);
  res.json({ id: user.id, email: user.email, name: user.name, permissions: user.permissions });
});

app.get('/api/users', requireAdmin, (req, res) => {
  const db = readDb();
  res.json(db.users.map(u => ({ id: u.id, email: u.email, name: u.name, permissions: u.permissions })));
});

app.get('/api/orders', requireAdmin, (req, res) => {
  const db = readDb();
  res.json(db.orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(o => ({
      ...o,
      customerName: o.customerName || db.users.find(u => u.id === o.userId)?.name || 'Guest',
      customerEmail: o.customerEmail || db.users.find(u => u.id === o.userId)?.email || 'guest@store.local'
    })));
});

app.get('/api/notifications', requireAuth, (req, res) => {
  const db = readDb();
  const notifications = req.session.user.permissions.includes('admin:full')
    ? db.notifications
    : db.notifications.filter(n => n.userId === req.session.user.id);
  res.json(notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/notifications/mark-read', requireAuth, (req, res) => {
  const { notificationId } = req.body;
  const db = readDb();
  const note = db.notifications.find(n => n.id === notificationId);
  if (note && (req.session.user.permissions.includes('admin:full') || note.userId === req.session.user.id)) {
    note.read = true;
    writeDb(db);
  }
  res.json({ success: true });
});

app.put('/api/users/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { name, permissions, email, password } = req.body;
  if (name) {
    user.name = name;
    if (isAdminName(name) && !user.permissions.includes('admin:full')) {
      user.permissions.push('admin:full');
    }
  }
  if (permissions) user.permissions = Array.isArray(permissions) ? permissions : permissions.split(',').map(p => p.trim());
  if (email) user.email = email;
  if (password) user.password = password;
  writeDb(db);
  res.json({ id: user.id, email: user.email, name: user.name, permissions: user.permissions });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.session.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password, email } = req.body;
  if (email) {
    if (db.users.some(u => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    user.email = email;
    user.name = email;
    if (isAdminName(email) && !user.permissions.includes('admin:full')) {
      user.permissions.push('admin:full');
    }
  }
  if (password) user.password = password;
  writeDb(db);
  req.session.user = { id: user.id, email: user.email, name: user.name, permissions: user.permissions };
  res.json({ id: user.id, email: user.email, name: user.name, permissions: user.permissions });
});

app.post('/api/reset-password-request', requireAuth, async (req, res) => {
  try {
    const db = readDb();
    const user = db.users.find(u => u.id === req.session.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = generateVerificationCode();
    user.resetCode = code;
    writeDb(db);

    await sendVerificationEmail(user.email, user.name, code);
    res.json({ message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('Reset password request failed:', error);
    res.status(500).json({ message: error.message || 'Failed to send verification code' });
  }
});

app.post('/api/reset-password-confirm', requireAuth, (req, res) => {
  const { code, newPassword } = req.body;
  if (!code || !newPassword) return res.status(400).json({ message: 'Code and new password are required' });

  const db = readDb();
  const user = db.users.find(u => u.id === req.session.user.id && u.resetCode === code);
  if (!user) return res.status(400).json({ message: 'Invalid or expired verification code' });

  user.password = newPassword;
  user.resetCode = null;
  writeDb(db);

  res.json({ message: 'Password reset successfully' });
});

app.get('/api/stats', requireAdmin, (req, res) => {
  const db = readDb();
  const totalRevenue = db.orders.reduce((sum, order) => sum + order.total, 0);
  const totalOrders = db.orders.length;
  const totalProducts = db.products.length;
  const totalUsers = db.users.length;
  const recentOrders = db.orders.slice(-5).reverse();
  const topProducts = db.products
    .slice()
    .sort((a, b) => (b.stats.sales || 0) - (a.stats.sales || 0))
    .slice(0, 4)
    .map(p => ({ title: p.title, sales: p.stats.sales || 0, revenue: p.stats.revenue || 0 }));

  const revenueByDay = db.orders.reduce((map, order) => {
    const day = new Date(order.createdAt).toISOString().split('T')[0];
    map[day] = (map[day] || 0) + order.total;
    return map;
  }, {});
  const revenueChart = Object.entries(revenueByDay)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, revenue]) => ({ date, revenue }));

  res.json({ totalRevenue, totalOrders, totalProducts, totalUsers, recentOrders, topProducts, revenueChart });
});

app.get('/api/payment-link/:productId/:discountCode?', (req, res) => {
  const product = readDb().products.find(item => item.id === req.params.productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const discountCode = String(req.params.discountCode || '').trim().toUpperCase();
  let url = product.paymentLink;
  if (discountCode) {
    const discount = readDiscounts()[discountCode];
    if (!discount || discount.active === false) return res.status(400).json({ message: 'Invalid or inactive discount code' });
    url = product.discountPaymentLinks?.[discountCode] || product.paymentLink;
    if (!url) return res.status(503).json({ message: 'This product does not have a payment link configured yet.' });
  }
  if (!url) return res.status(503).json({ message: 'This product does not have a payment link configured yet.' });
  res.json({ url, discountCode });
});

app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });
  res.sendFile(filePath);
});

app.get('/api/download/:productId', (req, res) => {
  const product = readProducts().find(item => item.id === req.params.productId);
  const attachment = product?.attachments?.[0];
  if (!attachment) return res.status(404).json({ message: 'Download not found' });
  const filePath = path.join(UPLOAD_DIR, path.basename(attachment.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Download file not found' });
  res.download(filePath, attachment.originalname || attachment.filename);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Store server running on http://localhost:${PORT}`));
