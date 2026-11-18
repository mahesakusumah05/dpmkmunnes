const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const keyLength = 64;
const saltLength = 16;
const scryptOptions = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const hashPattern = /^scrypt\$16384\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
const dummySalt = Buffer.alloc(saltLength);
const dummyHash = Buffer.alloc(keyLength);

async function derivePasswordKey(password, salt) {
  return Buffer.from(await scrypt(password, salt, keyLength, scryptOptions));
}

async function hashPassword(password) {
  if (typeof password !== "string") throw new TypeError("Kata sandi harus berupa teks.");
  const salt = crypto.randomBytes(saltLength);
  const key = await derivePasswordKey(password, salt);
  return `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password, encodedHash) {
  if (typeof password !== "string") return false;
  const match = typeof encodedHash === "string" ? hashPattern.exec(encodedHash) : null;
  const salt = match ? Buffer.from(match[1], "hex") : dummySalt;
  const expectedKey = match ? Buffer.from(match[2], "hex") : dummyHash;
  const actualKey = await derivePasswordKey(password, salt);
  return crypto.timingSafeEqual(actualKey, expectedKey) && Boolean(match);
}

module.exports = { hashPassword, verifyPassword };
