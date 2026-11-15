require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoose = require("mongoose");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { createHmac, createHash, randomUUID, timingSafeEqual } = require("node:crypto");

const app = express();
const projectRoot = __dirname;
const port = Number(process.env.PORT) || 3000;
const databaseName = process.env.MONGODB_DB || "dpm_km_unnes";
const topics = ["Fasilitas", "Kinerja", "Advokasi", "Lingkungan", "Lainnya"];
const adminCookieName = "dpm_admin_session";
const maxImageSize = 5 * 1024 * 1024;
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageSize, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return callback(new Error("Pilih gambar berformat JPG, PNG, atau WebP."));
    }
    return callback(null, true);
  },
});
const contentCollections = {
  homepage: "homepage_content",
  legislation: "legislation_content",
  archives: "archives_content",
  activities: "activities_content",
};

function isValidNewsDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https:", "blob:"],
        "frame-src": ["https://www.youtube-nocookie.com"],
        "connect-src": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
      },
    },
  }),
);
app.use(express.json({ limit: "2mb" }));

const newsSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      validate: { validator: isValidNewsDate, message: "Tanggal berita tidak valid." },
    },
    image: { type: String, trim: true, maxlength: 2048, default: "" },
    alt: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { collection: "news", versionKey: false },
);
newsSchema.index({ date: -1 });

const aspirationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    campus: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    topic: { type: String, required: true, enum: topics },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    consentAt: { type: Date, required: true },
  },
  { collection: "aspirations", timestamps: { createdAt: "submittedAt", updatedAt: false } },
);
aspirationSchema.index({ submittedAt: -1 });

const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    homepage: { type: mongoose.Schema.Types.Mixed, default: {} },
    legislation: { type: mongoose.Schema.Types.Mixed, default: {} },
    archives: { type: mongoose.Schema.Types.Mixed, default: {} },
    activities: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: "site_content", versionKey: false },
);

const adminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "admin_users", versionKey: false },
);

const News = mongoose.model("News", newsSchema);
const Aspiration = mongoose.model("Aspiration", aspirationSchema);
const SiteContent = mongoose.model("SiteContent", siteContentSchema);
const AdminUser = mongoose.model("AdminUser", adminUserSchema);

function readText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function adminAuthConfigured() {
  return Boolean(process.env.ADMIN_SESSION_SECRET?.length >= 32);
}

function constantTimeTextEqual(first, second) {
  const firstHash = createHash("sha256").update(String(first)).digest();
  const secondHash = createHash("sha256").update(String(second)).digest();
  return timingSafeEqual(firstHash, secondHash);
}

function createAdminToken(username) {
  const payload = Buffer.from(
    JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function getAdminSession(req) {
  if (!adminAuthConfigured()) return false;
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminCookieName}=`));
  if (!cookie) return false;

  const token = cookie.slice(adminCookieName.length + 1);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expectedSignature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  if (!constantTimeTextEqual(signature, expectedSignature)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      typeof session.sub === "string" &&
      Number.isInteger(session.exp) &&
      session.exp > Math.floor(Date.now() / 1000)
    ) ? session : false;
  } catch {
    return false;
  }
}

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return res.status(403).json({ error: "Permintaan admin harus berasal dari situs ini." });
  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.host !== req.get("host") || parsedOrigin.protocol !== `${req.protocol}:`) {
      return res.status(403).json({ error: "Asal permintaan tidak diizinkan." });
    }
  } catch {
    return res.status(403).json({ error: "Asal permintaan tidak valid." });
  }
  return next();
}

async function requireAdmin(req, res, next) {
  if (!adminAuthConfigured()) {
    return res.status(503).json({ error: "Login admin belum dikonfigurasi di environment server." });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const session = getAdminSession(req);
  if (!session) return res.status(401).json({ error: "Silakan login sebagai admin." });
  const adminUser = await AdminUser.findOne({ username: session.sub, active: true })
    .select("username")
    .lean();
  if (!adminUser) return res.status(401).json({ error: "Akun admin tidak aktif. Silakan login kembali." });
  req.adminUser = adminUser;
  return next();
}

async function bootstrapAdminUser() {
  await AdminUser.init();
  if (await AdminUser.exists({})) {
    console.info("Admin account collection is initialized.");
    return;
  }

  const username = readText(process.env.ADMIN_BOOTSTRAP_USERNAME, 80)?.toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || typeof password !== "string" || password.length < 12 || bcrypt.truncates(password)) {
    console.warn(
      "No admin accounts exist. Set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD (12 or more characters, at most 72 UTF-8 bytes) once to create the first account.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await AdminUser.create({ username, passwordHash });
    console.info(`Bootstrapped first admin account "${username}".`);
  } catch (error) {
    if (error.code !== 11000) throw error;
    if (!(await AdminUser.exists({}))) throw error;
    console.info("An admin account was created by another server instance.");
  }
}

function databaseUnavailable(res) {
  return res.status(503).json({ error: "Layanan basis data sedang tidak tersedia." });
}

function getImageType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

async function loadPageContent() {
  const [homepageRecord, legislationRecord, archivesRecord, activitiesRecord, legacyRecord] =
    await Promise.all([
      mongoose.connection.collection(contentCollections.homepage).findOne(
        { key: "main" },
        { projection: { _id: 0, content: 1 } },
      ),
      mongoose.connection.collection(contentCollections.legislation).findOne(
        { key: "main" },
        { projection: { _id: 0, content: 1 } },
      ),
      mongoose.connection.collection(contentCollections.archives).findOne(
        { key: "main" },
        { projection: { _id: 0, content: 1 } },
      ),
      mongoose.connection.collection(contentCollections.activities).findOne(
        { key: "main" },
        { projection: { _id: 0, content: 1 } },
      ),
      SiteContent.findOne({ key: "main" })
        .select("homepage legislation archives activities -_id")
        .lean(),
    ]);

  return {
    homepage: homepageRecord?.content ?? legacyRecord?.homepage ?? {},
    legislation: legislationRecord?.content ?? legacyRecord?.legislation ?? {},
    archives: archivesRecord?.content ?? legacyRecord?.archives ?? {},
    activities: activitiesRecord?.content ?? legacyRecord?.activities ?? {},
  };
}

app.get("/api/health", (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: "unavailable", database: "disconnected" });
  }
  return res.json({ status: "ok", database: "connected" });
});

app.get("/api/news", async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Layanan basis data sedang tidak tersedia." });
  }

  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 100;
  const records = await News.find().sort({ date: -1, _id: -1 }).limit(limit).lean();
  res.json({
    items: records.map((item) => ({
      id: item._id.toString(),
      category: "news",
      label: item.label,
      title: item.title,
      description: item.description,
      date: item.date,
      image: item.image || "",
      alt: item.alt || "",
    })),
  });
});

app.get("/api/content", async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return databaseUnavailable(res);
  }

  res.json(await loadPageContent());
});

app.get("/api/media/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: "Gambar tidak ditemukan." });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "site_media" });
  const fileId = new mongoose.Types.ObjectId(req.params.id);
  const file = await bucket.find({ _id: fileId }).next();
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.metadata?.contentType)) {
    return res.status(404).json({ error: "Gambar tidak ditemukan." });
  }

  res.set({
    "Content-Type": file.metadata.contentType,
    "Content-Length": String(file.length),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  const download = bucket.openDownloadStream(fileId);
  download.on("error", (error) => {
    console.error("Image stream failed:", error.message);
    if (!res.headersSent) res.status(404).json({ error: "Gambar tidak ditemukan." });
    else res.destroy(error);
  });
  return download.pipe(res);
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." },
});

app.post("/api/admin/login", adminLoginLimiter, requireSameOrigin, async (req, res) => {
  if (!adminAuthConfigured()) {
    return res.status(503).json({ error: "Login admin belum dikonfigurasi di environment server." });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const adminUser =
    username && username.length <= 80 && !bcrypt.truncates(password)
      ? await AdminUser.findOne({ username, active: true }).select("+passwordHash")
      : null;
  const validPassword = adminUser
    ? await bcrypt.compare(password, adminUser.passwordHash)
    : false;
  if (!validPassword) {
    return res.status(401).json({ error: "Nama pengguna atau kata sandi salah." });
  }

  res.cookie(adminCookieName, createAdminToken(adminUser.username), {
    httpOnly: true,
    secure: req.secure,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  });
  return res.json({ authenticated: true });
});

app.post("/api/admin/logout", requireSameOrigin, (req, res) => {
  res.clearCookie(adminCookieName, {
    httpOnly: true,
    secure: req.secure,
    sameSite: "strict",
    path: "/",
  });
  return res.json({ authenticated: false });
});

app.get("/api/admin/session", requireAdmin, (req, res) => {
  res.json({ authenticated: true, username: req.adminUser.username });
});

app.get("/api/admin/content", requireAdmin, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  res.json(await loadPageContent());
});

app.post(
  "/api/admin/media",
  requireAdmin,
  requireSameOrigin,
  uploadImage.single("image"),
  async (req, res) => {
    if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
    if (!req.file) return res.status(400).json({ error: "Pilih file gambar untuk diunggah." });
    const imageType = getImageType(req.file.buffer);
    if (!imageType || req.file.mimetype !== imageType.mimeType) {
      return res.status(400).json({ error: "Isi file bukan gambar JPG, PNG, atau WebP yang valid." });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "site_media",
    });
    const imageId = randomUUID();
    const upload = bucket.openUploadStream(`${imageId}.${imageType.extension}`, {
      metadata: { contentType: imageType.mimeType },
    });
    await new Promise((resolve, reject) => {
      upload.once("finish", resolve);
      upload.once("error", reject);
      upload.end(req.file.buffer);
    });
    return res.status(201).json({ url: `/api/media/${upload.id.toString()}` });
  },
);

app.put("/api/admin/content/:section", requireAdmin, requireSameOrigin, async (req, res) => {
  const collectionName = contentCollections[req.params.section];
  const content = req.body?.content;
  if (
    !collectionName ||
    !content ||
    typeof content !== "object" ||
    Array.isArray(content) ||
    Buffer.byteLength(JSON.stringify(content), "utf8") > 1_500_000
  ) {
    return res.status(400).json({ error: "Bagian atau format konten tidak valid." });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  await mongoose.connection.collection(collectionName).updateOne(
    { key: "main" },
    { $set: { content }, $setOnInsert: { key: "main" } },
    { upsert: true },
  );
  return res.json({ saved: true, section: req.params.section });
});

app.get("/api/admin/news", requireAdmin, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const items = await News.find().sort({ date: -1, _id: -1 }).limit(200).lean();
  return res.json({
    items: items.map((item) => ({
      id: item._id.toString(),
      label: item.label,
      title: item.title,
      description: item.description,
      date: item.date,
      image: item.image || "",
      alt: item.alt || "",
    })),
  });
});

app.post("/api/admin/news", requireAdmin, requireSameOrigin, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Format berita tidak valid." });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const item = await News.create({
    label: req.body.label,
    title: req.body.title,
    description: req.body.description,
    date: req.body.date,
    image: req.body.image,
    alt: req.body.alt,
  });
  return res.status(201).json({ id: item._id.toString() });
});

app.put("/api/admin/news/:id", requireAdmin, requireSameOrigin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "ID berita tidak valid." });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Format berita tidak valid." });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const item = await News.findByIdAndUpdate(
    req.params.id,
    {
      label: req.body.label,
      title: req.body.title,
      description: req.body.description,
      date: req.body.date,
      image: req.body.image,
      alt: req.body.alt,
    },
    {
      new: true,
      runValidators: true,
    },
  ).lean();
  if (!item) return res.status(404).json({ error: "Berita tidak ditemukan." });
  return res.json({ id: item._id.toString() });
});

app.delete("/api/admin/news/:id", requireAdmin, requireSameOrigin, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "ID berita tidak valid." });
  }
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  const item = await News.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ error: "Berita tidak ditemukan." });
  return res.json({ deleted: true });
});

const aspirationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Terlalu banyak kiriman. Silakan coba kembali nanti." },
});

app.post("/api/aspirations", aspirationLimiter, async (req, res) => {
  const fullName = readText(req.body?.fullName, 120);
  const campus = readText(req.body?.campus, 160);
  const email = readText(req.body?.email, 254);
  const topic = readText(req.body?.topic, 40);
  const message = readText(req.body?.message, 5000);
  const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (
    !fullName ||
    !campus ||
    !validEmail ||
    !topics.includes(topic) ||
    !message ||
    req.body?.consent !== true
  ) {
    return res.status(400).json({ error: "Periksa kembali data aspirasi Anda." });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Layanan basis data sedang tidak tersedia." });
  }

  const submission = await Aspiration.create({
    fullName,
    campus,
    email,
    topic,
    message,
    consentAt: new Date(),
  });
  res.status(201).json({ message: "Aspirasi berhasil dikirim.", id: submission._id.toString() });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Endpoint API tidak ditemukan." });
});

app.use((req, res, next) => {
  if (
    /^\/(?:server\.js|package(?:-lock)?\.json|render\.yaml|README\.md|\.env(?:\..*)?)$/i.test(
      req.path,
    ) ||
    req.path.startsWith("/node_modules/")
  ) {
    return res.sendStatus(404);
  }
  next();
});

app.use(express.static(projectRoot, { dotfiles: "deny", index: "index.html" }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error("Request failed:", error);
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Ukuran kiriman terlalu besar." });
  }
  if (error instanceof multer.MulterError) {
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Ukuran gambar maksimal 5 MB."
        : "File gambar tidak dapat diproses.",
    });
  }
  if (req.path === "/api/admin/media" && error.message === "Pilih gambar berformat JPG, PNG, atau WebP.") {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: "Data yang dikirim tidak valid." });
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "Layanan basis data sedang tidak tersedia." });
  }
  return res.status(500).json({ error: "Terjadi kesalahan server. Silakan coba lagi nanti." });
});

async function startServer() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI belum diatur. Isi environment variable sebelum menjalankan server.");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: databaseName,
    serverSelectionTimeoutMS: 10000,
  });
  console.info(`Connected to MongoDB database "${databaseName}".`);
  await bootstrapAdminUser();

  app.listen(port, () => {
    console.info(`Portal server listening on port ${port}.`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Backend startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = app;
