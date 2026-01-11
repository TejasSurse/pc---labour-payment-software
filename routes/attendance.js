const express = require('express');
const router = express.Router();
const Labour = require('../models/Labour');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');

// Helper to get Monday of the selected date's week
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const mon = new Date(d.setDate(diff));
    mon.setHours(12, 0, 0, 0); // Set to noon to avoid timezone shifts
    return mon;
}

function formatDate(d) {
    return d.toISOString().split('T')[0];
}

router.use((req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
});

router.get('/', async (req, res) => {
    try {
        let selectedDate = req.query.date ? new Date(req.query.date) : new Date();
        const weekStart = getMonday(selectedDate);
        const weekStartStr = formatDate(weekStart);

        const labours = await Labour.find({ isActive: true }).sort({ name: 1 });
        const attendances = await Attendance.find({ weekStart: weekStart });

        const attendanceMap = {};
        attendances.forEach(a => attendanceMap[a.labourId.toString()] = a);

        res.render('attendance/index', {
            weekStart,
            weekStartStr,
            labours,
            attendanceMap
        });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

// Save/Update Attendance
router.post('/', async (req, res) => {
    try {
        const { weekStart, attendance } = req.body;

        // Robust date parsing for 'YYYY-MM-DD' format
        let dateStr = weekStart;
        if (weekStart.includes('T')) {
            dateStr = weekStart.split('T')[0];
        }

        const weekDate = new Date(dateStr + 'T12:00:00');

        if (isNaN(weekDate.getTime())) {
            console.error('Invalid date in POST /:', weekStart);
            return res.redirect('/attendance');
        }

        for (const [labourId, data] of Object.entries(attendance)) {
            // Check if already paid
            const existing = await Attendance.findOne({ labourId, weekStart: weekDate });
            if (existing && existing.isPaid) {
                continue; // Skip paid records
            }

            const updateData = {
                labourId,
                weekStart: weekDate,
                days: {
                    mon: parseFloat(data.mon) || 0,
                    tue: parseFloat(data.tue) || 0,
                    wed: parseFloat(data.wed) || 0,
                    thu: parseFloat(data.thu) || 0,
                    fri: parseFloat(data.fri) || 0,
                    sat: parseFloat(data.sat) || 0,
                    sun: parseFloat(data.sun) || 0
                },
                newAdvance: parseFloat(data.newAdvance) || 0,
                recoveredAmount: parseFloat(data.recoveredAmount) || 0,
                // Legacy support just in case, or for simple gross calc
                advanceAmount: parseFloat(data.recoveredAmount) || 0
            };

            await Attendance.findOneAndUpdate(
                { labourId, weekStart: weekDate },
                updateData,
                { upsert: true, new: true }
            );
        }
        res.redirect(`/attendance?date=${dateStr}`);
    } catch (err) {
        console.error(err);
        res.redirect('/attendance');
    }
});

// Mark as Paid
// Atomic Save and Pay (Fixes "Zero Payment" bug)
router.post('/save-and-pay', async (req, res) => {
    try {
        const { weekStart, labourId, days, newAdvance, recoveredAmount } = req.body;

        // Consistent Date (Noon)
        const weekDate = new Date(weekStart);
        weekDate.setHours(12, 0, 0, 0);

        // 1. Force Save/Update Attendance First
        const updateData = {
            labourId,
            weekStart: weekDate,
            days: {
                mon: parseFloat(days.mon) || 0,
                tue: parseFloat(days.tue) || 0,
                wed: parseFloat(days.wed) || 0,
                thu: parseFloat(days.thu) || 0,
                fri: parseFloat(days.fri) || 0,
                sat: parseFloat(days.sat) || 0,
                sun: parseFloat(days.sun) || 0
            },
            newAdvance: parseFloat(newAdvance) || 0,
            recoveredAmount: parseFloat(recoveredAmount) || 0,
            isPaid: true // Mark as Paid immediately
        };

        const att = await Attendance.findOneAndUpdate(
            { labourId, weekStart: weekDate },
            updateData,
            { upsert: true, new: true }
        ).populate('labourId');

        // 2. Process Payment Record
        const totalDays = Object.values(att.days).reduce((a, b) => a + b, 0);
        const gross = totalDays * att.labourId.dailyRate;
        const newAdv = att.newAdvance || 0;
        const recovered = att.recoveredAmount || 0;
        const net = gross - recovered;

        // Check if payment already exists
        const existingPay = await Payment.findOne({ labourId, weekStart: weekDate });
        if (!existingPay) {
            // Update Labour Balance
            const labour = await Labour.findById(labourId);
            const oldBalance = labour.advanceBalance || 0;
            const newBalance = oldBalance + newAdv - recovered;

            labour.advanceBalance = newBalance;
            await labour.save();

            await Payment.create({
                labourId: labourId,
                weekStart: weekDate,
                grossAmount: gross,
                advance: recovered,
                newAdvance: newAdv,
                netPaid: net,
                balanceAfter: newBalance
            });
        }

        const dateStr = weekStart.split('T')[0];
        res.redirect(`/attendance?date=${dateStr}`);

    } catch (err) {
        console.error("SAVE-PAY ERROR:", err);
        res.redirect('/attendance');
    }
});

// Simple Pay - Uses existing saved data from DB
router.post('/simple-pay', async (req, res) => {
    console.log('=== SIMPLE-PAY ROUTE HIT ===');
    console.log('Request body:', req.body);
    try {
        const { weekStart, labourId } = req.body;
        console.log('weekStart:', weekStart);
        console.log('labourId:', labourId);

        // Robust date parsing for 'YYYY-MM-DD' format
        let dateStr = weekStart;
        if (weekStart.includes('T')) {
            dateStr = weekStart.split('T')[0];
        }

        const weekDate = new Date(dateStr + 'T12:00:00');

        if (isNaN(weekDate.getTime())) {
            console.error('Invalid date in simple-pay:', weekStart);
            return res.redirect('/attendance');
        }

        // Find the attendance record (must exist and be saved already)
        let att = await Attendance.findOne({ labourId, weekStart: weekDate }).populate('labourId');

        if (!att) {
            // Create empty record if doesn't exist
            att = new Attendance({
                labourId,
                weekStart: weekDate,
                days: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
                newAdvance: 0,
                recoveredAmount: 0,
                isPaid: false
            });
            await att.save();
            await att.populate('labourId');
        }

        if (att.isPaid) {
            // Already paid, just redirect
            const dateStr = weekStart.split('T')[0];
            return res.redirect(`/attendance?date=${dateStr}`);
        }

        // Calculate payment
        const totalDays = Object.values(att.days).reduce((a, b) => a + b, 0);
        const gross = totalDays * att.labourId.dailyRate;
        const newAdv = att.newAdvance || 0;
        const recovered = att.recoveredAmount || 0;
        const net = gross - recovered;

        // Check for existing payment
        const existingPay = await Payment.findOne({ labourId, weekStart: weekDate });
        if (!existingPay) {
            // Update Labour Balance
            const labour = await Labour.findById(labourId);
            const oldBalance = labour.advanceBalance || 0;
            const newBalance = oldBalance + newAdv - recovered;

            labour.advanceBalance = newBalance;
            await labour.save();

            await Payment.create({
                labourId,
                weekStart: weekDate,
                grossAmount: gross,
                advance: recovered,
                newAdvance: newAdv,
                netPaid: net,
                balanceAfter: newBalance
            });
        }

        // Mark as paid
        att.isPaid = true;
        await att.save();

        res.redirect(`/attendance?date=${dateStr}`);

    } catch (err) {
        console.error("SIMPLE-PAY ERROR:", err);
        res.redirect('/attendance');
    }
});

module.exports = router;
