const express = require('express');
const router = express.Router();
const Labour = require('../models/Labour');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');

// Middleware to check authentication (reused)
const checkAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

router.use(checkAuth);

// GET All Labours
router.get('/', async (req, res) => {
    try {
        const search = req.query.search || '';
        const query = search ? {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const labours = await Labour.find(query).sort({ name: 1 });
        res.render('labours/index', { labours, search });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

// GET New Labour Form
router.get('/new', (req, res) => {
    res.render('labours/new');
});

// POST Create Labour
router.post('/', async (req, res) => {
    try {
        await Labour.create(req.body);
        res.redirect('/labours');
    } catch (err) {
        console.error(err);
        res.render('labours/new', { error: 'Error creating labour' });
    }
});

// GET Edit Labour Form
router.get('/:id/edit', async (req, res) => {
    try {
        const labour = await Labour.findById(req.params.id);
        res.render('labours/edit', { labour });
    } catch (err) {
        res.redirect('/labours');
    }
});

// PUT Update Labour
router.put('/:id', async (req, res) => {
    try {
        await Labour.findByIdAndUpdate(req.params.id, req.body);
        res.redirect('/labours');
    } catch (err) {
        res.redirect('/labours');
    }
});

// DELETE Labour
router.delete('/:id', async (req, res) => {
    try {
        // Soft delete or hard delete? "Delete labour" in requirements.
        // Usually safer to set isActive: false if they have history.
        // But requirements say "Delete labour". I'll do hard delete but warn if history exists?
        // Or just hard delete for now as per simple CRUD.
        await Labour.findByIdAndDelete(req.params.id);
        res.redirect('/labours');
    } catch (err) {
        res.redirect('/labours');
    }
});

// GET Labour Profile / History
router.get('/:id', async (req, res) => {
    try {
        const labour = await Labour.findById(req.params.id);
        const payments = await Payment.find({ labourId: req.params.id }).sort({ weekStart: -1 });
        const attendanceHistory = await Attendance.find({ labourId: req.params.id }).sort({ weekStart: -1 });

        // Calculate totals
        const totalEarned = payments.reduce((sum, p) => sum + p.grossAmount, 0);
        const totalPaid = payments.reduce((sum, p) => sum + p.netPaid, 0);
        const totalAdvances = attendanceHistory.reduce((sum, a) => sum + a.advanceAmount, 0);

        // Pending calculation is tricky. If they have attendance but no payment record?
        // Logic: For every attendance week, check if paid. If not, it's pending.
        const pendingWeeks = attendanceHistory.filter(a => !a.isPaid);
        let pendingAmount = 0;
        pendingWeeks.forEach(a => {
            const totalDays = Object.values(a.days).reduce((acc, val) => acc + val, 0);
            const gross = totalDays * labour.dailyRate;
            pendingAmount += (gross - a.advanceAmount);
        });

        res.render('labours/show', {
            labour,
            payments,
            attendanceHistory,
            totalEarned,
            totalPaid,
            totalAdvances,
            pendingAmount
        });
    } catch (err) {
        console.error(err);
        res.redirect('/labours');
    }
});

module.exports = router;
