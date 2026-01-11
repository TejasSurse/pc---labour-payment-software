const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Labour = require('../models/Labour');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');

// Middleware to check authentication
const checkAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Login Route
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    // Simple admin check - in real app use DB and hash
    // For prototype/MVP, we can use a hardcoded admin or create one if not exists
    // Let's use the DB model
    try {
        let admin = await Admin.findOne({ username });
        if (!admin) {
            // For first run, create admin if not exists (Auto-setup)
            if (username === 'admin' && password === 'admin') {
                admin = new Admin({ username, password });
                await admin.save();
            } else {
                return res.render('login', { error: 'Invalid Credentials' });
            }
        }

        if (admin.password === password) {
            req.session.userId = admin._id;
            res.redirect('/dashboard');
        } else {
            res.render('login', { error: 'Invalid Credentials' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'Server Error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Dashboard
router.get('/dashboard', checkAuth, async (req, res) => {
    try {
        const labourCount = await Labour.countDocuments({ isActive: true });

        // Calculate totals for this week
        // We need to determine "this week" (Mon-Sun)
        const today = new Date();
        const day = today.getDay(); // 0 (Sun) - 6 (Sat)
        const diff = today.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(today.setDate(diff));
        monday.setHours(12, 0, 0, 0);

        const payments = await Payment.find({
            paidDate: { $gte: monday }
        });

        const totalPayout = payments.reduce((sum, p) => sum + p.netPaid, 0);

        // Count paid/unpaid this week
        const attendances = await Attendance.find({ weekStart: monday });
        const paidCount = attendances.filter(a => a.isPaid).length;
        const unpaidCount = attendances.filter(a => !a.isPaid).length;

        // Total advances this week (from attendance records)
        const totalAdvances = attendances.reduce((sum, a) => sum + (a.newAdvance || 0), 0);

        // Fetch Labours with highest Advance Balance
        const advancesList = await Labour.find({ advanceBalance: { $gt: 0 } })
            .sort({ advanceBalance: -1 })
            .limit(5);

        res.render('dashboard', {
            labourCount,
            totalPayout,
            totalAdvances,
            paidCount,
            unpaidCount,
            weekStart: monday,
            advancesList
        });
    } catch (err) {
        console.error(err);
        res.redirect('/login'); // Fallback
    }
});

router.get('/', (req, res) => {
    res.redirect('/dashboard');
});

module.exports = router;
