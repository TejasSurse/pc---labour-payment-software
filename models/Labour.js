const mongoose = require('mongoose');

const LabourSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    dailyRate: { type: Number, required: true },
    advanceBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Labour', LabourSchema);
