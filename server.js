require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoose = require("mongoose");

const app = express();
const projectRoot = __dirname;
const port = Number(process.env.PORT) || 3000;
const databaseName = process.env.MONGODB_DB || "dpm_km_unnes";
const topics = ["Fasilitas", "Kinerja", "Advokasi", "Lingkungan", "Lainnya"];

function isValidNewsDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https:"],
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
app.use(express.json({ limit: "10kb" }));

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
    return res.status(503).json({ error: "Layanan basis data sedang tidak tersedia." });
  }

  const record = await SiteContent.findOne({ key: "main" }).select("homepage -_id").lean();
  res.json({ homepage: record?.homepage ?? {} });
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
