// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'))); // serve uploaded images
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});
const upload = multer({ storage });

// Database
mongoose.connect("mongodb+srv://34group123890_db_user:32ztB3p3hH0dl33k@cluster0.nv5223x.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' }
});

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: String,
  price: Number,
  createdBy: { type: String },
  imagePath: String // store URL or relative path to uploaded image
});

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);

// Auth middleware
const requireAuth = (req, res, next) => {
  req.session.userId ? next() : res.status(401).json({ error: 'Unauthorized' });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.session.userId && req.session.role === 'admin') next();
  else res.status(403).json({ error: 'Forbidden' });
};

// User middleware (non-admin)
const requireUser = (req, res, next) => {
  if (req.session.userId && req.session.role === 'user') next();
  else if (req.session.userId && req.session.role === 'admin') next(); // admin can view display page too
  else res.status(401).json({ error: 'Unauthorized' });
};

// Routes: serve HTML (kept same file locations under public/)
app.get('/', (req, res) => {
  if (req.session.userId) {
    if (req.session.role === 'admin') return res.redirect('/html/dashboard.html');
    return res.redirect('/html/display.html');
  } else {
    return res.redirect('/html/login.html');
  }
});

// Auth APIs
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (await User.findOne({ username })) return res.status(400).json({ error: 'Username already exists' });

    const user = new User({
      username,
      password: await bcrypt.hash(password, 12)
    });
    await user.save();
    res.status(201).json({ message: 'User created' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ error: 'Invalid credentials' });

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;

    res.json({ message: 'Login successful', username: user.username, role: user.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out' });
  });
});

// CRUD APIs - items
app.get('/api/items', async (req, res) => {
  try {
    const { category, name, minPrice, maxPrice, search } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (name || search) filter.name = { $regex: name || search, $options: 'i' };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    const items = await Item.find(filter);
    // convert imagePath to accessible url if needed
    const itemsWithUrls = items.map(it => ({
      ...it.toObject(),
      imageUrl: it.imagePath ? `/uploads/${path.basename(it.imagePath)}` : `/mnt/data/b2ff30bc-d420-49e8-94d7-5ee0e1a58a17.png`
    }));
    res.json(itemsWithUrls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create item with image upload
app.post('/api/items', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const itemData = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      price: parseFloat(req.body.price || 0),
      createdBy: req.session.username
    };
    if (req.file) itemData.imagePath = req.file.filename; // store filename
    const item = new Item(itemData);
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update item (allow image replace)
app.put('/api/items/:id', requireAuth, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const update = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      price: parseFloat(req.body.price || 0)
    };
    if (req.file) update.imagePath = req.file.filename;
    const item = await Item.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete item
app.delete('/api/items/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    // remove image file if exists
    if (item.imagePath) {
      const fp = path.join(uploadsDir, path.basename(item.imagePath));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User Management (admin)
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'username role');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update role
app.put('/api/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User role updated', user: { username: user.username, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete user (admin)
app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    // prevent self-delete (optional)
    if (req.session.userId == userId) return res.status(400).json({ error: "You cannot delete yourself" });

    await User.findByIdAndDelete(userId);
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Current user info
app.get('/api/current-user', (req, res) => {
  if (req.session.userId) {
    return res.json({ username: req.session.username, role: req.session.role });
  }
  res.status(401).json({ error: 'Not logged in' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
