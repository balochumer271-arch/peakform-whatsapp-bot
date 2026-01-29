const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URL).then(() => console.log("DB Connected!"));

const Group = mongoose.model('Group', { groupId: String, currentDay: { type: Number, default: 1 }, status: String });
const Content = mongoose.model('Content', { day: Number, text: String });

// --- WhatsApp Logic (Railway Fixed) ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: '/usr/bin/google-chrome-stable' // Railway Chrome Path
    }
});

let currentQR = "";
client.on('qr', (qr) => { currentQR = qr; console.log("QR Generated!"); });
client.on('ready', () => { currentQR = "CONNECTED"; console.log("Bot Ready!"); });

// --- API Routes ---
app.get('/status', (req, res) => res.json({ qr: currentQR }));

app.get('/groups', async (req, res) => {
    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup).map(g => ({ name: g.name, id: g.id._serialized }));
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

client.initialize();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
