// ============================================================
// 🐱 Shadow Miner - Cloudflare Worker
// ============================================================

const BOT_TOKEN = '69294199938617293895:AAG0w2IuLBMlCXeg-qO_ll3ufEEzPEkEcps';
const ADMIN_ID = '8194780197';

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // ===== بررسی KV =====
  let maintenanceMode = 'false';
  let maintenanceMessage = '🔧 مینی‌اپ در دست تعمیر است.';
  try {
    maintenanceMode = await KV.get('maintenance_mode') || 'false';
    maintenanceMessage = await KV.get('maintenance_message') || '🔧 مینی‌اپ در دست تعمیر است.';
  } catch (e) {}

  // ===== Webhook =====
  if (path === '/webhook') {
    try {
      const update = await request.json();
      await handleTelegramUpdate(update);
      return new Response('OK', { status: 200 });
    } catch (error) {
      return new Response('Error', { status: 500 });
    }
  }

  // ===== مینی‌اپ =====
  if (path === '/app' || path === '/') {
    if (maintenanceMode === 'true') {
      return new Response(getMaintenancePage(maintenanceMessage), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    return new Response(getMiniAppHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // ===== وضعیت =====
  if (path === '/status') {
    return new Response(JSON.stringify({
      status: 'online',
      admin: ADMIN_ID,
      maintenance: maintenanceMode === 'true'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Not Found', { status: 404 });
}

// ============================================================
//                پردازش آپدیت‌های تلگرام
// ============================================================
async function handleTelegramUpdate(update) {
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;
    const isAdmin = chatId.toString() === ADMIN_ID;

    if (text === '/start') {
      await sendTelegramMessage(chatId,
        `🐱 *Shadow Miner*\n\n` +
        `به بهترین ماینر تحت وب خوش اومدی!\n` +
        `🚀 برای شروع، روی دکمه زیر کلیک کن:`,
        {
          reply_markup: {
            inline_keyboard: [[
              { 
                text: '🚀 باز کردن مینی‌اپ', 
                web_app: { url: 'https://blue-hall-5ea6shadow-miner-app.xworld44-5400.workers.dev/app' } 
              }
            ]]
          },
          parse_mode: 'Markdown'
        }
      );
      return;
    }

    if (text === '/admin' && isAdmin) {
      await sendAdminPanel(chatId);
      return;
    }

    if (text.startsWith('/maintenance') && isAdmin) {
      const parts = text.split(' ');
      const action = parts[1] || 'status';
      
      if (action === 'on') {
        const message = parts.slice(2).join(' ') || '🔧 مینی‌اپ در دست تعمیر است.';
        await KV.put('maintenance_mode', 'true');
        await KV.put('maintenance_message', message);
        await sendTelegramMessage(chatId, '✅ حالت تعمیرات فعال شد.');
        return;
      }
      
      if (action === 'off') {
        await KV.put('maintenance_mode', 'false');
        await sendTelegramMessage(chatId, '✅ حالت تعمیرات غیرفعال شد.');
        return;
      }
      
      const mode = await KV.get('maintenance_mode') || 'false';
      const msg = await KV.get('maintenance_message') || '🔧 مینی‌اپ در دست تعمیر است.';
      await sendTelegramMessage(chatId, 
        `📊 *وضعیت تعمیرات*\n\n` +
        `🔧 وضعیت: ${mode === 'true' ? '🟡 فعال' : '🟢 غیرفعال'}\n` +
        `📝 پیام: ${msg}`
      );
      return;
    }

    if (text === '/stats' && isAdmin) {
      const userCount = await KV.get('stats:users') || '0';
      await sendTelegramMessage(chatId,
        `📊 *آمار Shadow Miner*\n\n👥 کاربران: ${userCount}`
      );
      return;
    }
  }
}

// ============================================================
//                ارسال پیام به تلگرام
// ============================================================
async function sendTelegramMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: extra.parse_mode || 'Markdown',
    ...extra
  };
  
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// ============================================================
//                پنل ادمین
// ============================================================
async function sendAdminPanel(chatId) {
  const mode = await KV.get('maintenance_mode') || 'false';
  const msg = await KV.get('maintenance_message') || '🔧 مینی‌اپ در دست تعمیر است.';
  const userCount = await KV.get('stats:users') || '0';
  
  await sendTelegramMessage(chatId,
    `🔐 *پنل مدیریت Shadow Miner*\n\n` +
    `👤 ادمین: ${ADMIN_ID}\n` +
    `🔧 وضعیت تعمیرات: ${mode === 'true' ? '🟡 فعال' : '🟢 غیرفعال'}\n` +
    `📝 پیام: ${msg}\n` +
    `👥 کاربران: ${userCount}\n\n` +
    `📋 *دستورات:*\n` +
    `/maintenance on [پیام] - فعال‌سازی\n` +
    `/maintenance off - غیرفعال‌سازی\n` +
    `/stats - آمار\n` +
    `/admin - این پنل`,
    { parse_mode: 'Markdown' }
  );
}

// ============================================================
//                صفحه تعمیرات
// ============================================================
function getMaintenancePage(message) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔧 در دست تعمیر</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #0a0a0a, #1a1a2e);
      color: white;
      font-family: -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .container { text-align: center; max-width: 400px; }
    .icon { font-size: 80px; margin-bottom: 20px; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .title { font-size: 24px; font-weight: 700; color: #ffd700; margin-bottom: 12px; }
    .message { color: #aaa; font-size: 16px; line-height: 1.6; }
    .time { color: #666; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔧</div>
    <div class="title">در دست تعمیر</div>
    <div class="message">${message}</div>
    <div class="time">⏱ لطفاً چند دقیقه دیگر مراجعه کنید</div>
  </div>
</body>
</html>
  `;
}

// ============================================================
//                مینی‌اپ
// ============================================================
function getMiniAppHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>🐱 Shadow Miner</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
    }
    .container {
      max-width: 420px;
      width: 100%;
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(20px);
      border-radius: 32px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      background: linear-gradient(45deg, #f7931a, #ffd700);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .balance {
      background: rgba(255,215,0,0.15);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      border: 1px solid rgba(255,215,0,0.3);
    }
    .tap-area {
      background: radial-gradient(circle at 50% 50%, #2a2a4a, #1a1a2e);
      border-radius: 50%;
      width: 200px;
      height: 200px;
      margin: 20px auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: transform 0.1s;
      border: 2px solid rgba(247,147,26,0.3);
      box-shadow: 0 0 40px rgba(247,147,26,0.1);
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .tap-area:active { transform: scale(0.92); }
    .tap-icon { font-size: 64px; margin-bottom: 8px; animation: float 3s ease-in-out infinite; }
    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
    .tap-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(45deg, #ffd700, #f7931a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tap-reward { font-size: 12px; color: #888; margin-top: 4px; }
    .shop-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 16px;
    }
    .shop-item {
      background: rgba(255,255,255,0.05);
      padding: 12px;
      border-radius: 12px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.05);
      cursor: pointer;
      transition: all 0.3s;
    }
    .shop-item:active { transform: scale(0.95); }
    .shop-item .emoji { font-size: 28px; }
    .shop-item .name { font-size: 12px; font-weight: 600; margin: 4px 0; }
    .shop-item .price { font-size: 11px; color: #ffd700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">🐱 Shadow</div>
      <div class="balance" id="balance">💰 0.00000000</div>
    </div>
    <div class="tap-area" id="tapArea">
      <div class="tap-icon">⛏️</div>
      <div class="tap-text" id="tapCount">0</div>
      <div class="tap-reward">هر تپ +۰.۰۰۰۰۰۱</div>
    </div>
    <div class="shop-grid">
      <div class="shop-item"><div class="emoji">🚀</div><div class="name">بوست x2</div><div class="price">۱۰۰ ارز</div></div>
      <div class="shop-item"><div class="emoji">🔥</div><div class="name">بوست x5</div><div class="price">۴۰۰ ارز</div></div>
      <div class="shop-item"><div class="emoji">🥇</div><div class="name">پکیج طلا</div><div class="price">۱۰۰۰ ارز</div></div>
      <div class="shop-item"><div class="emoji">💎</div><div class="name">پکیج الماس</div><div class="price">۲۵۰۰ ارز</div></div>
    </div>
  </div>
  <script>
    let tapCount = 0, balance = 0;
    document.getElementById('tapArea').addEventListener('click', function() {
      tapCount++;
      balance += 0.000001;
      document.getElementById('tapCount').textContent = tapCount;
      document.getElementById('balance').textContent = '💰 ' + balance.toFixed(8);
    });
  </script>
</body>
</html>
  `;
}

// ============================================================
//                اجرا
// ============================================================
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
