const express = require('express');
const router = express.Router();
const Labour = require('../models/Labour');
const Attendance = require('../models/Attendance');

// Helper
function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    mon.setHours(12, 0, 0, 0);
    return mon;
}

router.use((req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
});

router.get('/', (req, res) => {
    res.render('reports/index');
});

router.get('/weekly', async (req, res) => {
    const selectedDate = req.query.date ? new Date(req.query.date) : new Date();
    const weekStart = getMonday(selectedDate);

    // Get all attendances for this week
    const attendances = await Attendance.find({ weekStart: weekStart }).populate('labourId');

    // Calculate totals
    let siteTotalGross = 0;
    let siteTotalRec = 0; // Recovered
    let siteTotalNewAdv = 0; // New Adv
    let siteTotalNet = 0;

    const reportData = attendances.filter(att => att.labourId).map(att => {
        const totalDays = Object.values(att.days).reduce((a, b) => a + b, 0);
        const gross = totalDays * att.labourId.dailyRate;
        const net = gross - (att.recoveredAmount || 0); // Net Paid out

        siteTotalGross += gross;
        siteTotalRec += (att.recoveredAmount || 0);
        siteTotalNewAdv += (att.newAdvance || 0);
        siteTotalNet += net;

        return {
            name: att.labourId.name,
            rate: att.labourId.dailyRate,
            days: totalDays,
            gross,
            recovered: att.recoveredAmount || 0,
            newAdvance: att.newAdvance || 0,
            net,
            status: att.isPaid ? 'PAID' : 'Pending'
        };
    });

    res.render('reports/weekly', {
        weekStart,
        reportData,
        siteTotal: {
            gross: siteTotalGross,
            recovered: siteTotalRec,
            newAdvance: siteTotalNewAdv,
            net: siteTotalNet
        }
    });
});

router.get('/monthly', async (req, res) => {
    const monthStr = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const [year, month] = monthStr.split('-');

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    // Aggregate data using DB
    const attendances = await Attendance.find({
        weekStart: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('labourId');

    const labourMap = {};

    attendances.forEach(att => {
        if (!att.labourId) return; // Skip deleted labours

        if (!labourMap[att.labourId._id]) {
            labourMap[att.labourId._id] = {
                name: att.labourId.name,
                totalDays: 0,
                totalGross: 0,
                totalRecovered: 0,
                totalNewAdvance: 0,
                totalNet: 0
            };
        }

        const totalDays = Object.values(att.days).reduce((a, b) => a + b, 0);
        const gross = totalDays * att.labourId.dailyRate;
        const rec = att.recoveredAmount || 0;
        const newAdv = att.newAdvance || 0;

        labourMap[att.labourId._id].totalDays += totalDays;
        labourMap[att.labourId._id].totalGross += gross;
        labourMap[att.labourId._id].totalRecovered += rec;
        labourMap[att.labourId._id].totalNewAdvance += newAdv;
        labourMap[att.labourId._id].totalNet += (gross - rec);
    });

    const reportData = Object.values(labourMap);

    const siteTotal = reportData.reduce((acc, curr) => {
        acc.gross += curr.totalGross;
        acc.recovered += curr.totalRecovered;
        acc.newAdvance += curr.totalNewAdvance;
        acc.net += curr.totalNet;
        return acc;
    }, { gross: 0, recovered: 0, newAdvance: 0, net: 0 });

    res.render('reports/monthly', {
        monthStr,
        reportData,
        siteTotal
    });
});

module.exports = router;
