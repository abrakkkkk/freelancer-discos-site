const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('Freelancer Discos — Mockup Desktop (Editorial).html', 'utf8');
const tag = 'data:image/png;base64,';
const start = html.indexOf(tag) + tag.length;
const end = html.indexOf('"', start);
const b64 = html.substring(start, end);

const dir = 'site-loja/assets';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'logo.png'), Buffer.from(b64, 'base64'));
console.log('Logo saved successfully to site-loja/assets/logo.png');
