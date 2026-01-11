const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    labourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Labour', required: true },
    weekStart: { type: Date, required: true }, // Monday of the week
    days: {
        mon: { type: Number, default: 0 },
        tue: { type: Number, default: 0 },
        wed: { type: Number, default: 0 },
        thu: { type: Number, default: 0 },
        fri: { type: Number, default: 0 },
        sat: { type: Number, default: 0 },
        sun: { type: Number, default: 0 }
    },
    advanceAmount: { type: Number, default: 0 }, // Kept for backward compat (treated as "Recovered" now? or "Net Change"?)
    // Let's be explicit
    newAdvance: { type: Number, default: 0 }, // Given this week
    recoveredAmount: { type: Number, default: 0 }, // Deducted from salary
    isPaid: { type: Boolean, default: false }
});

// Compound index to ensure one record per labour per week
AttendanceSchema.index({ labourId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
