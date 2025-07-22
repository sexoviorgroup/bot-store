const TelegramBot = require("node-telegram-bot-api")
const { TokenBot, NamaBot, OwnerID, ImagePath, Okeconnect, ChannelLog, ChannelStore, CS, JamBackup } = require("./settings.js")
const path = require('path');
const bot = new TelegramBot(TokenBot, { polling: true })
const cron = require('node-cron');
const os = require('os');
const archiver = require("archiver")
const moments = require('moment');
require('moment/locale/id');
moments.locale('id');
const toMs = require("ms")
let QRCode = require("qrcode")
const moment = require("moment-timezone").tz("Asia/Jakarta")
const hariArray = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
const bulanArray = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
const fs = require("fs")
const fetch = require("node-fetch")
const md5 = require("md5")
const axios = require("axios")
let editstok = {}
let msgg = {}

function formatWIB(isoString) {
  const date = new Date(isoString)
  const options = {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric', // Menampilkan tahun (e.g., 2025)
  }
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  const formattedDate = new Intl.DateTimeFormat('id-ID', options).format(date)
  const formattedTime = new Intl.DateTimeFormat('id-ID', timeOptions).format(date)
  return `${formattedDate} ${formattedTime}`
}
const namaBulan = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];


function formatrupiah(nominal) {
  const nom = new Intl.NumberFormat("id", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(nominal)
  return nom
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

cron.schedule(`0 */${JamBackup} * * *`, async () => {
  const folderToBackup = path.resolve(__dirname);
  const zipFilePath = path.join(os.tmpdir(), `backup-${Date.now()}.zip`);
  try {
    await createZip(folderToBackup, zipFilePath);
    await bot.sendDocument(OwnerID, zipFilePath);
    await bot.sendMessage(OwnerID, '✅ This is the latest backup. ');
    fs.unlinkSync(zipFilePath);
  } catch (err) {
    console.error(err);
    bot.sendMessage(OwnerID, '❌ Failed to create/send backup.');
  }
})

let ITEMS_PER_PAGE = 4

async function sendPage(data, chatId, page, msgId = null, callbackId = null) {
  const sortedData = [...data].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
  let userData = []
  Object.keys(sortedData).forEach((f) => {
    if (sortedData[f].id === msg.from.id) userData.push(sortedData[f])
  })
  const totalPages = Math.ceil(userData.length / ITEMS_PER_PAGE);
  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const items = userData.slice(start, end);

  if (callbackId) bot.answerCallbackQuery(callbackId);
  let text = `📋 *RIWAYAT TRANSAKSI (${page+1}/${totalPages})*
=======================
`;
  text += items.map((item, idx) =>
    `┌─────────────
│ *${item.nama}*
│─────────────
│- Jumlah: *${item.jumlah}*
│- Harga: *${formatrupiah(item.harga)}*
│- Tanggal: *${formatWIB(item.tanggal)}*
└─────────────\n`).join("\n")
  const buttons = [];
  if (page > 0) buttons.push({ text: '⏪ Kembali', callback_data: `prev:${page}` });
  if (page < totalPages - 1) buttons.push({ text: 'Next ⏩', callback_data: `next:${page}` })

  const reply_markup = { inline_keyboard: [buttons, [{text: "🔙 Kembali", callback_data: "kembaliawal"}]] };

  if (msgId) {
    await bot.editMessageText(text, {
      parse_mode: "Markdown",
      chat_id: chatId,
      message_id: msgId,
      reply_markup
    }).catch(async (e) => {
      await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown", reply_markup });
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown", reply_markup })
  }
}

async function rekapBulanTahun(trx, bulan, tahun) {
  const filtered = trx.filter(t => {
    const d = new Date(t.tanggal)
    return d.getMonth() === bulan && d.getFullYear() === tahun;
  })
  if (filtered.length === 0) return { text: `📭 There is no transaction at ${namaBulan[bulan]} ${tahun}.` }
  let total = 0
  let teks = `📅 *REKAP ${namaBulan[bulan].toUpperCase()} ${tahun}*
=======================
`

/*for (let i = 0; i < filtered.length; i++) {
const t = filtered[i]
const m = moments(t.tanggal).locale('id')
let usn = await bot.getChat(t.id)
total += t.harga
teks += `*${i + 1}. ${t.nama.toUpperCase()}*\n`
teks += `⟩ Buyer: @${usn.username}\n`
teks += `⟩ Jumlah: ${t.jumlah}\n`
teks += `⟩ Harga: ${formatrupiah(t.harga)}\n`
teks += `⟩ Tanggal: ${m.format('DD-MM-YYYY HH.mm')}\n\n`
}*/
const hasil = await Promise.all(filtered.map(async (t, i) => {
 const m = moments(t.tanggal).locale('id')
 let usn = await bot.getChat(t.id)
 total += t.harga
 return `*${i + 1}. ${t.nama.toUpperCase()}*\n` +
`⟩ Buyer: @${usn.username}\n` +
`⟩ Jumlah: ${t.jumlah}\n` +
`⟩ Harga: ${formatrupiah(t.harga)}\n` +
`⟩ Tanggal: ${m.format('DD-MM-YYYY HH.mm')}\n\n`
}))
teks += hasil.join('')
  teks += `=======================\n💰 *Total: ${formatrupiah(total)}*`
  return { text: teks }
}

async function createZip(sourceFolder, outputFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', err => reject(err));

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: sourceFolder,
      ignore: ['node_modules/**', '.env', `backup-*.zip`]
    });
    archive.finalize();
  });
}

function generateTahunKeyboard(tahun) {
  const bulanButtons = namaBulan.map((bulan, index) => ({
    text: bulan, callback_data: `bulan_${index}_${tahun}`
  }))
  const rows = []
  for (let i = 0; i < bulanButtons.length; i += 3) {
    rows.push(bulanButtons.slice(i, i + 3));
  }

  rows.push([
    { text: '⏪ Prev Tahun', callback_data: `tahun_${tahun - 1}` },
    { text: '⏩ Next Tahun', callback_data: `tahun_${tahun + 1}` }
  ])
  return { inline_keyboard: rows }
}


const sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toCRC16(str) {
  function charCodeAt(str, i) {
    let get = str.substr(i, 1)
    return get.charCodeAt()
  }

  let crc = 0xFFFF;
  let strlen = str.length;
  for (let c = 0; c < strlen; c++) {
    crc ^= charCodeAt(str, c) << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  hex = crc & 0xFFFF;
  hex = hex.toString(16);
  hex = hex.toUpperCase();
  if (hex.length == 3) {
    hex = "0" + hex;
  }
  return hex;
}

async function qrisDinamis(nominal, path) {
  let qris = Okeconnect.QrString

  let qris2 = qris.slice(0, -4);
  let replaceQris = qris2.replace("010211", "010212");
  let pecahQris = replaceQris.split("5802ID");
  let uang = "54" + ("0" + nominal.length).slice(-2) + nominal + "5802ID";

  let output = pecahQris[0] + uang + pecahQris[1] + toCRC16(pecahQris[0] + uang + pecahQris[1])

  await QRCode.toFile(path, output, { margin: 2, scale: 10 })
  return path
}

function digit() {
  return Math.floor(Math.random() * 30)
}

const generateQR = async (text, path) => {
      try {
        converBase64ToImage(await QRCode.toDataURL(text), path)
      } catch (err) {
        console.error(err)
      }
    }

console.log("Bot is ready to go!")

const addSaldo = (userId, amount) => {
let position = null
let User = JSON.parse(fs.readFileSync("./Database/User.json"))
Object.keys(User).forEach((x) => {
if (User[x].id === userId) {
position = x
}
})
if (position !== null) {
User[position].saldo += amount
fs.writeFileSync('./Database/User.json', JSON.stringify(User, null, 3))
}
}

const minSaldo = (userId, amount) => {
let position = null
let User = JSON.parse(fs.readFileSync("./Database/User.json"))
Object.keys(User).forEach((x) => {
if (User[x].id === userId) {
position = x
}
})
if (position !== null) {
User[position].saldo -= amount
fs.writeFileSync('./Database/User.json', JSON.stringify(User, null, 3))
}
}

const cekSaldo = (userId) => {
let position = null
let User = JSON.parse(fs.readFileSync("./Database/User.json"))
Object.keys(User).forEach((x) => {
if (User[x].id === userId) {
position = x
}
})
if (position !== null) {
return User[position].saldo
} else {
return 0
}}

function isOwner(id) {
  let isown = false
  if (id.from.id === OwnerID) isown = true
  return isown
}

function sendMessage(id, msg) {
  bot.sendMessage(id, msg, {parse_mode: "Markdown"})
}

function isRegistered(id) {
      let regist = false
      let User = JSON.parse(fs.readFileSync("./Database/User.json"))
      Object.keys(User).forEach((user) => {
        if (User[user].id === id) rx*
/delproduk *(Delete a product)*
/addstok *(Add stock)
/editstok *(Edit product stock)*
/editnama *(Edit product name)*
/editkode *(Edit product code)*
/editharga *(Edit product pricing)
/editdeskripsi *(Edit product description)
/editsnk *(Chage terms n conditions of product)
/listuser *(User list)*
/deluser *(Delete user)*
/bc *(Send broadcast to users)*
/addvoucher *(Add bot voucher)*
/delvoucher *(Delete bot voucher)*
/rekap *(Monthly recap)*
/backup *(Backup bot file? 
=======================`, { parse_mode: "Markdown" })
})

bot.onText(/\/addproduk/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(11)
  let nama = text.split("|")[0]
  let kode = text.split("|")[1]
  let harga = text.split("|")[2]
  let deskripsi = text.split("|")[3]
  let snk = text.split("|")[4]
  if (!nama || !kode || !harga || !deskripsi || !snk) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/addproduk Nama|Kode|Harga|Deskripsi|S&K`)
if (isNaN(harga)) return await bot.sendMessage(msg.from.id, `⚠️ Harga harus berupa format angka!`)
if (Number(harga) < 0) return await bot.sendMessage(msg.from.id, `⚠️ Harga harus diatas angka 0!`)
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
let tr = null
if (Produk.length !== 0) {
Object.keys(Produk).forEach((g) => {
  if (Produk[g].nama.toLowerCase() === nama.toLowerCase() || Produk[g].kode.toLowerCase() === kode.toLowerCase()) tr = g
})
}
if (tr !== null) return await bot.sendMessage(msg.from.id, `⚠️ Nama/Kode produk tersebut sudah ada didalam database!`)
let dt = {
  nama: nama,
  kode: kode,
  harga: Number(harga),
  deskripsi: deskripsi,
  snk: snk,
  data: [],
  terjual: 0
}
Produk.push(dt)
fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
await bot.sendMessage(msg.from.id, `*ADD PRODUK*
=======================
Nama item: *${nama}*
Kode: *${kode}*
Harga: *${formatrupiah(Number(harga))}*
Deskripsi: *${deskripsi}*
Syarat n Ketentuan: *${snk}*
=======================`, { parse_mode: "Markdown" })
})

bot.onText(/\/delproduk/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️  403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(11)
  if (!text) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/delproduk Kode`)
let f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === text.toLowerCase()) f = g
})
if (f !== null) {
  Produk.splice(f, 1)
  fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
  await sendMessage(msg.from.id, `✅ Successfully deleted the product *${text}*`)
} else {
  await sendMessage(msg.from.id, `⚠️ Product code  *${text}* not found!.
}

bot.onText(/\/addstok/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️  403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(9)
  let kode = text.split("|")[0]
  let data = text.split("|")[1]
  if (!kode || !data) return await sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/addstok Kode|DataProduk

*Contoh:* /addstok Spo3b|Email1:pw1
Email2:Pw2
dst`)
f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === kode.toLowerCase()) f = g
})
if (f !== null) {
  for (let i of data.split(/[\n\r\s]+/)) {
    Produk[f].data.push(i)
    }
    fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
    await sendMessage(msg.from.id, `✅ Berhasil menambahkan produk. 
} else {
  await sendMessage(msg.from.id, `⚠️ Kode produk *${kode}* tidak ditemukan!`)
}
})

bot.onText(/\/editstok/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ Hanya bisa diakses oleh owner!`)
  let text = msg.text.slice(10)
  if (!text) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/editstok Kode`)
let f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === text.toLowerCase()) f = g
})
if (f !== null) {
  let dt = Produk[f].data
  if (dt.length === 0) return await sendMessage(msg.from.id, `⚠️ Produk sedang di restock, mohon kesediaannya untuk menunggu, !`)
  editstok[msg.from.id] = {
    status: true,
    kode: text
  }
  let txt = "*EDIT STOK*\n=======================\n`"
  Object.keys(dt).forEach((s) => {
    txt += `${dt[s]}\n`
  })
  txt += "`=======================\nSalin data diatas dan kirim kembali ke bot setelah kamu mengedit sesuai keperluanmu!"
  await bot.sendMessage(msg.from.id, txt, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
      [{text: "❌ Cancel", callback_data: "bataleditstok"}]
      ]
    }
  })
} else {
  await sendMessage(msg.from.id, `⚠️ Kode produk *${text}* tidak ditemukan!`)
}
})

bot.onText(/\/editnama/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(10)
  let kode = text.split("|")[0]
  let namabaru = text.split("|")[1]
  if (!kode || !namabaru) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/editnama Kode|NamaBaru`)
let f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === kode.toLowerCase()) f = g
})
if (f !== null) {
  let tx = `✅ Succesfully changed the item/product name *${Produk[f].nama}* into *${namabaru}*`
  Produk[f].nama = namabaru
  fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
  await sendMessage(msg.from.id, tx)
} else {
  await sendMessage(msg.from.id, `⚠️ Kode produk *${text}* tidak ditemukan!`)
}
})
bot.onText(/\/editkode/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(10)
  let kode = text.split("|")[0]
  let kodebaru = text.split("|")[1]
  if (!kode || !kodebaru) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/editkode Kode|KodeBaru`)
let f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === kode.toLowerCase()) f = g
})
if (f !== null) {
  let tx = `✅ Succesfully changed the item/product name *${Produk[f].nama}* into *${kodebaru}*`
  Produk[f].kode = kodebaru
  fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
  await sendMessage(msg.from.id, tx)
} else {
  await sendMessage(msg.from.id, `⚠️ Kode produk *${text}* tidak ditemukan!`)
}
})
bot.onText(/\/editharga/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(10)
  let text = msg.text.slice(11)
  let kode = text.split("|")[0]
  let hargabaru = text.split("|")[1]
  if (!kode || !hargabaru) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/editharga Kode|HargaBaru`)
if (isNaN(hargabaru)) return await bot.sendMessage(msg.from.id, `⚠️ Harga harus berupa angka!`)
if (Number(hargabaru) < 0) return await bot.sendMessage(msg.from.id, `⚠️ Harga harus diatas 0!`)
let f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === kode.toLowerCase()) f = g
})
if (f !== null) {
  let tx = `✅ Berhasil mengubah harga produk *${Produk[f].nama}* menjadi *${formatrupiah(Number(hargabaru))}*`
  Produk[f].harga = Number(hargabaru)
  fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
  await sendMessage(msg.from.id, tx)
} else {
  await sendMessage(msg.from.id, `⚠️ Kode produk *${text}* tidak ditemukan!`)
}
})
bot.onText(/\/editdeskripsi/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(10)
  let text = msg.text.slice(15)
  let kode = text.split("|")[0]
  let deskripsibaru = text.split("|")[1]
  if (!kode || !deskripsibaru) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/editdeskripsi Kode|Deskripsi`)
let f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === kode.toLowerCase()) f = g
})
if (f !== null) {
  let tx = `✅ Berhasil mengubah deskripsi produk *${Produk[f].nama}* menjadi *${deskripsibaru}*`
  Produk[f].deskripsi = deskripsibaru
  fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
  await sendMessage(msg.from.id, tx)
} else {
  await sendMessage(msg.from.id, `⚠️ Kode produk *${text}* tidak ditemukan!`)
}
})
bot.onText(/\/editsnk/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(10)
  let text = msg.text.slice(9)
  let kode = text.split("|")[0]
  let snkbaru = text.split("|")[1]
  if (!kode || !snkbaru) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/editsnk Kode|SnkBaru`)
let f = null
let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
Object.keys(Produk).forEach((g) => {
  if (Produk[g].kode.toLowerCase() === kode.toLowerCase()) f = g
})
if (f !== null) {
  let tx = `✅ Berhasil mengubah SnK produk *${Produk[f].nama}* menjadi *${snkbaru}*`
  Produk[f].snk = snkbaru
  fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
  await sendMessage(msg.from.id, tx)
} else {
  await sendMessage(msg.from.id, `⚠️ Kode produk *${text}* tidak ditemukan!`)
}
})

bot.onText(/\/listuser/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(10)
  let User = JSON.parse(fs.readFileSync("./Database/User.json"))
  let tx = `*LIST USER*\n=======================\n`
  let i = 1
  for (const key of Object.keys(User)) {
    const userId = User[key].id
    let usn = "Anonim"
    try {
      const chat = await bot.getChat(userId)
      usn = chat.username ? `@${chat.username}` : `${chat.first_name || "Anonim"}`
    } catch (err) {
      usn = "❌ Tidak Dikenal"
    }
    tx += `${i}. ${usn} -> \`${userId}\`\n`
    i++
  }
  tx += `=======================`
  await sendMessage(msg.from.id, tx, { parse_mode: "Markdown" })
})

bot.onText(/\/deluser/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(10)
  let text = msg.text.slice(9)
  if (!text) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/deluser ID`)
if (isNaN(text)) return await bot.sendMessage(msg.from.id, `⚠️ ID harus berupa angka`)
text = Number(text)
let User = JSON.parse(fs.readFileSync("./Database/User.json"))
let s = null
Object.keys(User).forEach((x) => {
  if (User[x].id === text) s = x
})
if (s !== null) {
  User.splice(s, 1)
  fs.writeFileSync("./Database/User.json", JSON.stringify(User, null, 3))
  await sendMessage(msg.from.id, `✅ Succesfully deleted user with ID *${text}*`)
} else {
  await bot.sendMessage(msg.from.id, `⚠️ User not found!`)
}
})

bot.onText(/\/bc/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  let text = msg.text.slice(4)
  if (!text) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/bc Pesan`)
let User = JSON.parse(fs.readFileSync("./Database/User.json"))
let i = 0
let g = await bot.sendMessage(msg.from.id, `⏳ Sending messages... (${i}/${User.length})`)
while (i < User.length) {
  await sendMessage(User[i].id, `📢 *BROADCAST*

${text}`)
i++
let ed = await bot.editMessageText(`⏳ Sending messages... (${i}/${User.length})`, {
  chat_id: g.chat.id,
  message_id: g.message_id
})
if (i === User.length) {
await bot.editMessageText(`Succesfully sending broadcast messages ✅`, {
  chat_id: ed.chat.id,
  message_id: ed.message_id
})
}
}
})

bot.onText(/\/getid/, async (msg) => {
  await sendMessage(msg.from.id, "ID Kamu: `" + msg.from.id + "`")
})

bot.onText(/\/delvoucher/, async (msg) => {
  let text = msg.text.slice(12)
  if (!text) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/delvoucher DISKON10K`)
let pos = null
    let Voucher = JSON.parse(fs.readFileSync(`./Database/Voucher.json`))
    Object.keys(Voucher).forEach((h) => {
      if (Voucher[h].kode.toLowerCase() === text.toLowerCase()) pos = h
    })
    if (pos === null) return await bot.sendMessage(msg.from.id, `⚠️ Voucher code not found!`)
    Voucher.splice(pos, 1)
    fs.writeFileSync(`./Database/Voucher.json`, JSON.stringify(Voucher, null, 3))
    await sendMessage(msg.from.id, `✅ Succesfully deleted voucher code *${text}*`)
})

bot.onText(/\/addvoucher/, async (msg) => {
  let text = msg.text.slice(12)
  let kode = text.split("|")[0]
  let produk = text.split("|")[1]
  let potongan = text.split("|")[2]
  let limit = text.split("|")[3]
  if (!kode || !produk || !potongan || !limit) return await bot.sendMessage(msg.from.id, `⚠️ Cara Penggunaan:
/addvoucher DISKON10K|spo3b|1000|5

Note: Jika produk lebih dari 1 gunakan koma, dan jika ingin memilih semua produk ketik all!`)
if (isNaN(potongan)) return await bot.sendMessage(msg.from.id, `⚠️ Potongan harga harus berupa angka!`)
if (Number(potongan) < 0) return await bot.sendMessage(msg.from.id, `⚠️ Potongan harga harus diatas 0!`)
if (isNaN(limit)) return await bot.sendMessage(msg.from.id, `⚠️ Limit harus diatas 0!`)
if (Number(limit) < 0) return await bot.sendMessage(msg.from.id, `⚠️ Limit harus diatas 0!`)
let pos = null
    let Voucher = JSON.parse(fs.readFileSync(`./Database/Voucher.json`))
    Object.keys(Voucher).forEach((h) => {
      if (Voucher[h].kode.toLowerCase() === kode.toLowerCase()) pos = h
    })
    if (pos !== null) return await bot.sendMessage(msg.from.id, `⚠️ Voucher already exists in database!`)
    let data = {
      kode: kode,
      produk: produk.split(","),
      potongan: Number(potongan),
      limit: Number(limit),
      user: []
    }
    Voucher.push(data)
    fs.writeFileSync(`./Database/Voucher.json`, JSON.stringify(Voucher, null, 3))
    await sendMessage(msg.from.id, `*ADD VOUCHER*
=======================
Kode: *${kode}*
Item Produk: *${produk}*
Potongan: *${formatrupiah(potongan)}*
Limit: *${limit}*
=======================`)
})

bot.onText(/\/backup/, async (msg) => {
  if (!isOwner(msg)) return await sendMessage(msg.from.id, `⚠️ 403 Forbidden: Only accessible by owner/admin!`)
  const folderToBackup = path.resolve(__dirname);
  const zipFilePath = path.join(os.tmpdir(), `backup-${Date.now()}.zip`);

  await bot.sendMessage(msg.from.id, '⏳ Creating backup database...');

  try {
    await createZip(folderToBackup, zipFilePath);
    await bot.sendDocument(msg.from.id, zipFilePath);
    await bot.sendMessage(msg.from.id, '✅ Backup sent succesfully!');
    fs.unlinkSync(zipFilePath);
  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.from.id, '❌ Failed to send/creating backup..');
  }
})

bot.onText(/\/start/, async (msg) => {
  let User = JSON.parse(fs.readFileSync("./Database/User.json"))
  let Trx = JSON.parse(fs.readFileSync("./Database/Trx.json"))
  let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
  if (!isRegistered(msg.from.id)) {
   let UserData = {
     id: msg.from.id,
     jumlahtransaksi: 0,
     pengeluaran: 0
   }
   User.push(UserData)
   fs.writeFileSync("./Database/User.json", JSON.stringify(User, null, 3))
 }
 let stokterjual = 0
 let stoktersedia = 0
 if (Trx.length !== 0) {
 Object.keys(Trx).forEach((g) => {
   stokterjual += Trx[g].jumlah
 })
 }
 if (Produk.length !== 0) {
 Object.keys(Produk).forEach((g) => {
   stoktersedia += Produk[g].data.length
 })
 }

const sorted = [...Produk].sort((a, b) => a.nama.localeCompare(b.nama))
    const buttons = sorted.map((item, index) => {
    return `${index+1}`
  })
const keyboard = [
  ["‹📦› Daftar Produk", "‹❓› Cara Order"],
]
const add = chunkArray(buttons, 8)
add.forEach(y => {
  keyboard.push(y)
})
keyboard.push(["‹📊› Stock", "‹📋› History Transaksi"])
keyboard.push(["‹📢› Channel Official", "‹📞› Contact Admin"])
 await bot.sendPhoto(msg.from.id, fs.readFileSync(ImagePath), { caption: `👋 Halo, *${msg.from.first_name}*!

Selama datang di *${NamaBot}*! Kini, beli akun tidak lagi harus memakan waktu yang lama, aku hadir dengan fitur auto payment & proses pemesanan dengan cepat! ⚡️
─ 👥 Total user: *${User.length} User*
─ 🛒 Total Transactions: *${Trx.length} Transaksi*
─ 🛍️ Available Stock: *${stoktersedia}*
─ 📦 Items Sold: *${stokterjual}*

Pilih tombol di bawah berikut ini...`,
  parse_mode: "Markdown",
  reply_markup: {
  keyboard: keyboard,
    resize_keyboard: true
}
})
fs.writeFileSync(`./Database/UserCache/cache_${msg.from.id}.json`, JSON.stringify(sorted, null, 3))
if (Produk.length === 0) return await bot.sendMessage(msg.from.id, `⚠️ Belum ada produk apapun!`)
const listText = sorted.map((item, index) => `*[${index + 1}] ${item.nama.toUpperCase()}*`).join('\n')
  await bot.sendMessage(msg.from.id, `*📦 LIST CATALOG*
=======================
${listText}
=======================
Silahkan pilih menu item dengan menekan tombol di keyboard-mu!`,{ parse_mode: "Markdown", reply_markup: {
  keyboard: keyboard,
  resize_keyboard: true
}
})
})

bot.onText(/\/rekap/, async (msg) => {
  const tahun = new Date().getFullYear()
  const keyboard = generateTahunKeyboard(tahun)
  await bot.sendMessage(msg.from.id, `📅 Pilih bulan untuk melihat rekap tahun ${tahun}:`, {
    reply_markup: keyboard
  })
})


bot.on("callback_query", async (query) => {
  let cmd = query.data
  try {
    if (cmd.startsWith('bulan_')) {
    const [_, bulan, tahun] = cmd.split('_')
    let Trx = JSON.parse(fs.readFileSync("./Database/Trx.json"))
    const { text } = await rekapBulanTahun(Trx, parseInt(bulan), parseInt(tahun));

    await bot.editMessageText(text, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Tahun', callback_data: `tahun_${tahun}` }]
        ]
      }
    })
   await bot.answerCallbackQuery(query.id)
  }
  
  if (cmd.startsWith('tahun_')) {
    const tahun = parseInt(cmd.split('_')[1])
    const keyboard = generateTahunKeyboard(tahun)

    await bot.editMessageText(`📅 Pilih bulan untuk melihat rekap tahun ${tahun}:`, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: keyboard
    })

   await bot.answerCallbackQuery(query.id)
  }
  
  if (cmd.startsWith("prev:") || cmd.startsWith("next:")) {
    let Trx = JSON.parse(fs.readFileSync("./Database/Trx.json"))
    let [action, pageStr] = cmd.split(":")
    let page = parseInt(pageStr)
    if (action === "next") page++
    if (action === "prev") page--
    await sendPage(Trx, query.message.chat.id, page, query.message.message_id, query.id)
  }

if (cmd === "lanjut") {
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    await bot.deleteMessage(query.message.chat.id, query.message.message_id)
    let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    const item = Produk.find(i => i.kode.toLowerCase() === Data.kode.toLowerCase())
    if (!item) return await sendMessage(query.from.id, `⚠️ Produk tidak ditemukan, harap ulangi pilih item!`)
    let txs = `*KONFIRMASI PESANAN*
=======================
Nama Item: *${item.nama}*
Harga: *${formatrupiah(item.harga)}*
Stok Tersedia: *${item.data.length}*
-----------------------
Jumlah Pesanan: *${Data.jumlah}*
Total Dibayar: *${formatrupiah(Data.jumlah*item.harga)}*
=======================
Tekan ✅ untuk konfirmasi pembayaran`
await bot.sendMessage(query.from.id, txs, {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{text: "-", callback_data: "min:1"}, {text: "+", callback_data: "plus:1"}],
      [
      {text: "+5", callback_data: "plus:5"},
      {text: "+10", callback_data: "plus:10"},
      {text: "+25", callback_data: "plus:25"},
      {text: "+50", callback_data: "plus:50"},
      ],
      [{text: "🔄 Reset", callback_data: "reset"}],
          [{text: "🔙 Kembali", callback_data: "kembaliawal"}, {text: "✅ Konfirmasi", callback_data: "konfirmasi"}]
      ]
  }
})
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}

if (cmd === "reset") {
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    if (Data.jumlah === 1) {
      return
    } else {
      Data.jumlah = 1
    fs.writeFileSync(`./Database/Trx/${query.from.id}.json`, JSON.stringify(Data, null, 2))
    Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
     let Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
     const item = Produk.find(i => i.kode.toLowerCase() === Data.kode.toLowerCase())
     if (!item) return await sendMessage(query.from.id, `⚠️ Produk tidak ditemukan, harap ulangi pilih produk!`)
    await bot.editMessageText(`*KONFIRMASI PESANAN*
=======================
Produk: *${item.nama}*
Harga: *${formatrupiah(item.harga)}*
Stok Tersedia: *${item.data.length}*
-----------------------
Jumlah Pesanan: *${Data.jumlah}*
Total Dibayar: *${formatrupiah(Data.jumlah*item.harga)}*
=======================
Tekan ✅ untuk konfirmasi pembayaran`, {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{text: "-", callback_data: "min:1"}, {text: "+", callback_data: "plus:1"}],
      [
      {text: "+5", callback_data: "plus:5"},
      {text: "+10", callback_data: "plus:10"},
      {text: "+25", callback_data: "plus:25"},
      {text: "+50", callback_data: "plus:50"},
      ],
      [{text: "🔄 Reset", callback_data: "reset"}],
          [{text: "🔙 Kembali", callback_data: "kembaliawal"}, {text: "✅ Konfirmasi", callback_data: "konfirmasi"}]
      ]
  },
  chat_id: query.message.chat.id,
  message_id: query.message.message_id
})
    }
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}

if (cmd === "konfirmasi") {
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    let Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
    let s = null
    Object.keys(Produk).forEach((d) => {
      if (Produk[d].kode.toLowerCase() === Data.kode.toLowerCase()) s = d
    })
    if (s !== null) {
      if (Produk[s].data.length < Data.jumlah) return await bot.answerCallbackQuery(query.id, { text: "⚠️ Stok produk tidak mencukupi", show_alert: true })
    await bot.deleteMessage(query.message.chat.id, query.message.message_id)
    await bot.sendMessage(query.from.id, `🎟 Jika kamu mempunyai kode voucher yang berlaku, klik tombol Punya, jika tidak klik Tidak.`, {
      reply_markup: {
        inline_keyboard: [
          [
            {text: "Tidak", callback_data: "bayar"},
            {text: "Punya", callback_data: "punya"}
          ]
        ]
      }
    })
    }
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}

if (cmd === "punya") {
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    Data.voucher_status = "waiting"
    fs.writeFileSync(`./Database/Trx/${query.from.id}.json`, JSON.stringify(Data, null, 2))
    await bot.deleteMessage(query.message.chat.id, query.message.message_id)
    let df = await bot.sendMessage(query.from.id, `Input kode voucher yang kamu punya!`, {
      reply_markup: {
        inline_keyboard: [
          [{text: "❌ Batal", callback_data: "batalvoucher"}]
        ]
      }
    })
    msgg[query.from.id] = df
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}

if (cmd === "batalvoucher") {
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    Data.voucher_status = ""
    fs.writeFileSync(`./Database/Trx/${query.from.id}.json`, JSON.stringify(Data, null, 2))
    await bot.deleteMessage(query.message.chat.id, query.message.message_id)
    await bot.sendMessage(query.from.id, `🎟 Jika kamu mempunyai kode voucher yang berlaku, silahkan klik tombol Punya, jika tidak klik Tidak.`, {
      reply_markup: {
        inline_keyboard: [
          [
            {text: "Tidak", callback_data: "bayar"},
            {text: "Punya", callback_data: "punya"}
          ]
        ]
      }
    })
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}

if (cmd.startsWith("min:")) {
  let jumlah = cmd.split("min:")[1]
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    let gs = Data.jumlah-Number(jumlah)
    if (gs < 1) {
     await bot.answerCallbackQuery(query.id, { text: "⚠️ Jumlah pesanan tidak boleh kurang dari 1", show_alert: true })
     return
   }
    Data.jumlah -= Number(jumlah)
    fs.writeFileSync(`./Database/Trx/${query.from.id}.json`, JSON.stringify(Data, null, 2))
     Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
     let Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
     const item = Produk.find(i => i.kode.toLowerCase() === Data.kode.toLowerCase())
     if (!item) return await sendMessage(query.from.id, `⚠️ Produk tidak ditemukan, harap ulangi pilih produk!`)
    await bot.editMessageText(`*KONFIRMASI PESANAN*
=======================
Produk: *${item.nama}*
Harga: *${formatrupiah(item.harga)}*
Stok Tersedia: *${item.data.length}*
-----------------------
Jumlah Pesanan: *${Data.jumlah}*
Total Dibayar: *${formatrupiah(Data.jumlah*item.harga)}*
=======================
Tekan ✅ untuk konfirmasi pembayaran anda`, {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{text: "-", callback_data: "min:1"}, {text: "+", callback_data: "plus:1"}],
      [
      {text: "+5", callback_data: "plus:5"},
      {text: "+10", callback_data: "plus:10"},
      {text: "+25", callback_data: "plus:25"},
      {text: "+50", callback_data: "plus:50"},
      ],
      [{text: "🔄 Reset", callback_data: "reset"}],
          [{text: "🔙 Kembali", callback_data: "kembaliawal"}, {text: "✅ Konfirmasi", callback_data: "konfirmasi"}]
      ]
  },
  chat_id: query.message.chat.id,
  message_id: query.message.message_id
})
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}
if (cmd.startsWith("plus:")) {
  let jumlah = cmd.split("plus:")[1]
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    let Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
     let item = Produk.find(i => i.kode.toLowerCase() === Data.kode.toLowerCase())
     if (!item) return await sendMessage(query.from.id, `⚠️ Produk tidak ditemukan, harap ulangi pilih produk!`)
     if (item.data.length < (Data.jumlah+Number(jumlah))) {
       await bot.answerCallbackQuery(query.id, { text: "⚠️ Stok produk tidak mencukupi", show_alert: true })
       return
     }
     Data.jumlah += Number(jumlah)
    fs.writeFileSync(`./Database/Trx/${query.from.id}.json`, JSON.stringify(Data, null, 2))
     Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
     Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
     item = Produk.find(i => i.kode.toLowerCase() === Data.kode.toLowerCase())
     
     await bot.editMessageText(`*KONFIRMASI PESANAN*
=======================
Produk: *${item.nama}*
Harga: *${formatrupiah(item.harga)}*
Stok Tersedia: *${item.data.length}*
-----------------------
Jumlah Pesanan: *${Data.jumlah}*
Total Dibayar: *${formatrupiah(Data.jumlah*item.harga)}*
=======================
Tekan ✅ untuk konfirmasi pembayaran anda`, {
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{text: "-", callback_data: "min:1"}, {text: "+", callback_data: "plus:1"}],
      [
      {text: "+5", callback_data: "plus:5"},
      {text: "+10", callback_data: "plus:10"},
      {text: "+25", callback_data: "plus:25"},
      {text: "+50", callback_data: "plus:50"},
      ],
      [{text: "🔄 Reset", callback_data: "reset"}],
          [{text: "🔙 Kembali", callback_data: "kembaliawal"}, {text: "✅ Konfirmasi", callback_data: "konfirmasi"}]
      ]
  },
  chat_id: query.message.chat.id,
  message_id: query.message.message_id
})
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}

if (cmd === "batalbeli") {
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    await bot.deleteMessage(query.message.chat.id, query.message.message_id)
    fs.unlinkSync(`./Database/Trx/${query.from.id}.json`)
    await sendMessage(query.from.id,`✅ Pesananmu berhasil dibatalkan.`)
  }
}

if (cmd === "bayar") {
  if (fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
    await bot.deleteMessage(query.message.chat.id, query.message.message_id)
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${query.from.id}.json`))
    let Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
    let np = null
    Object.keys(Produk).forEach((f) => {
      if (Produk[f].kode.toLowerCase() === Data.kode.toLowerCase()) np = f
    })
     if (np === null) return await sendMessage(query.from.id, `⚠️ Produk tidak ditemukan, harap ulangi pilih produk!`)
    let DataProduk = ""
    let harga = Data.jumlah*Produk[np].harga
    let Voucher = JSON.parse(fs.readFileSync(`./Database/Voucher.json`))
    let vcr = Voucher.find(v => v.kode === Data.voucher)
    if (vcr && !vcr.user.some(a => a === query.from.id) && vcr.limit > 0) {
      harga = harga-vcr.potongan
    }
     if (Data.jumlah > Produk[np].data.length) return await sendMessage(query.from.id, `⚠️ Stok produk tidak mencukupi!`)
    let fee = digit()
    let totalAmount = Number(harga) + Number(fee)
    let time = Date.now() + toMs("10m")
    let dd = await qrisDinamis(`${totalAmount}`, `./Database/QR/${query.from.id}.jpg`)
let txx = `💸 *PEMBAYARAN OTOMATIS*
=======================
Trx ID: *${Data.trxid}*
Produk: *${Produk[np].nama}*
Harga: *${formatrupiah(Produk[np].harga)}*
Jumlah Beli: *${Data.jumlah}*
Fee: *${formatrupiah(fee)}*
Total Harga: *${formatrupiah(totalAmount)}*
=======================
Scan QRIS diatas untuk lakukan pembayaran, Produk akan terkirim otomatis beberapa detik setelah kamu bayar!`
    let ff = await bot.sendPhoto(query.from.id, fs.readFileSync(dd), {
parse_mode: "Markdown",
caption: txx,
reply_markup: {
inline_keyboard: [
        [{text: "❌ Batal", callback_data: "batalbeli"}]
        ]
    }})
    let statusP = false
    while (!statusP && fs.existsSync(`./Database/Trx/${query.from.id}.json`)) {
      await sleep(10000)
      if (Date.now() >= time) {
        statusP = true
        await bot.deleteMessage(ff.chat.id, ff.message_id)
        await sendMessage(query.from.id, `Pesananmu telah expired, harap pesan kembali!`)
        fs.unlinkSync(`./Database/Trx/${query.from.id}.json`)
      }
      try {
        let response = await axios.get(`https://gateway.okeconnect.com/api/mutasi/qris/${Okeconnect.MerchantID}/${Okeconnect.Apikey}`)
        console.log(response.data)
        if (response.data && response.data.data[0] && response.data.data[0].amount && parseInt(response.data.data[0].amount) === parseInt(totalAmount)) {
          let result = response.data.data[0]
      statusP = true
      for (let i = 0; i < Number(Data.jumlah); i++) {
              DataProduk += Produk[np].data[0] + "\n"
              Produk[np].data.splice(0, 1)
            }
            Produk[np].terjual += Data.jumlah
            fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 3))
            let txfile = `<|==== SYARAT DAN KETENTUAN ====|>
${Produk[np].snk}

<|==== PRODUK ====|>
${DataProduk}

//Terimakasih telah percaya kepada ${NamaBot}. Kami harap layanan kami dapat membuat anda puas`
let txxx = "```txt\n<|==== SYARAT DAN KETENTUAN ====|>\n" + Produk[np].snk + "\n\n<|==== PRODUK ====|>\n" + DataProduk + "\n\n//Terimakasih telah percaya kepada "+ NamaBot + ". Kami harap layanan kami dapat membuat anda puas```"
let pathtxt = `./${query.from.id}-${Produk[np].kode}-${Data.jumlah}.txt`
fs.writeFileSync(pathtxt, txfile)
let tggl = new Date().toISOString()
      await bot.deleteMessage(ff.chat.id, ff.message_id)
      await bot.sendDocument(query.from.id, pathtxt, {
        parse_mode: "Markdown",
        caption: `✅ *PESANAN SELESAI*
=======================
Trx ID: *${Data.trxid}*
Produk: *${Produk[np].nama}*
Harga: *${formatrupiah(Produk[np].harga)}*
Jumlah Beli: *${Data.jumlah}*
Fee: *${formatrupiah(fee)}*
Total Harga: *${formatrupiah(totalAmount)}*
Tanggal: *${formatWIB(tggl)}*
=======================
Terimakasih telah membeli produk di *${NamaBot}*
${txxx}`
      })
      await bot.sendMessage(ChannelLog, `✅ *PESANAN SELESAI*
=======================
User: @${query.from.username}
Trx ID: *${Data.trxid}*
Produk: *${Produk[np].nama}*
Harga: *${formatrupiah(Produk[np].harga)}*
Jumlah Beli: *${Data.jumlah}*
Fee: *${formatrupiah(fee)}*
Total Harga: *${formatrupiah(totalAmount)}*
Tanggal: *${formatWIB(tggl)}*
=======================`, {
  parse_mode: "Markdown"
})
      let dttrx = {
        id: query.from.id,
        nama: Produk[np].nama,
        kode: Produk[np].kode,
        jumlah: Data.jumlah,
        harga: harga,
        tanggal: tggl
      }
      fs.unlinkSync(pathtxt)
      let Trx = JSON.parse(fs.readFileSync(`./Database/Trx.json`))
      Trx.push(dttrx)
      fs.writeFileSync(`./Database/Trx.json`, JSON.stringify(Trx, null, 3))
      let ds = null
      Object.keys(Voucher).forEach((fd) => {
        console.log(Voucher[fd].kode)
        console.log(Data.voucher)
        if (Voucher[fd].kode === Data.voucher) ds = fd
      })
      if (ds !== null) {
        Voucher[ds].limit -= 1
        Voucher[ds].user.push(query.from.id)
        fs.writeFileSync(`./Database/Voucher.json`, JSON.stringify(Voucher, null, 3))
      }
        }
      } catch (err) {
        console.log(err)
      }
    }
  } else {
    await sendMessage(query.from.id, `⚠️ Harap ulangi pilih produk!`)
  }
}

  
if (cmd === "bataleditstok") {
  await bot.deleteMessage(query.message.chat.id, query.message.message_id)
  editstok[query.from.id] = null
  await sendMessage(query.from.id, `✅ Edit stok dibatalkan!`)
}


  } catch (err) {
    console.log(err)
  }
})


bot.on('message',async (msg) => {
    let text = msg.text
    
    if (text === "‹📦› Daftar Produk") {
      let Produk = JSON.parse(fs.readFileSync("./Database/Produk.json"))
    if (Produk.length === 0) return await bot.sendMessage(msg.from.id, `⚠️ Belum ada produk apapun!`)
    const sorted = [...Produk].sort((a, b) => a.nama.localeCompare(b.nama))
    const buttons = sorted.map((item, index) => {
    return `${index+1}`
  })
  const keyboard = [
  ["‹📦› Daftar Produk", "‹❓› Cara Order"],
]
const add = chunkArray(buttons, 8)
add.forEach(y => {
  keyboard.push(y)
})
keyboard.push(["‹📊› Stok", "‹📋› Riwayat Transaksi"])
keyboard.push(["‹📢› Channel Official", "‹📞› Contact Admin"])
  const listText = sorted.map((item, index) => `*[${index + 1}] ${item.nama.toUpperCase()}*`).join('\n')
  await bot.sendMessage(msg.from.id, `*📦 LIST PRODUK*
=======================
${listText}
=======================
Silahkan pilih produk dengan menekan tombol di keyboard-mu!`,{ parse_mode: "Markdown", reply_markup: {
  keyboard: keyboard,
  resize_keyboard: true
}
})
fs.writeFileSync(`./Database/UserCache/cache_${msg.from.id}.json`, JSON.stringify(sorted, null, 3))
    }
    if (/^\d+$/.test(text.trim())) {
      const cachePath = `./Database/UserCache/cache_${msg.from.id}.json`
      if (!fs.existsSync(cachePath)) return await bot.sendMessage(msg.from.id, `⚠️ Produk belum dimuat, silahkan klik tombol Daftar Produk`)
      const Produk = JSON.parse(fs.readFileSync(cachePath))
      const index = parseInt(text.trim()) - 1
      if (index >= 0 && index < Produk.length) {
        const item = Produk[index]
        const Unique = require("crypto").randomBytes(6).toString("hex").toUpperCase()
      let data = {
        id: msg.from.id,
        kode: item.kode,
        jumlah: 1,
        trxid: Unique,
        voucher: "",
        voucher_status: ""
      }
      fs.writeFileSync(`./Database/Trx/${msg.from.id}.json`, JSON.stringify(data, null, 2))
      await bot.sendMessage(msg.from.id, `📦 *${item.nama}*
=======================
Harga: *${formatrupiah(item.harga)}*
Stok Tersedia: *${item.data.length}*
Stok Terjual: *${item.terjual}*
Deskripsi: *${item.deskripsi}*
=======================
Pilih opsi dibawah untuk melanjutkan.`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
      [{text: "➡️ Lanjut", callback_data: "lanjut"}],
      ]
        }
      })
      } else {
      await bot.sendMessage(msg.from.id, `❌ Nomor produk tidak valid`)
    }
    }
    
    if (text === "‹❓› Cara Order") {
      await bot.sendMessage(msg.from.id, `*❓ CARA ORDER*
=======================
*1. Klik tombol ‹📦› Daftar Produk*
*2. Klik nomor produk yang ingin kamu beli*
*3. Tentukan jumlah pembelian dan klik tombol bayar*
*4. Scan QRIS yang muncul dan lakukan pembayaran*
*5. Setelah melakukan pembayaran, produk akan terkirim otomatis dalam beberapa detik*
=======================
*🚀 Nikmati transaksi yang cepat, mudah, dan tanpa ribet!*`, {
  parse_mode: "Markdown"
})
    }
    
    if (text === "‹📊› Stok") {
      let Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
  let tx = `📦 *STOK PRODUK*
=======================
`
  Object.keys(Produk).forEach((f) => {
    let emoji = ""
    if (Produk[f].data.length === 0) {
      emoji = "❌"
    } else {
      emoji = "✅"
    }
    tx += `${emoji} *${Produk[f].nama.toUpperCase()} : ${Produk[f].data.length}*\n`
  })
  await sendMessage(msg.from.id, `${tx}=======================`)
    }
    
    if (text === "‹📢› Channel Official") {
      await sendMessage(msg.from.id, `Cek Toko Kami:
${ChannelStore}`)
    }
    if (text === "‹📞› Contact Admin ") {
      await sendMessage(msg.from.id, `Jika ada kendala, silahkan hubungi dibawah ini:
${CS}`)
    }
    
    if (text === "‹📋› Riwayat Transaksi") {
      let Trx = JSON.parse(fs.readFileSync("./Database/Trx.json"))
    if (Trx.length === 0) return await sendMessage(msg.from.id, `⚠️ Belum ada transaksi apapun!`)
    await sendPage(Trx, msg.from.id, 0)
    }
    
    if (editstok[msg.from.id] && editstok[msg.from.id].status) {
  let data = text.split(/[\n\r\s]+/)
  let Produk = JSON.parse(fs.readFileSync(`./Database/Produk.json`))
  let f = null
  Object.keys(Produk).forEach((g) => {
    if (Produk[g].kode.toLowerCase() === editstok[msg.from.id].kode.toLowerCase()) f = g
  })
  if (f !== null) {
    Produk[f].data = []
    Object.keys(data).forEach((s) => {
      Produk[f].data.push(data[s])
    })
    fs.writeFileSync(`./Database/Produk.json`, JSON.stringify(Produk, null, 2))
    await sendMessage(msg.from.id, `✅ Berhasil mengedit stok produk *${editstok[msg.from.id].kode}*`)
    editstok[msg.from.id] = null
  }
  }
  if (fs.existsSync(`./Database/Trx/${msg.from.id}.json`)) {
    let Data = JSON.parse(fs.readFileSync(`./Database/Trx/${msg.from.id}.json`))
    if (Data.voucher_status === "waiting") {
      let voucher = text
      Data.voucher_status = ""
      fs.writeFileSync(`./Database/Trx/${msg.from.id}.json`, JSON.stringify(Data, null, 2))
      let VC = JSON.parse(fs.readFileSync(`./Database/Voucher.json`))
        await bot.deleteMessage(msgg[msg.from.id].chat.id, msgg[msg.from.id].message_id)
      let vv = VC.find(d => d.kode === voucher)
      if (vv && vv.produk.some(gd => gd.toLowerCase() === Data.kode.toLowerCase()) || vv && vv.produk[0] === "all" && vv.limit > 0 && vv.user.some(us => us === msg.from.id)) {
        Data.voucher = voucher
        fs.writeFileSync(`./Database/Trx/${msg.from.id}.json`, JSON.stringify(Data, null, 2))
        await bot.sendMessage(msg.from.id, `✅ Kode yang kamu gunakan valid.
Silahkan klik ✅ Bayar untuk melakukan pembayaran`, {
  reply_markup: {
    inline_keyboard: [
      [
       { text: "✅ Bayar", callback_data: "bayar"}
        ]
      ]
  }
})
        } else {
        await bot.sendMessage(msg.from.id, `❌ Kode voucher salah!

Jika kamu mempunyai kode voucher yang berlaku, silahkan klik tombol Punya, jika tidak klik Tidak.`, {
      reply_markup: {
        inline_keyboard: [
          [
            {text: "Tidak", callback_data: "bayar"},
            {text: "Punya", callback_data: "punya"}
          ]
        ]
      }
    })
      }
    }
  }
    
})
