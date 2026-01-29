const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const cors = require('cors');
const qrcode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected!"));

const Group = mongoose.model('Group', { groupId: String, currentDay: { type: Number, default: 1 }, status: String });
const Content = mongoose.model('Content', { day: Number, text: String });

// --- WhatsApp Logic ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

let currentQR = "";
client.on('qr', (qr) => { currentQR = qr; });
client.on('ready', () => { currentQR = "CONNECTED"; });

// --- Blogger API Routes ---
app.get('/status', (req, res) => res.json({ qr: currentQR }));

app.post('/add-group', async (req, res) => {
    const { groupId } = req.body;
    await Group.findOneAndUpdate({ groupId }, { groupId, currentDay: 1, status: 'active' }, { upsert: true });
    res.json({ success: true });
});

app.post('/save-plan', async (req, res) => {
    const { day, text } = req.body;
    await Content.findOneAndUpdate({ day }, { day, text }, { upsert: true });
    res.json({ success: true });
});

// --- Automation Engine (Every Day at 10 AM) ---
cron.schedule('0 10 * * *', async () => {
    const groups = await Group.find({ status: 'active' });
    for (let g of groups) {
        if (g.currentDay <= 15) {
            const plan = await Content.findOne({ day: g.currentDay });
            if (plan) {
                await client.sendMessage(g.groupId, plan.text);
                g.currentDay++;
                await g.save();
            }
        }
    }
});

client.initialize();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
