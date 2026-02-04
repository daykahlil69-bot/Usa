/**
 * Clean Telegram OCR Bot (Single-file)
 * - No commands
 * - Image => OCR
 * - ONLY USA numbers
 * - Output: ONE message, ONE code block (monospace), all numbers line-by-line
 * - Auto delete: incoming image + bot reply after 2 minutes
 */

// ===============================
// 👉 এখানে আপনার BOT TOKEN বসান
// ===============================
const BOT_TOKEN = "8024603369:AAEejlp0IdPNIYUiwrmmu9yUd7LemRjVHNM";
// ===============================

const { Telegraf } = require("telegraf");
const sharp = require("sharp");
const Tesseract = require("tesseract.js");

if (!BOT_TOKEN || BOT_TOKEN.includes("ENTER_YOUR_BOT_TOKEN")) process.exit(1);

const bot = new Telegraf(BOT_TOKEN);
const DELETE_AFTER_MS = 2 * 60 * 1000;

function autoDelete(ctx, messageId) {
  const chatId = ctx.chat?.id;
  if (!chatId || !messageId) return;
  setTimeout(() => {
    ctx.telegram.deleteMessage(chatId, messageId).catch(() => {});
  }, DELETE_AFTER_MS);
}

// ONE monospace block only
function oneCodeBlock(list) {
  // no extra text at all
  const body = (list && list.length) ? list.join("\n") : "";
  return "```\n" + body + "\n```";
}

function isValidUS10(d10) {
  if (!/^\d{10}$/.test(d10)) return false;
  if (!/[2-9]/.test(d10[0])) return false; // area code N
  if (!/[2-9]/.test(d10[3])) return false; // exchange N
  if (/^(\d)\1{9}$/.test(d10)) return false; // all same digits
  return true;
}

function extractUSNumbers(text) {
  if (!text) return [];
  const chunks = text.match(/(\+?\d[\d\s().-]{7,}\d)/g) || [];
  const out = [];

  for (const ch of chunks) {
    const digits = ch.replace(/[^\d]/g, "");

    if (digits.length === 10) {
      if (isValidUS10(digits)) out.push("+1" + digits);
    } else if (digits.length === 11 && digits.startsWith("1")) {
      const d10 = digits.slice(1);
      if (isValidUS10(d10)) out.push("+1" + d10);
    }
  }

  return [...new Set(out)];
}

async function downloadTelegramFile(ctx, fileId) {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error("download failed");
  return Buffer.from(await res.arrayBuffer());
}

async function ocrFromBuffer(buffer) {
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const width = meta.width || 900;

  const pre = await img
    .resize({ width: Math.min(width * 2, 2200), withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(180)
    .toBuffer();

  const { data } = await Tesseract.recognize(pre, "eng", {
    logger: () => {},
    tessedit_char_whitelist: "+0123456789",
    preserve_interword_spaces: "1"
  });

  return data?.text || "";
}

async function handleImage(ctx, fileId) {
  autoDelete(ctx, ctx.message?.message_id);

  try {
    const buf = await downloadTelegramFile(ctx, fileId);
    const text = await ocrFromBuffer(buf);
    const usNumbers = extractUSNumbers(text);

    const sent = await ctx.reply(oneCodeBlock(usNumbers), {
      parse_mode: "Markdown",
      disable_web_page_preview: true
    });

    autoDelete(ctx, sent?.message_id);
  } catch (_) {
    const sent = await ctx.reply("```\n\n```", { parse_mode: "Markdown" });
    autoDelete(ctx, sent?.message_id);
  }
}

bot.on("photo", async (ctx) => {
  const photos = ctx.message?.photo || [];
  const best = photos[photos.length - 1];
  if (!best?.file_id) return;
  await handleImage(ctx, best.file_id);
});

bot.on("document", async (ctx) => {
  const doc = ctx.message?.document;
  if (!doc) return;
  const mime = (doc.mime_type || "").toLowerCase();
  if (!mime.startsWith("image/")) return;
  await handleImage(ctx, doc.file_id);
});

bot.launch();
