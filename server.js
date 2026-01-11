require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pc_lapms')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error(err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Session Config
const store = MongoStore.create ? MongoStore.create({ mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pc_lapms' }) : MongoStore.default.create({ mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pc_lapms' });

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key_pc_lapms',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Global Variables for Views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/labours', require('./routes/labours'));
app.use('/attendance', require('./routes/attendance'));
app.use('/reports', require('./routes/reports'));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
