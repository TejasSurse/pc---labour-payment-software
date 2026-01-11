require('dotenv').config();
const mongoose = require('mongoose');
const Labour = require('./models/Labour');
const Attendance = require('./models/Attendance');
const Payment = require('./models/Payment');
const Admin = require('./models/Admin');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pc_lapms')
    .then(async () => {
        console.log('Resetting Database...');
        await Labour.deleteMany({});
        await Attendance.deleteMany({});
        await Payment.deleteMany({});
        // Re-create Admin
        await Admin.deleteMany({});
        await Admin.create({ username: 'admin', password: 'admin' });

        console.log('Database Cleaned. Admin restored.');
        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
