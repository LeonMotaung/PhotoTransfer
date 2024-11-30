const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));


const upload = multer({
  storage: multer.diskStorage({
      destination: function (req, file, cb) {
          const uploadDir = 'public/uploads';
          if (!fs.existsSync(uploadDir)){
              fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
      },
      filename: function (req, file, cb) {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, uniqueSuffix + path.extname(file.originalname));
      }
  }),
  limits: {
      fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
      } else {
          cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
      }
  }
});
app.get('/photo', async (req, res) => {
  if (!req.session.userId) {
      return res.redirect('/signin');
  }

  try {
      const images = await Image.find({ userId: req.session.userId })
          .sort({ createdAt: -1 });
      const user = await User.findById(req.session.userId);
      
      res.render('photo', {
          title: 'Upload Photo',
          user: user,
          images: images,
          error: req.query.error,
          success: req.query.success
      });
  } catch (error) {
      console.error('Error:', error);
      res.render('photo', {
          title: 'Upload Photo',
          images: [],
          error: 'Error loading images'
      });
  }
});
// Add this to your POST route
app.post('/photo', upload.single('image'), async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { title, description } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        console.log('File uploaded:', req.file);  // Add this line
        
        const newImage = new Image({
            userId: req.session.userId,
            title: title || 'Untitled',
            description: description || '',
            imagePath: '/uploads/' + req.file.filename
        });

        console.log('New image:', newImage);  // Add this line

        await newImage.save();
        res.status(200).json({ message: 'Image uploaded successfully' });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Error uploading image' });
    }
});


app.delete('/photo/:id', async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
      const image = await Image.findOne({
          _id: req.params.id,
          userId: req.session.userId
      });

      if (!image) {
          return res.status(404).json({ error: 'Image not found' });
      }

      const filePath = path.join(__dirname, 'public', image.imagePath);
      if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
      }

      await Image.findByIdAndDelete(req.params.id);
      res.json({ message: 'Image deleted successfully' });

  } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Error deleting image' });
  }
});


const imageSchema = new mongoose.Schema({
  userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
  },
  title: {
      type: String,
      required: true
  },
  description: String,
  imagePath: {
      type: String,
      required: true
  },
  createdAt: {
      type: Date,
      default: Date.now
  }
});
const Image = mongoose.model('Image', imageSchema);
// Update these lines (around line 143)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const userSchema = new mongoose.Schema({
  username: {
      type: String,
      required: true,
      unique: true,
      trim: true
  },
  password: {
      type: String,
      required: true
  },
  email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
  },
  instagram: {
      type: String,
      trim: true
  },
  facebook: {
      type: String,
      trim: true
  },
  age: {
      type: Number,
      required: true
  },
  address: {
      street: {
          type: String,
          required: true
      },
      suburb: {
          type: String,
          required: true
      },
      city: {
          type: String,
          required: true
      },
      postalCode: {
          type: String,
          required: true
      }
  },
  createdAt: {
      type: Date,
      default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Assign the User model
const User = mongoose.model('User', userSchema);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// MongoDB Connection
mongoose
  .connect('mongodb://localhost:27017/ByteBurst', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'ByteBurst - Home' });
});

app.get('/signup', (req, res) => {
  res.render('signup', { title: 'Sign Up' });
});

app.get('/signin', (req, res) => {
  res.render('signin', { title: 'Sign In' });
});
app.get('/about', (req, res) => {
  res.render('about', { title: 'About US' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact US' });
});

app.get('/photo', (req, res) => {
  res.render('photo', { title: 'Upload Photo' });
});
app.post('/signup', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      confirmPassword,
      instagram,
      facebook,
      age,
      street,
      suburb,
      city,
      postalCode,
    } = req.body;

    // Password validation
    if (password !== confirmPassword) {
      return res.render('signup', { title: 'Sign Up', error: 'Passwords do not match.' });
    }

    // Create user object
    const user = new User({
      username,
      email,
      password,
      instagram,
      facebook,
      age,
      address: {
        street,
        suburb,
        city,
        postalCode,
      },
    });

    // Save to MongoDB
    await user.save();

    req.session.isLoggedIn = true;
    req.session.userId = user._id;

    res.redirect('/signin');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating user. Please ensure all fields are correctly filled.');
  }
});


app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  
 
  const user = await User.findOne({ email });
  if (!user) {
      return res.status(400).send('Invalid email or password');
  }


  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
      return res.status(400).send('Invalid email or password');
  }


  req.session.userId = user._id;

  res.redirect('/dashboard');
});

// Dashboard Route
app.get('/dashboard', async (req, res) => {
  if (!req.session.userId) {
      return res.redirect('/signin');
  }
  // Retrieve the user's data from the database
  const user = await User.findById(req.session.userId);
  if (!user) {
      return res.redirect('/signin');
  }

  res.render('dashboard', { user });
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error logging out.');
    }
    res.redirect('/signin');
  });
});
// Add this route after your other photo routes
app.get('/photo/gallery', async (req, res) => {
  if (!req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
      const images = await Image.find({ userId: req.session.userId })
          .sort({ createdAt: -1 });
      res.json(images);
  } catch (error) {
      console.error('Gallery fetch error:', error);
      res.status(500).json({ error: 'Error fetching gallery' });
  }
});
// Add this route
app.get('/settings', async (req, res) => {
  if (!req.session.userId) {
      return res.redirect('/signin');
  }
  
  try {
      const user = await User.findById(req.session.userId);
      if (!user) {
          return res.redirect('/signin');
      }
      
      res.render('settings', { 
          title: 'Account Settings',
          user: user 
      });
  } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).send('Error loading settings page');
  }
});
app.post('/delete-account', async (req, res) => {
  try {
      if (!req.session.userId) {
          return res.redirect('/signin');
      }

      // Find and delete the user
      await User.findByIdAndDelete(req.session.userId);

      // Destroy the session
      req.session.destroy((err) => {
          if (err) {
              console.error('Session destruction error:', err);
              return res.status(500).send('Error during account deletion');
          }
          res.redirect('/');
      });
  } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).send('Error deleting account');
  }
});
// 404 Page
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
