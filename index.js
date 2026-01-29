const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("✅ MongoDB Connected Successfully!"))
    .catch((err) => console.log("❌ DB Connection Error:", err.message));

const Group = mongoose.model('Group', { groupId: String, currentDay: { type: Number, default: 1 }, status: String });
const Content = mongoose.model('Content', { day: Number, text: String });

// --- WhatsApp Logic (Railway Dynamic Path) ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote'
        ],
        // Railway pe Chrome dhoondne ka sabse pakka tareeka
        executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable' || '/usr/bin/google-chrome'
    }
});

let currentQR = "";

client.on('qr', (qr) => { 
    currentQR = qr; 
    console.log("👉 New QR Generated. Scan on your Blogger Dashboard."); 
});

client.on('ready', () => { 
    currentQR = "CONNECTED"; 
    console.log("🚀 WhatsApp Client is Ready and Connected!"); 
});

client.on('disconnected', (reason) => {
    currentQR = "";
    console.log("⚠️ Client was logged out:", reason);
    setTimeout(() => client.initialize(), 5000); // Auto restart
});

// --- API Routes ---
app.get('/status', (req, res) => res.json({ qr: currentQR }));

app.get('/groups', async (req, res) => {
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup).map(g => ({ 
            name: g.name, 
            id: g.id._serialized 
        }));
        res.json(groups);
    } catch (e) { res.json([]); }
});

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
    console.log("⏰ Running Daily Sequence...");
    const groups = await Group.find({ status: 'active' });
    for (let g of groups) {
        if (g.currentDay <= 15) {
            const plan = await Content.findOne({ day: g.currentDay });
            if (plan) {
                try {
                    await client.sendMessage(g.groupId, plan.text);
                    g.currentDay++;
                    await g.save();
                } catch (err) { console.log(`❌ Error: ${err.message}`); }
            }
        }
    }
});

client.initialize().catch(err => console.log("❌ Init Error:", err.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`📡 Server heartbeat on port ${PORT}`));
