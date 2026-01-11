require('dotenv').config();
const mongoose = require('mongoose');
const Labour = require('./models/Labour');
const Attendance = require('./models/Attendance');
const Payment = require('./models/Payment');
const Admin = require('./models/Admin');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pc_lapms')
    .then(() => {
        console.log('MongoDB Connected');
        seedData();
    })
    .catch(err => console.error(err));

const labourNames = [
    "Ramesh Kumar", "Suresh Patel", "Dinesh Singh", "Mahesh Verma", "Rajesh Gupta",
    "Mukesh Yadav", "Ganesh Jha", "Rakesh Sharma", "Brijesh Mishra", "Hitesh Joshi"
];

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    mon.setHours(0, 0, 0, 0);
    return mon;
}

async function seedData() {
    try {
        console.log('Clearing old data...');
        await Labour.deleteMany({});
        await Attendance.deleteMany({});
        await Payment.deleteMany({});
        await Admin.deleteMany({});

        console.log('Creating Admin...');
        await Admin.create({ username: 'admin', password: 'admin' });

        console.log('Creating Labours...');
        const labours = [];
        for (const name of labourNames) {
            const labour = await Labour.create({
                name,
                phone: '9876543210',
                dailyRate: Math.floor(Math.random() * 300) + 400, // 400-700
                isActive: true
            });
            labours.push(labour);
        }

        console.log('Generating Attendance for last 4 weeks...');
        const today = new Date();
        const weeks = [0, 1, 2, 3].map(w => {
            const d = new Date(today);
            d.setDate(d.getDate() - (w * 7));
            return getMonday(d);
        });

        for (const weekStart of weeks) {
            for (const labour of labours) {
                // Random attendance
                const days = {};
                const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
                let totalDays = 0;

                dayKeys.forEach(k => {
                    const val = [0, 1, 1, 1, 1, 0.5, 0][Math.floor(Math.random() * 7)]; // Weighted random
                    days[k] = val;
                    totalDays += val;
                });

                const gross = totalDays * labour.dailyRate;
                const advance = Math.floor(Math.random() * 5) * 100; // 0, 100, 200...

                const isPaid = weekStart < getMonday(new Date()); // Pay past weeks

                await Attendance.create({
                    labourId: labour._id,
                    weekStart,
                    days,
                    advanceAmount: advance,
                    isPaid
                });

                if (isPaid) {
                    await Payment.create({
                        labourId: labour._id,
                        weekStart,
                        grossAmount: gross,
                        advance,
                        netPaid: gross - advance,
                        paidDate: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000) // Paid on Sunday
                    });
                }
            }
        }

        console.log('Seeding Complete!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
