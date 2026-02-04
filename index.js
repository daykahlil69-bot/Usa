const { Telegraf } = require('telegraf');
const fs = require('fs');
const https = require('https');

const TOKEN = process.env.BOT_TOKEN || '8024603369:AAHo2ddc0l6_F9XJiNEJ-MCSuF-oAgZbEMk';
const bot = new Telegraf(TOKEN);

console.log('🤖 বট চালু...');

// নাম্বার লিস্ট (আপনার দেওয়া নাম্বার)
const phoneNumbers = [
  '+16025367528',
  '+16025367735',
  '+16025360548',
  '+16025800554',
  '+16025803505',
  '+16026362735',
  '+16026138017',
  '+16027550850'
];

// ছবি ডাউনলোড (শুধু ফর্মালিটির জন্য)
async function downloadPhoto(fileId) {
  return new Promise((resolve, reject) => {
    bot.telegram.getFile(fileId).then(file => {
      const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
      const fileName = `temp_${Date.now()}.jpg`;
      
      const fileStream = fs.createWriteStream(fileName);
      https.get(url, (response) => {
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          // ফাইল ডিলিট
          setTimeout(() => {
            if (fs.existsSync(fileName)) {
              fs.unlinkSync(fileName);
            }
          }, 1000);
          resolve(true);
        });
      }).on('error', () => resolve(false));
    }).catch(() => resolve(false));
  });
}

// ফটো মেসেজ হ্যান্ডলার
bot.on('photo', async (ctx) => {
  try {
    const originalMsgId = ctx.message.message_id;
    
    // ছবি ডাউনলোড (লগের জন্য)
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      await downloadPhoto(photo.file_id);
    } catch (e) {
      // ignore
    }
    
    // শুধু নাম্বার (লাইন বাই লাইন)
    const phoneText = phoneNumbers.join('\n');
    
    // শুধু কপি বাটন
    const keyboard = {
      inline_keyboard: [[
        {
          text: "📋",
          callback_data: "copy_all"
        }
      ]]
    };
    
    // শুধু নাম্বার পাঠানো (কোনো লেখা নেই)
    const sentMsg = await ctx.reply(phoneText, {
      reply_markup: keyboard
    });
    
    // ২ মিনিট পর ডিলিট
    setTimeout(async () => {
      try {
        await ctx.deleteMessage(originalMsgId);
        await ctx.deleteMessage(sentMsg.message_id);
      } catch (e) {}
    }, 120000);
    
  } catch (err) {
    // কোনো error মেসেজ না দেখানো
  }
});

// কপি বাটন হ্যান্ডলার (কোনো notification না দেখানো)
bot.on('callback_query', async (ctx) => {
  try {
    // শুধু callback answer, কোনো popup না
    await ctx.answerCbQuery();
  } catch (e) {
    // ignore
  }
});

// টেক্সটে নাম্বার থাকলে
bot.on('text', async (ctx) => {
  try {
    const text = ctx.message.text;
    const originalMsgId = ctx.message.message_id;
    
    // যদি টেক্সটে নাম্বার থাকে
    const numberRegex = /(\+?\d{10,15})/g;
    const matches = text.match(numberRegex);
    
    if (matches && matches.length > 0) {
      const uniqueNumbers = [...new Set(matches.map(num => {
        let digits = num.replace(/\D/g, '');
        if (digits.length === 10) return '+1' + digits;
        if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
        if (!digits.startsWith('+')) return '+' + digits;
        return num;
      }))];
      
      const phoneText = uniqueNumbers.join('\n');
      
      const keyboard = {
        inline_keyboard: [[
          {
            text: "📋",
            callback_data: "copy_text"
          }
        ]]
      };
      
      const sentMsg = await ctx.reply(phoneText, { reply_markup: keyboard });
      
      setTimeout(async () => {
        try {
          await ctx.deleteMessage(originalMsgId);
          await ctx.deleteMessage(sentMsg.message_id);
        } catch (e) {}
      }, 120000);
    }
  } catch (e) {
    // ignore
  }
});

// কোনো স্টার্ট/হেল্প কমান্ড নাই
// কোনো রেসপন্স নাই

// বট চালু
bot.launch()
  .then(() => {
    console.log('✅ বট চালু হয়েছে');
  })
  .catch(err => {
    console.error('❌ Error:', err);
  });

// Railway এর জন্য পোর্ট
const PORT = process.env.PORT || 3000;
require('http').createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot');
}).listen(PORT);

// শাটডাউন
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
