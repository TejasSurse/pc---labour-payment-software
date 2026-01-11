const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    labourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Labour', required: true },
    weekStart: { type: Date, required: true },
    grossAmount: { type: Number, required: true },
    advance: { type: Number, default: 0 }, // Recovered
    newAdvance: { type: Number, default: 0 }, // Given
    netPaid: { type: Number, required: true },
    balanceAfter: { type: Number, default: 0 }, // Snapshot of debt
    paidDate: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', PaymentSchema);
