const loginPanel = document.querySelector("#login-panel");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const dashboard = document.querySelector("#dashboard");
const dashboardStatus = document.querySelector("#dashboard-status");
const logoutButton = document.querySelector("#logout-button");
const newsForm = document.querySelector("#news-form");
const newsList = document.querySelector("#news-list");
const newsCount = document.querySelector("#news-count");
const newsFormStatus = document.querySelector("#news-form-status");
const contentSection = document.querySelector("#content-section");
const contentJson = document.querySelector("#content-json");
const structuredEditor = document.querySelector("#structured-editor");
const jsonFallbackEditor = document.querySelector("#json-fallback-editor");
const contentStatus = document.querySelector("#content-status");
const newsItemsById = new Map();
let activeRepeaters = new Map();
let csrfToken = "";
let siteContent = {};

function setStatus(element, message, isSuccess = false) {
  element.textContent = message;
  element.classList.toggle("is-success", isSuccess);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (csrfToken && options.method && options.method !== "GET") {
    headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Respons server tidak dapat dibaca.");
  }
  if (!response.ok) {
    if (response.status === 401 && csrfToken) {
      showLogin();
      setStatus(loginStatus, "Sesi berakhir. Silakan masuk kembali.");
    }
    const error = new Error(result.error || `Permintaan gagal (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function showLogin() {
  csrfToken = "";
  loginPanel.hidden = false;
  dashboard.hidden = true;
  logoutButton.hidden = true;
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  logoutButton.hidden = false;
}

function formatNewsDate(date) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

function renderNews(items) {
  newsItemsById.clear();
  newsList.replaceChildren();
  newsCount.textContent = `${items.length} berita`;

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Belum ada berita. Tambahkan berita pertama melalui formulir.";
    newsList.append(empty);
    return;
  }

  items.forEach((item) => {
    newsItemsById.set(item.id, item);
    const card = document.createElement("article");
    card.className = "news-item";

    const copy = document.createElement("div");
    copy.className = "news-item-copy";
    const meta = document.createElement("small");
    meta.textContent = `${item.label} · ${formatNewsDate(item.date)}`;
    const title = document.createElement("h4");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description;
    copy.append(meta, title, description);

    const actions = document.createElement("div");
    actions.className = "news-item-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.dataset.id = item.id;
    edit.textContent = "Ubah";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-news";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.textContent = "Hapus";
    actions.append(edit, remove);
    card.append(copy, actions);
    newsList.append(card);
  });
}

async function loadNews() {
  const result = await request("/api/admin/news");
  if (!Array.isArray(result.items)) throw new Error("Daftar berita dari server tidak valid.");
  renderNews(result.items);
}

async function loadContent() {
  const result = await request("/api/admin/content");
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Konten situs dari server tidak valid.");
  }
  siteContent = result;
  renderContentEditor();
  setStatus(contentStatus, "");
}

function resetNewsForm() {
  newsForm.reset();
  document.querySelector("#news-id").value = "";
  document.querySelector("#news-form-heading").textContent = "Tambah berita";
  document.querySelector("#news-cancel-edit").hidden = true;
  setStatus(newsFormStatus, "");
}

function editNews(item) {
  document.querySelector("#news-id").value = item.id;
  document.querySelector("#news-label").value = item.label;
  document.querySelector("#news-title").value = item.title;
  document.querySelector("#news-description").value = item.description;
  document.querySelector("#news-content").value = item.content || "";
  document.querySelector("#news-date").value = item.date;
  document.querySelector("#news-image").value = item.image || "";
  document.querySelector("#news-image-alt").value = item.alt || "";
  document.querySelector("#news-form-heading").textContent = "Ubah berita";
  document.querySelector("#news-cancel-edit").hidden = false;
  setStatus(newsFormStatus, "");
  document.querySelector("#news-form-heading").scrollIntoView({ behavior: "smooth", block: "center" });
}

function activatePanel(panelId) {
  document.querySelectorAll(".dashboard-panel").forEach((panel) => {
    panel.hidden = panel.id !== panelId;
  });
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    const active = tab.dataset.panel === panelId;
    tab.classList.toggle("is-active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
}

function createContentSection(parent, title, description) {
  const section = document.createElement("section");
  section.className = "content-form-section";
  const heading = document.createElement("div");
  heading.className = "content-form-heading";
  const titleElement = document.createElement("h3");
  titleElement.textContent = title;
  const descriptionElement = document.createElement("p");
  descriptionElement.textContent = description;
  heading.append(titleElement, descriptionElement);
  section.append(heading);
  parent.append(section);
  return section;
}

function safeEditorImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim(), window.location.origin);
    if (url.protocol === "https:") return url.href;
    if (url.origin === window.location.origin && !url.username && !url.password) return url.href;
  } catch {
    return "";
  }
  return "";
}

function safeEditorResourceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim(), window.location.origin);
    if (url.protocol === "https:") return url.href;
    if (url.origin === window.location.origin && !url.username && !url.password) return url.href;
  } catch {
    return "";
  }
  return "";
}

function isSupportedYouTubeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    let id = "";
    if (url.hostname === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0];
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id);
  } catch {
    return false;
  }
}

function createContentField(field, value = "") {
  const wrapper = document.createElement("div");
  wrapper.className = `content-field${field.wide ? " content-field-wide" : ""}`;
  const label = document.createElement("label");
  label.textContent = field.label;

  let control;
  if (field.type === "textarea") {
    control = document.createElement("textarea");
    control.rows = field.rows || 3;
  } else if (field.type === "select") {
    control = document.createElement("select");
    const options = [...(field.options || [])];
    if (!options.some((option) => option.value === value)) {
      options.unshift({ value, label: value || "Pilih" });
    }
    options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      control.append(optionElement);
    });
  } else {
    control = document.createElement("input");
    control.type = field.type || "text";
  }
  control.value = value;
  if (field.field) control.dataset.field = field.field;
  if (field.path) control.dataset.path = field.path;
  if (field.required) control.dataset.required = "true";
  if (field.maxLength) control.maxLength = field.maxLength;
  if (field.placeholder) control.placeholder = field.placeholder;
  label.append(control);
  wrapper.append(label);

  if (field.help) {
    const help = document.createElement("p");
    help.className = "field-help";
    help.textContent = field.help;
    wrapper.append(help);
  }

  if (field.imagePreview) {
    const preview = document.createElement("img");
    preview.className = "content-image-preview";
    preview.alt = "Pratinjau gambar";
    preview.loading = "lazy";
    preview.referrerPolicy = "no-referrer";
    const updatePreview = () => {
      const imageUrl = safeEditorImageUrl(control.value);
      if (imageUrl) {
        preview.src = imageUrl;
        preview.hidden = false;
      } else {
        preview.removeAttribute("src");
        preview.hidden = true;
      }
    };
    control.addEventListener("input", updatePreview);
    updatePreview();
    wrapper.append(preview);
  }
  return wrapper;
}

function makeRepeater(parent, configuration) {
  const section = createContentSection(parent, configuration.title, configuration.description);
  const list = document.createElement("div");
  list.className = "content-item-list";
  const count = document.createElement("p");
  count.className = "content-item-count";
  const addButton = document.createElement("button");
  addButton.className = "button button-outline content-add-button";
  addButton.type = "button";
  addButton.textContent = configuration.addLabel;

  const maxItems = configuration.limit || 100;
  activeRepeaters.set(configuration.key, list);

  const updateList = () => {
    [...list.children].forEach((card, index) => {
      card.querySelector(".content-item-number").textContent = `${configuration.itemLabel} ${index + 1}`;
    });
    count.textContent = `${list.children.length} item`;
    addButton.disabled = list.children.length >= maxItems;
  };

  const addItem = (item = {}) => {
    const card = document.createElement("article");
    card.className = "content-item-card";
    card.dataset.original = JSON.stringify(item);
    const header = document.createElement("div");
    header.className = "content-item-header";
    const itemNumber = document.createElement("h4");
    itemNumber.className = "content-item-number";
    const removeButton = document.createElement("button");
    removeButton.className = "text-button content-remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Hapus";
    removeButton.addEventListener("click", () => {
      card.remove();
      updateList();
      configuration.onChange?.();
    });
    header.append(itemNumber, removeButton);
    card.append(header);

    configuration.fields.forEach((field) => {
      card.append(createContentField(field, item[field.field] ?? field.defaultValue ?? ""));
    });
    list.append(card);
    updateList();
    configuration.onChange?.();
  };

  configuration.items.forEach((item) => addItem(item));
  addButton.addEventListener("click", () => {
    if (list.children.length < maxItems) addItem(configuration.defaultItem || {});
  });
  section.append(list, count, addButton);
  updateList();
  return list;
}

function readRepeater(key, requiredFields = []) {
  const list = activeRepeaters.get(key);
  if (!list) return [];
  const items = [];
  [...list.children].forEach((card, index) => {
    const controls = [...card.querySelectorAll("[data-field]")];
    if (!controls.some((control) => control.value.trim())) return;

    requiredFields.forEach((field) => {
      const control = controls.find((candidate) => candidate.dataset.field === field.name);
      if (!control?.value.trim()) {
        throw new Error(`${field.label} wajib diisi pada ${key.replaceAll("-", " ")} ${index + 1}.`);
      }
    });

    const item = JSON.parse(card.dataset.original || "{}");
    controls.forEach((control) => {
      const value = control.value.trim();
      if (value) item[control.dataset.field] = value;
      else delete item[control.dataset.field];
    });
    items.push(item);
  });
  return items;
}

function makeContentId(value, fallback) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function ensureUniqueIds(items, label) {
  const ids = new Set();
  items.forEach((item, index) => {
    item.id = typeof item.id === "string" && item.id.trim()
      ? item.id.trim()
      : makeContentId(item.title || "", `${label}-${index + 1}`);
    if (ids.has(item.id)) throw new Error(`ID ${label} "${item.id}" digunakan lebih dari sekali.`);
    ids.add(item.id);
  });
  return items;
}

function cloneContent(value) {
  return JSON.parse(JSON.stringify(value && typeof value === "object" && !Array.isArray(value) ? value : {}));
}

function applyPathFields(content) {
  const result = cloneContent(content);
  structuredEditor.querySelectorAll("[data-path]").forEach((control) => {
    const path = control.dataset.path.split(".");
    let target = result;
    path.slice(0, -1).forEach((key) => {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
        target[key] = {};
      }
      target = target[key];
    });
    target[path[path.length - 1]] = control.value.trim();
  });
  return result;
}

function renderHomepageEditor(content) {
  const homepage = cloneContent(content);
  if (Array.isArray(homepage.quotes)) homepage.quotes = { items: homepage.quotes };
  else homepage.quotes = cloneContent(homepage.quotes);

  const brandSection = createContentSection(
    structuredEditor,
    "Logo situs",
    "Logo ini digunakan pada header dan footer seluruh halaman publik.",
  );
  brandSection.append(
    createContentField(
      {
        path: "brandLogo",
        label: "URL logo atau path lokal",
        maxLength: 2048,
        placeholder: "images/unnes-logo.png",
        help: "Gunakan URL HTTPS atau path gambar yang tersedia di situs. Pratinjau ditampilkan di bawah.",
        imagePreview: true,
        wide: true,
      },
      homepage.brandLogo || "images/unnes-logo.png",
    ),
  );

  const heroSection = createContentSection(
    structuredEditor,
    "Tampilan hero beranda",
    "Atur teks utama, gambar latar, tautan, dan keterangan yang tampil pada bagian pembuka beranda.",
  );
  [
    { path: "hero.eyebrow", label: "Label hero", maxLength: 100 },
    { path: "hero.link", label: "Tautan tombol", maxLength: 2048, placeholder: "about.html" },
    { path: "hero.linkLabel", label: "Teks tombol", maxLength: 100 },
    { path: "hero.captionLabel", label: "Label keterangan", maxLength: 100 },
    { path: "hero.captionTitle", label: "Judul keterangan", maxLength: 200 },
  ].forEach((field) => {
    heroSection.append(createContentField(field, field.path.split(".").reduce((value, key) => value?.[key], homepage)));
  });
  makeRepeater(structuredEditor, {
    key: "homepage-heroSlides",
    title: "Slide hero",
    description: "Setiap slide menampilkan judul, deskripsi, dan gambar latar. Maksimal 10 slide.",
    itemLabel: "Slide",
    addLabel: "Tambah slide hero",
    limit: 10,
    items: Array.isArray(homepage.heroSlides) ? homepage.heroSlides : [],
    defaultItem: {},
    fields: [
      { field: "title", label: "Judul", type: "textarea", rows: 2, maxLength: 200, required: true, wide: true },
      { field: "description", label: "Deskripsi", type: "textarea", rows: 3, maxLength: 1000, required: true, wide: true },
      {
        field: "image",
        label: "URL gambar atau path lokal",
        maxLength: 2048,
        required: true,
        placeholder: "images/tugu-unnes.jpg",
        help: "Gunakan gambar HTTPS atau file lokal yang tersedia di situs.",
        imagePreview: true,
      },
    ],
  });

  const youtubeSection = createContentSection(
    structuredEditor,
    "Video YouTube beranda",
    "Masukkan tautan video YouTube untuk menampilkan pemutar video di beranda. Kosongkan tautan untuk menyembunyikan bagian video.",
  );
  [
    {
      path: "youtube.url",
      label: "URL video YouTube",
      type: "url",
      maxLength: 2048,
      placeholder: "https://www.youtube.com/watch?v=XXXXXXXXXXX",
      help: "Gunakan tautan video YouTube, Shorts, atau youtu.be; tautan kanal tidak didukung.",
      wide: true,
    },
    { path: "youtube.sectionLabel", label: "Label bagian", maxLength: 100 },
    { path: "youtube.sectionTitle", label: "Judul bagian", maxLength: 200 },
    { path: "youtube.eyebrow", label: "Label video", maxLength: 100 },
    { path: "youtube.title", label: "Judul video", maxLength: 200 },
    {
      path: "youtube.description",
      label: "Deskripsi video",
      type: "textarea",
      rows: 3,
      maxLength: 700,
      wide: true,
    },
  ].forEach((field) => {
    youtubeSection.append(
      createContentField(
        field,
        field.path.split(".").reduce((value, key) => value?.[key], homepage),
      ),
    );
  });

  const quoteSection = createContentSection(
    structuredEditor,
    "Kutipan beranda",
    "Kutipan tampil bergantian pada bagian percakapan di beranda. Maksimal 20 kutipan.",
  );
  [
    { path: "quotes.sectionLabel", label: "Label bagian", maxLength: 100 },
    { path: "quotes.sectionTitle", label: "Judul bagian", type: "textarea", rows: 2, maxLength: 200 },
    { path: "quotes.sectionDescription", label: "Deskripsi bagian", type: "textarea", rows: 2, maxLength: 500 },
  ].forEach((field) => {
    quoteSection.append(createContentField(field, field.path.split(".").reduce((value, key) => value?.[key], homepage)));
  });
  makeRepeater(structuredEditor, {
    key: "homepage-quotes",
    title: "Daftar kutipan",
    description: "Lengkapi isi kutipan, nama, dan peran narasumber.",
    itemLabel: "Kutipan",
    addLabel: "Tambah kutipan",
    limit: 20,
    items: Array.isArray(homepage.quotes.items) ? homepage.quotes.items : [],
    defaultItem: {},
    fields: [
      { field: "text", label: "Isi kutipan", type: "textarea", rows: 3, maxLength: 500, required: true, wide: true },
      { field: "author", label: "Nama narasumber", maxLength: 120, required: true },
      { field: "role", label: "Jabatan atau peran", maxLength: 120, required: true },
    ],
  });
}

function renderLegislationEditor(content) {
  const legislation = cloneContent(content);
  const documentOptions = [
    { value: "", label: "Tidak ditautkan" },
    ...(Array.isArray(legislation.documents)
      ? legislation.documents
          .filter((document) => document && typeof document.id === "string" && document.id.trim())
          .map((document) => ({
            value: document.id,
            label: `${document.id} — ${document.title || "Naskah tanpa judul"}`,
          }))
      : []),
  ];

  const activeSection = createContentSection(
    structuredEditor,
    "Dokumen yang tampil",
    "Pilih naskah yang dibuka pertama kali pada halaman Undang-Undang.",
  );
  activeSection.append(
    createContentField(
      {
        path: "activeDocumentId",
        label: "Naskah default",
        type: "select",
        options: documentOptions,
      },
      legislation.activeDocumentId || "",
    ),
  );

  makeRepeater(structuredEditor, {
    key: "legislation-documents",
    title: "Naskah undang-undang",
    description: "Atur judul dan tautan naskah. ID otomatis dibuat dari judul jika dikosongkan. Simpan dahulu agar ID tersedia pada daftar tautan.",
    itemLabel: "Naskah",
    addLabel: "Tambah naskah",
    items: Array.isArray(legislation.documents)
      ? legislation.documents.map((document) => ({
          ...document,
          previewUrl: document.previewUrl || document.textUrl || "",
        }))
      : [],
    defaultItem: {},
    fields: [
      { field: "id", label: "ID naskah", maxLength: 100, placeholder: "Dibuat otomatis dari judul" },
      { field: "title", label: "Judul naskah", maxLength: 300, required: true, wide: true },
      { field: "badge", label: "Label dokumen", maxLength: 100 },
      { field: "type", label: "Jenis dokumen", maxLength: 150 },
      { field: "number", label: "Nomor dokumen", maxLength: 150 },
      { field: "subject", label: "Perihal", type: "textarea", rows: 2, maxLength: 500, wide: true },
      { field: "note", label: "Catatan", type: "textarea", rows: 2, maxLength: 500, wide: true },
      {
        field: "previewUrl",
        label: "Path pratinjau naskah (TXT)",
        maxLength: 2048,
        placeholder: "UU-2026.txt",
        help: "Gunakan path file TXT yang tersedia di situs, misalnya UU No. 6 Tahun 2025.txt.",
        wide: true,
      },
      {
        field: "downloadUrl",
        label: "URL unduhan",
        maxLength: 2048,
        placeholder: "UU-2026.pdf atau UU-2026.txt",
        help: "Gunakan path file yang tersedia di situs atau URL HTTPS.",
        wide: true,
      },
    ],
  });

  makeRepeater(structuredEditor, {
    key: "legislation-bills",
    title: "Daftar undang-undang",
    description: "Item ini mengisi daftar produk legislasi yang tampil di beranda dan halaman Undang-Undang.",
    itemLabel: "Item",
    addLabel: "Tambah undang-undang",
    items: Array.isArray(legislation.bills) ? legislation.bills : [],
    defaultItem: {},
    fields: [
      { field: "id", label: "ID daftar", maxLength: 100, placeholder: "Dibuat otomatis dari judul" },
      { field: "label", label: "Label", maxLength: 150 },
      { field: "title", label: "Judul", maxLength: 300, required: true, wide: true },
      { field: "description", label: "Keterangan", type: "textarea", rows: 2, maxLength: 700, wide: true },
      { field: "documentId", label: "Tautkan ke naskah", type: "select", options: documentOptions, wide: true },
      { field: "status", label: "Status yang ditampilkan", maxLength: 120, placeholder: "Contoh: Dalam pembahasan" },
      {
        field: "statusType",
        label: "Gaya status",
        type: "select",
        options: [
          { value: "", label: "Standar" },
          { value: "review", label: "Dalam pembahasan (kuning)" },
          { value: "planning", label: "Perencanaan (merah)" },
          { value: "enacted", label: "Disahkan (hijau)" },
        ],
      },
    ],
  });

  makeRepeater(structuredEditor, {
    key: "legislation-history",
    title: "Riwayat perubahan dan status",
    description: "Catatan ini tampil pada halaman Perubahan & Status. Gunakan data perubahan yang sudah terverifikasi.",
    itemLabel: "Perubahan",
    addLabel: "Tambah catatan perubahan",
    items: Array.isArray(legislation.history) ? legislation.history : [],
    defaultItem: {},
    fields: [
      { field: "document", label: "Dokumen atau pasal", maxLength: 200, required: true },
      { field: "topic", label: "Topik perubahan", maxLength: 200, required: true },
      {
        field: "statusType",
        label: "Jenis status",
        type: "select",
        options: [
          { value: "", label: "Dalam proses" },
          { value: "submitted", label: "Diajukan (merah)" },
          { value: "in-progress", label: "Dalam proses (kuning)" },
          { value: "enacted", label: "Disahkan (hijau)" },
        ],
      },
      { field: "status", label: "Status", maxLength: 120, required: true },
      { field: "updatedAt", label: "Tanggal pembaruan", maxLength: 100, placeholder: "Contoh: 19 November 2026" },
      { field: "description", label: "Keterangan", type: "textarea", rows: 2, maxLength: 700, required: true, wide: true },
    ],
  });

  makeRepeater(structuredEditor, {
    key: "legislation-processStages",
    title: "Tahapan legislasi",
    description: "Tahapan ini tampil pada bagian akses dokumen di halaman Undang-Undang.",
    itemLabel: "Tahap",
    addLabel: "Tambah tahapan",
    items: Array.isArray(legislation.processStages) ? legislation.processStages : [],
    defaultItem: {},
    fields: [
      { field: "title", label: "Nama tahapan", maxLength: 150, required: true },
      { field: "description", label: "Keterangan tahapan", type: "textarea", rows: 2, maxLength: 500, required: true, wide: true },
    ],
  });
}

function renderOrganizationEditor(content) {
  const organization = cloneContent(content);
  makeRepeater(structuredEditor, {
    key: "organization-profiles",
    title: "Profil pengurus",
    description: "Setiap profil menampilkan foto, nama, jabatan, fakultas, program studi, dan angkatan pada halaman Struktur. Foto harus memakai URL HTTPS atau path gambar lokal yang tersedia.",
    itemLabel: "Profil",
    addLabel: "Tambah profil",
    limit: 100,
    items: Array.isArray(organization.profiles) ? organization.profiles : [],
    defaultItem: {},
    fields: [
      {
        field: "photo",
        label: "URL foto atau path lokal",
        maxLength: 2048,
        required: true,
        placeholder: "images/foto-pengurus.jpg",
        help: "Foto harus dapat diakses situs.",
        imagePreview: true,
        wide: true,
      },
      { field: "name", label: "Nama", maxLength: 120, required: true },
      { field: "position", label: "Jabatan", maxLength: 160, required: true },
      { field: "faculty", label: "Fakultas", maxLength: 160, required: true },
      { field: "studyProgram", label: "Program studi", maxLength: 160, required: true },
      { field: "cohort", label: "Angkatan", maxLength: 20, required: true, placeholder: "Contoh: 2024" },
      { field: "photoAlt", label: "Teks alternatif foto", maxLength: 300, wide: true },
    ],
  });
}

function renderArchiveEditor(content) {
  const archives = cloneContent(content);
  makeRepeater(structuredEditor, {
    key: "archives-items",
    title: "Daftar arsip resmi",
    description: "Kelola dokumen undang-undang dan kegiatan yang tampil pada halaman Pengarsipan. Berita dikelola terpisah melalui bagian Berita.",
    itemLabel: "Arsip",
    addLabel: "Tambah arsip",
    items: Array.isArray(archives.items) ? archives.items : [],
    defaultItem: { category: "laws" },
    fields: [
      {
        field: "category",
        label: "Kategori",
        type: "select",
        required: true,
        options: [
          { value: "laws", label: "Undang-undang" },
          { value: "activities", label: "Kegiatan" },
        ],
      },
      { field: "id", label: "ID arsip", maxLength: 120, placeholder: "Dibuat otomatis dari judul" },
      { field: "label", label: "Label arsip", maxLength: 150, required: true, placeholder: "Undang-Undang Keluarga Mahasiswa" },
      { field: "title", label: "Judul", maxLength: 300, required: true, wide: true },
      { field: "description", label: "Keterangan", type: "textarea", rows: 3, maxLength: 1000, required: true, wide: true },
      {
        field: "date",
        label: "Tanggal dokumen",
        type: "date",
        help: "Isi tanggal atau tahun dokumen.",
      },
      { field: "year", label: "Tahun dokumen", maxLength: 4, placeholder: "2026" },
      {
        field: "format",
        label: "Format berkas",
        maxLength: 20,
        placeholder: "PDF atau TXT",
        help: "Wajib diisi jika tautan berkas digunakan.",
      },
      {
        field: "file",
        label: "URL atau path berkas",
        maxLength: 2048,
        placeholder: "arsip/nama-dokumen.pdf",
        help: "Gunakan URL HTTPS atau path berkas yang tersedia pada situs.",
        wide: true,
      },
      {
        field: "image",
        label: "URL atau path gambar (opsional)",
        maxLength: 2048,
        placeholder: "images/dokumentasi.jpg",
        help: "Jika diisi, gambar ditampilkan sebagai pratinjau arsip.",
        imagePreview: true,
        wide: true,
      },
      { field: "alt", label: "Teks alternatif gambar", maxLength: 300, wide: true },
    ],
  });
}

function renderActivityEditor(content) {
  const activities = cloneContent(content);
  const budget = cloneContent(activities.budget);
  const budgetSection = createContentSection(
    structuredEditor,
    "Transparansi anggaran",
    "Atur judul dokumen, pratinjau, tautan unduhan, dan keterangan yang tampil pada halaman Kegiatan.",
  );
  [
    { path: "budget.title", label: "Judul dokumen", maxLength: 200 },
    { path: "budget.subtitle", label: "Subjudul dokumen", maxLength: 200 },
    { path: "budget.tableTitle", label: "Judul tabel ringkasan", maxLength: 200 },
    { path: "budget.notice", label: "Keterangan transparansi", type: "textarea", rows: 2, maxLength: 500, wide: true },
    {
      path: "budget.previewUrl",
      label: "URL pratinjau dokumen",
      maxLength: 2048,
      placeholder: "arsip/laporan-anggaran.pdf",
      help: "Gunakan URL HTTPS atau path berkas yang tersedia pada situs.",
      wide: true,
    },
    {
      path: "budget.downloadUrl",
      label: "URL unduhan dokumen",
      maxLength: 2048,
      placeholder: "arsip/laporan-anggaran.pdf",
      help: "Gunakan URL HTTPS atau path berkas yang tersedia pada situs.",
      wide: true,
    },
  ].forEach((field) => {
    budgetSection.append(
      createContentField(
        field,
        field.path.split(".").reduce((value, key) => value?.[key], activities),
      ),
    );
  });
  makeRepeater(structuredEditor, {
    key: "activities-budgetRows",
    title: "Ringkasan anggaran",
    description: "Baris ini mengisi tabel komponen, periode, rencana/pagu, realisasi, dan keterangan.",
    itemLabel: "Komponen",
    addLabel: "Tambah komponen anggaran",
    items: Array.isArray(budget.rows) ? budget.rows : [],
    defaultItem: {},
    fields: [
      { field: "component", label: "Komponen", maxLength: 200, required: true },
      { field: "period", label: "Periode", maxLength: 100 },
      { field: "planned", label: "Rencana / pagu", maxLength: 120 },
      { field: "actual", label: "Realisasi", maxLength: 120 },
      { field: "note", label: "Keterangan", type: "textarea", rows: 2, maxLength: 500, wide: true },
    ],
  });

  const oversightSection = createContentSection(
    structuredEditor,
    "Laporan hasil pengawasan",
    "Kelola pengantar dan setiap laporan yang ditampilkan sebagai kartu pada halaman Kegiatan.",
  );
  oversightSection.append(
    createContentField(
      {
        path: "oversightNotice",
        label: "Keterangan pengawasan",
        type: "textarea",
        rows: 2,
        maxLength: 500,
        wide: true,
      },
      activities.oversightNotice,
    ),
  );
  makeRepeater(structuredEditor, {
    key: "activities-oversight",
    title: "Daftar laporan pengawasan",
    description: "Tambahkan judul, ringkasan, status, dan tautan laporan.",
    itemLabel: "Laporan",
    addLabel: "Tambah laporan pengawasan",
    items: Array.isArray(activities.oversight) ? activities.oversight : [],
    defaultItem: {},
    fields: [
      { field: "label", label: "Label laporan", maxLength: 150 },
      { field: "title", label: "Judul laporan", maxLength: 250, required: true, wide: true },
      { field: "description", label: "Ringkasan atau temuan", type: "textarea", rows: 3, maxLength: 1000, required: true, wide: true },
      { field: "status", label: "Status tindak lanjut", maxLength: 150 },
      {
        field: "fileUrl",
        label: "URL berkas laporan",
        maxLength: 2048,
        placeholder: "arsip/laporan-pengawasan.pdf",
        help: "Opsional. Gunakan URL HTTPS atau path berkas yang tersedia pada situs.",
        wide: true,
      },
    ],
  });

  const gallerySection = createContentSection(
    structuredEditor,
    "Dokumentasi kegiatan",
    "Atur pengantar dan foto-foto yang tampil pada galeri halaman Kegiatan.",
  );
  gallerySection.append(
    createContentField(
      {
        path: "galleryNotice",
        label: "Keterangan galeri",
        type: "textarea",
        rows: 2,
        maxLength: 500,
        wide: true,
      },
      activities.galleryNotice,
    ),
  );
  makeRepeater(structuredEditor, {
    key: "activities-gallery",
    title: "Galeri kegiatan",
    description: "Setiap foto dapat memiliki judul, keterangan, dan teks alternatif.",
    itemLabel: "Foto",
    addLabel: "Tambah foto kegiatan",
    limit: 100,
    items: Array.isArray(activities.gallery) ? activities.gallery : [],
    defaultItem: {},
    fields: [
      {
        field: "image",
        label: "URL foto atau path lokal",
        maxLength: 2048,
        required: true,
        placeholder: "images/kegiatan.jpg",
        help: "Gunakan URL HTTPS atau path gambar yang tersedia pada situs.",
        imagePreview: true,
        wide: true,
      },
      { field: "title", label: "Judul foto", maxLength: 200, required: true },
      { field: "caption", label: "Keterangan foto", type: "textarea", rows: 2, maxLength: 500, wide: true },
      { field: "alt", label: "Teks alternatif", maxLength: 300, wide: true },
    ],
  });
}

function renderContentEditor() {
  const section = contentSection.value;
  const content = siteContent[section] || {};
  const structuredSections = ["homepage", "legislation", "archives", "activities", "organization"];
  const isStructured = structuredSections.includes(section);
  structuredEditor.replaceChildren();
  activeRepeaters = new Map();
  structuredEditor.hidden = !isStructured;
  jsonFallbackEditor.hidden = isStructured;
  if (!isStructured) {
    contentJson.value = JSON.stringify(content, null, 2);
    setStatus(contentStatus, "");
    return;
  }

  if (section === "homepage") renderHomepageEditor(content);
  if (section === "legislation") renderLegislationEditor(content);
  if (section === "archives") renderArchiveEditor(content);
  if (section === "activities") renderActivityEditor(content);
  if (section === "organization") renderOrganizationEditor(content);
  setStatus(contentStatus, "");
}

function collectStructuredContent(section) {
  if (section === "homepage") {
    const original = cloneContent(siteContent.homepage);
    if (Array.isArray(original.quotes)) original.quotes = { items: original.quotes };
    else original.quotes = cloneContent(original.quotes);
    const content = applyPathFields(original);
    if (content.brandLogo && !safeEditorImageUrl(content.brandLogo)) {
      throw new Error("Logo situs harus berupa URL HTTPS atau path gambar lokal.");
    }
    if (content.youtube?.url && !isSupportedYouTubeUrl(content.youtube.url)) {
      throw new Error("Masukkan tautan video YouTube yang valid (video, Shorts, atau youtu.be).");
    }
    const heroSlides = readRepeater("homepage-heroSlides", [
      { name: "title", label: "Judul hero" },
      { name: "description", label: "Deskripsi hero" },
      { name: "image", label: "Gambar hero" },
    ]);
    heroSlides.forEach((slide, index) => {
      if (!safeEditorImageUrl(slide.image)) {
        throw new Error(`Gambar hero ${index + 1} harus berupa URL HTTPS atau path gambar lokal.`);
      }
    });
    content.heroSlides = heroSlides;
    content.quotes.items = readRepeater("homepage-quotes", [
      { name: "text", label: "Isi kutipan" },
      { name: "author", label: "Nama narasumber" },
      { name: "role", label: "Jabatan atau peran" },
    ]);
    return content;
  }

  if (section === "legislation") {
    const content = applyPathFields(siteContent.legislation);
    content.documents = ensureUniqueIds(
      readRepeater("legislation-documents", [{ name: "title", label: "Judul naskah" }]).map(
        (document) => {
          delete document.textUrl;
          return document;
        },
      ),
      "naskah",
    );
    content.bills = ensureUniqueIds(
      readRepeater("legislation-bills", [{ name: "title", label: "Judul undang-undang" }]),
      "undang-undang",
    );
    content.history = readRepeater("legislation-history", [
      { name: "document", label: "Dokumen atau pasal" },
      { name: "topic", label: "Topik perubahan" },
      { name: "status", label: "Status" },
      { name: "description", label: "Keterangan" },
    ]);
    content.processStages = readRepeater("legislation-processStages", [
      { name: "title", label: "Nama tahapan" },
      { name: "description", label: "Keterangan tahapan" },
    ]);
    return content;
  }

  if (section === "archives") {
    const content = cloneContent(siteContent.archives);
    content.items = ensureUniqueIds(
      readRepeater("archives-items", [
        { name: "category", label: "Kategori arsip" },
        { name: "label", label: "Label arsip" },
        { name: "title", label: "Judul arsip" },
        { name: "description", label: "Keterangan arsip" },
      ]),
      "arsip",
    );
    content.items.forEach((item, index) => {
      if (!["laws", "activities"].includes(item.category)) {
        throw new Error(`Pilih kategori yang valid pada arsip ${index + 1}.`);
      }
      const parsedDate = new Date(`${item.date}T00:00:00Z`);
      const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(item.date || "") &&
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === item.date;
      const hasYear = /^\d{4}$/.test(item.year || "");
      if (!hasDate && !hasYear) {
        throw new Error(`Isi tanggal atau tahun dokumen pada arsip ${index + 1}.`);
      }
      if (item.file && !safeEditorResourceUrl(item.file)) {
        throw new Error(`Tautan berkas arsip ${index + 1} harus berupa URL HTTPS atau path lokal.`);
      }
      if (item.file && !item.format) {
        throw new Error(`Isi format berkas pada arsip ${index + 1}.`);
      }
      if (item.image && !safeEditorImageUrl(item.image)) {
        throw new Error(`Gambar arsip ${index + 1} harus berupa URL HTTPS atau path gambar lokal.`);
      }
    });
    return content;
  }

  if (section === "organization") {
    const content = applyPathFields(siteContent.organization);
    content.profiles = readRepeater("organization-profiles", [
      { name: "photo", label: "Foto profil" },
      { name: "name", label: "Nama" },
      { name: "position", label: "Jabatan" },
      { name: "faculty", label: "Fakultas" },
      { name: "studyProgram", label: "Program studi" },
      { name: "cohort", label: "Angkatan" },
    ]);
    content.profiles.forEach((profile, index) => {
      if (!safeEditorImageUrl(profile.photo)) {
        throw new Error(`Foto profil ${index + 1} harus berupa URL HTTPS atau path gambar lokal.`);
      }
    });
    return content;
  }

  if (section === "activities") {
    const content = applyPathFields(siteContent.activities);
    content.budget.rows = readRepeater("activities-budgetRows", [
      { name: "component", label: "Komponen anggaran" },
    ]);
    content.oversight = readRepeater("activities-oversight", [
      { name: "title", label: "Judul laporan pengawasan" },
      { name: "description", label: "Ringkasan atau temuan" },
    ]);
    content.oversight.forEach((item, index) => {
      if (item.fileUrl && !safeEditorResourceUrl(item.fileUrl)) {
        throw new Error(`URL berkas laporan pengawasan ${index + 1} harus berupa URL HTTPS atau path lokal.`);
      }
    });
    content.gallery = readRepeater("activities-gallery", [
      { name: "image", label: "Foto kegiatan" },
      { name: "title", label: "Judul foto" },
    ]);
    content.gallery.forEach((item, index) => {
      if (!safeEditorImageUrl(item.image)) {
        throw new Error(`Foto kegiatan ${index + 1} harus berupa URL HTTPS atau path gambar lokal.`);
      }
    });
    ["previewUrl", "downloadUrl"].forEach((field) => {
      const value = content.budget[field];
      if (value && !safeEditorResourceUrl(value)) {
        throw new Error(`URL ${field === "previewUrl" ? "pratinjau" : "unduhan"} anggaran harus berupa URL HTTPS atau path lokal.`);
      }
    });
    return content;
  }
  throw new Error("Formulir konten untuk bagian ini tidak tersedia.");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setStatus(loginStatus, "");
  try {
    const formData = new FormData(loginForm);
    const result = await request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });
    csrfToken = result.csrfToken;
    loginForm.reset();
    showDashboard();
    setStatus(dashboardStatus, "");
    await Promise.all([loadNews(), loadContent()]);
  } catch (error) {
    if (csrfToken) setStatus(dashboardStatus, error.message);
    else setStatus(loginStatus, error.message);
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await request("/api/admin/logout", { method: "POST", body: "{}" });
    showLogin();
    setStatus(loginStatus, "Anda telah keluar.", true);
  } catch (error) {
    if (error.status === 401) showLogin();
    setStatus(loginStatus, error.message);
  } finally {
    logoutButton.disabled = false;
  }
});

newsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = newsForm.querySelector('button[type="submit"]');
  const itemId = document.querySelector("#news-id").value;
  const formData = new FormData(newsForm);
  const news = Object.fromEntries(formData.entries());
  submitButton.disabled = true;
  setStatus(newsFormStatus, "");
  try {
    await request(itemId ? `/api/admin/news/${encodeURIComponent(itemId)}` : "/api/admin/news", {
      method: itemId ? "PUT" : "POST",
      body: JSON.stringify(news),
    });
    resetNewsForm();
    setStatus(newsFormStatus, "Berita berhasil disimpan dan dipublikasikan.", true);
    await loadNews();
  } catch (error) {
    setStatus(newsFormStatus, error.message);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#news-cancel-edit").addEventListener("click", resetNewsForm);

newsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !newsList.contains(button)) return;
  const item = newsItemsById.get(button.dataset.id);
  if (!item) return;
  if (button.dataset.action === "edit") return editNews(item);
  if (button.dataset.action !== "delete" || !window.confirm(`Hapus berita “${item.title}”?`)) return;

  button.disabled = true;
  try {
    await request(`/api/admin/news/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (document.querySelector("#news-id").value === item.id) resetNewsForm();
    await loadNews();
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
});

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", async () => {
    activatePanel(tab.dataset.panel);
    if (tab.dataset.panel === "content-panel" && !Object.keys(siteContent).length) {
      try {
        await loadContent();
      } catch (error) {
        setStatus(contentStatus, error.message);
      }
    }
  });
});

contentSection.addEventListener("change", renderContentEditor);

document.querySelector("#save-content").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  let content;
  try {
    if (["homepage", "legislation", "archives", "activities", "organization"].includes(contentSection.value)) {
      content = collectStructuredContent(contentSection.value);
    } else {
      content = JSON.parse(contentJson.value);
      if (!content || typeof content !== "object" || Array.isArray(content)) {
        setStatus(contentStatus, "Konten harus berupa objek JSON.");
        return;
      }
    }
  } catch (error) {
    setStatus(contentStatus, error.message || "Periksa kembali data konten.");
    return;
  }

  button.disabled = true;
  setStatus(contentStatus, "");
  try {
    const section = contentSection.value;
    await request(`/api/admin/content/${encodeURIComponent(section)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    siteContent[section] = content;
    renderContentEditor();
    setStatus(contentStatus, "Konten berhasil disimpan dan dipublikasikan.", true);
  } catch (error) {
    setStatus(contentStatus, error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#reload-content").addEventListener("click", async (event) => {
  event.currentTarget.disabled = true;
  try {
    await loadContent();
  } catch (error) {
    setStatus(contentStatus, error.message);
  } finally {
    event.currentTarget.disabled = false;
  }
});

document.querySelector("#login-password").addEventListener("input", () => setStatus(loginStatus, ""));

request("/api/admin/session")
  .then(async (session) => {
    if (!session.authenticated) {
      showLogin();
      return;
    }
    csrfToken = session.csrfToken;
    showDashboard();
    await Promise.all([loadNews(), loadContent()]);
  })
  .catch((error) => {
    if (csrfToken && error.status !== 401) {
      showDashboard();
      setStatus(dashboardStatus, error.message);
    } else {
      showLogin();
      if (error.status !== 401) setStatus(loginStatus, error.message);
    }
  });
