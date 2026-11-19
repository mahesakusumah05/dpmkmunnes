require("dotenv").config();

const crypto = require("node:crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoose = require("mongoose");
const { verifyPassword } = require("./admin-auth");
const { createAspirationTransporter, sendAspirationEmails } = require("./aspiration-email");

const app = express();
const projectRoot = __dirname;
const port = Number(process.env.PORT) || 3000;
const databaseName = process.env.MONGODB_DB || "dpm_km_unnes";
const topics = ["Fasilitas", "Kinerja", "Advokasi", "Lingkungan", "Lainnya"];
const contentCollections = {
  homepage: "homepage_content",
  legislation: "legislation_content",
  archives: "archives_content",
  activities: "activities_content",
  organization: "organization_content",
};
const adminCookieName = "dpm_admin_session";
const adminSessionDurationMs = 8 * 60 * 60 * 1000;

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
    organization: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: "site_content", versionKey: false },
);

const News = mongoose.model("News", newsSchema);
const Aspiration = mongoose.model("Aspiration", aspirationSchema);
const SiteContent = mongoose.model("SiteContent", siteContentSchema);

function readText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function fixedTimeEqual(left, right) {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function readAdminSessionToken(req) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${adminCookieName}=`));
  const token = cookie?.slice(adminCookieName.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
}

function setAdminSessionCookie(req, res, token) {
  res.cookie(adminCookieName, token, {
    httpOnly: true,
    secure: req.secure || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: adminSessionDurationMs,
  });
}

function clearAdminSessionCookie(req, res) {
  res.clearCookie(adminCookieName, {
    httpOnly: true,
    secure: req.secure || process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

function requireSameOrigin(req, res, next) {
  const origin = req.get("origin");
  const expectedOrigin = `${req.protocol}://${req.get("host")}`;
  if (!origin || !fixedTimeEqual(origin, expectedOrigin)) {
    return res.status(403).json({ error: "Permintaan lintas situs tidak diizinkan." });
  }
  next();
}

async function requireAdmin(req, res, next) {
  const token = readAdminSessionToken(req);
  if (!token) return res.status(401).json({ error: "Silakan masuk untuk melanjutkan." });

  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const session = await mongoose.connection.collection("admin_sessions").findOne({
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    clearAdminSessionCookie(req, res);
    return res.status(401).json({ error: "Sesi admin tidak valid atau sudah berakhir." });
  }

  const adminUser = session.userId
    ? await mongoose.connection.collection("users").findOne(
        { _id: session.userId, role: "admin", isActive: { $ne: false } },
        { projection: { username: 1 } },
      )
    : null;
  if (!adminUser) {
    await mongoose.connection.collection("admin_sessions").deleteOne({ _id: session._id });
    clearAdminSessionCookie(req, res);
    return res.status(401).json({ error: "Akun admin tidak aktif atau tidak ditemukan." });
  }

  res.set("Cache-Control", "no-store");
  res.locals.adminSession = session;
  res.locals.adminUser = adminUser;
  next();
}

function requireAdminCsrf(req, res, next) {
  const token = req.get("x-csrf-token");
  if (
    !token ||
    typeof res.locals.adminSession?.csrfToken !== "string" ||
    !fixedTimeEqual(token, res.locals.adminSession.csrfToken)
  ) {
    return res.status(403).json({ error: "Token keamanan tidak valid. Muat ulang dashboard." });
  }
  next();
}

function isSafeImageUrl(value) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateNewsInput(body) {
  const label = readText(body?.label, 100);
  const title = readText(body?.title, 200);
  const description = readText(body?.description, 1000);
  const date = readText(body?.date, 10);
  const image = body?.image === undefined ? "" : body.image;
  const alt = body?.alt === undefined ? "" : body.alt;

  if (
    !label ||
    !title ||
    !description ||
    !date ||
    !isValidNewsDate(date) ||
    typeof image !== "string" ||
    image.length > 2048 ||
    typeof alt !== "string" ||
    alt.length > 300 ||
    !isSafeImageUrl(image)
  ) {
    return null;
  }
  return { label, title, description, date, image: image.trim(), alt: alt.trim() };
}

function databaseUnavailable(res) {
  return res.status(503).json({ error: "Layanan basis data sedang tidak tersedia." });
}

async function loadPageContent() {
  const [
    homepageRecord,
    legislationRecord,
    archivesRecord,
    activitiesRecord,
    organizationRecord,
    legacyRecord,
  ] =
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
      mongoose.connection.collection(contentCollections.organization).findOne(
        { key: "main" },
        { projection: { _id: 0, content: 1 } },
      ),
      SiteContent.findOne({ key: "main" })
        .select("homepage legislation archives activities organization -_id")
        .lean(),
    ]);

  return {
    homepage: homepageRecord?.content ?? legacyRecord?.homepage ?? {},
    legislation: legislationRecord?.content ?? legacyRecord?.legislation ?? {},
    archives: archivesRecord?.content ?? legacyRecord?.archives ?? {},
    activities: activitiesRecord?.content ?? legacyRecord?.activities ?? {},
    organization: organizationRecord?.content ?? legacyRecord?.organization ?? {},
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

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan masuk. Coba kembali beberapa saat lagi." },
});

app.post("/api/admin/login", adminLoginLimiter, requireSameOrigin, async (req, res) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);

  const username =
    typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const validUsername = /^[a-z0-9._-]{3,100}$/.test(username);
  const validPasswordLength = Buffer.byteLength(password, "utf8") <= 1024;
  const user = validUsername
    ? await mongoose.connection.collection("users").findOne(
        { username, role: "admin", isActive: { $ne: false } },
        { projection: { username: 1, passwordHash: 1 } },
      )
    : null;
  const passwordMatches = await verifyPassword(
    validPasswordLength ? password : "",
    user?.passwordHash,
  );
  if (!validUsername || !validPasswordLength || !user || !passwordMatches) {
    return res.status(401).json({ error: "Nama pengguna atau kata sandi tidak sesuai." });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + adminSessionDurationMs);
  await mongoose.connection.collection("admin_sessions").insertOne({
    userId: user._id,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    csrfToken,
    expiresAt,
    createdAt: new Date(),
  });
  res.set("Cache-Control", "no-store");
  setAdminSessionCookie(req, res, token);
  return res.json({ username: user.username, csrfToken });
});

app.get("/api/admin/session", (req, res) => {
  if (!readAdminSessionToken(req)) {
    res.set("Cache-Control", "no-store");
    return res.json({ authenticated: false });
  }
  return requireAdmin(req, res, () => {
    res.json({
      authenticated: true,
      username: res.locals.adminUser.username,
      csrfToken: res.locals.adminSession.csrfToken,
    });
  });
});

app.post(
  "/api/admin/logout",
  requireSameOrigin,
  requireAdmin,
  requireAdminCsrf,
  async (req, res) => {
    await mongoose.connection.collection("admin_sessions").deleteOne({
      tokenHash: crypto.createHash("sha256").update(readAdminSessionToken(req)).digest("hex"),
    });
    clearAdminSessionCookie(req, res);
    res.json({ message: "Anda telah keluar." });
  },
);

app.get("/api/admin/news", requireAdmin, async (req, res) => {
  const records = await News.find().sort({ date: -1, _id: -1 }).limit(500).lean();
  res.json({
    items: records.map((item) => ({
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

app.post(
  "/api/admin/news",
  requireSameOrigin,
  requireAdmin,
  requireAdminCsrf,
  async (req, res) => {
    const news = validateNewsInput(req.body);
    if (!news) return res.status(400).json({ error: "Periksa kembali data berita." });
    const item = await News.create(news);
    return res.status(201).json({ id: item._id.toString(), message: "Berita berhasil disimpan." });
  },
);

app.put(
  "/api/admin/news/:id",
  requireSameOrigin,
  requireAdmin,
  requireAdminCsrf,
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Berita tidak ditemukan." });
    }
    const news = validateNewsInput(req.body);
    if (!news) return res.status(400).json({ error: "Periksa kembali data berita." });
    const item = await News.findByIdAndUpdate(req.params.id, news, {
      new: true,
      runValidators: true,
    }).lean();
    if (!item) return res.status(404).json({ error: "Berita tidak ditemukan." });
    return res.json({ message: "Berita berhasil diperbarui." });
  },
);

app.delete(
  "/api/admin/news/:id",
  requireSameOrigin,
  requireAdmin,
  requireAdminCsrf,
  async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Berita tidak ditemukan." });
    }
    const item = await News.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: "Berita tidak ditemukan." });
    return res.json({ message: "Berita berhasil dihapus." });
  },
);

app.get("/api/admin/content", requireAdmin, async (req, res) => {
  res.json(await loadPageContent());
});

app.put(
  "/api/admin/content/:section",
  requireSameOrigin,
  requireAdmin,
  requireAdminCsrf,
  async (req, res) => {
    const collectionName = Object.hasOwn(contentCollections, req.params.section)
      ? contentCollections[req.params.section]
      : null;
    const content = req.body?.content;
    if (!collectionName || !content || typeof content !== "object" || Array.isArray(content)) {
      return res.status(400).json({ error: "Bagian atau format konten tidak valid." });
    }

    await mongoose.connection.collection(collectionName).updateOne(
      { key: "main" },
      { $set: { content } },
      { upsert: true },
    );
    return res.json({ message: "Konten berhasil diperbarui." });
  },
);

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
  const emailInput = readText(req.body?.email, 254);
  const email = emailInput?.toLowerCase() || null;
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

  let mailSettings;
  try {
    mailSettings = createAspirationTransporter();
  } catch (error) {
    console.error("Konfigurasi email aspirasi tidak valid:", error.message);
    return res.status(503).json({
      error: "Email belum siap. Aspirasi belum disimpan; silakan hubungi pengelola.",
    });
  }
  if (!mailSettings) {
    return res.status(503).json({
      error: "Email belum dikonfigurasi. Aspirasi belum disimpan; silakan hubungi pengelola.",
    });
  }

  const adminUsers = await mongoose.connection
    .collection("users")
    .find({ role: "admin", isActive: { $ne: false }, email: { $type: "string" } })
    .project({ email: 1, _id: 0 })
    .toArray();
  const adminEmails = [
    ...new Set(
      adminUsers
        .map((user) => (typeof user.email === "string" ? user.email.trim().toLowerCase() : ""))
        .filter((adminEmail) => adminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)),
    ),
  ];
  if (!adminEmails.length) {
    return res.status(503).json({
      error: "Email admin belum diatur pada koleksi users. Aspirasi belum disimpan; silakan hubungi pengelola.",
    });
  }

  const submission = await Aspiration.create({
    fullName,
    campus,
    email,
    topic,
    message,
    consentAt: new Date(),
  });
  const notifications = await sendAspirationEmails({
    transporter: mailSettings.transporter,
    from: mailSettings.from,
    aspiration: { fullName, campus, email, topic, message },
    adminEmails,
  });
  const allNotificationsSent =
    notifications.senderSent && notifications.adminsSent === notifications.adminsTotal;
  if (!allNotificationsSent) {
    console.error("Email aspirasi tidak terkirim seluruhnya:", {
      senderSent: notifications.senderSent,
      adminsSent: notifications.adminsSent,
      adminsTotal: notifications.adminsTotal,
    });
    return res.status(202).json({
      message: "Aspirasi tersimpan, tetapi sebagian email belum terkirim. Jangan kirim ulang; hubungi pengelola.",
      id: submission._id.toString(),
      saved: true,
      notifications,
    });
  }

  return res.status(201).json({
    message: "Terima kasih, aspirasi berhasil dikirim. Email konfirmasi dan pemberitahuan admin telah dikirim.",
    id: submission._id.toString(),
    saved: true,
    notifications,
  });
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
  await mongoose.connection.collection("users").createIndex({ username: 1 }, { unique: true });
  await mongoose.connection
    .collection("admin_sessions")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  console.info(`Connected to MongoDB database "${databaseName}".`);

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
