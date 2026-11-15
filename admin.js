const sections = {
  homepage: {
    title: "Beranda",
    description: "Konten hero, kutipan, dan video.",
    collection: "homepage_content",
  },
  legislation: {
    title: "Undang-Undang",
    description: "Daftar UU dan naskah. Cocokkan documentId di daftar dengan id naskah.",
    collection: "legislation_content",
  },
  archives: {
    title: "Pengarsipan",
    description: "Arsip undang-undang dan kegiatan. Berita dikelola di tab Berita.",
    collection: "archives_content",
  },
  activities: {
    title: "Kegiatan",
    description: "Anggaran, laporan pengawasan, dan galeri dokumentasi.",
    collection: "activities_content",
  },
};

const loginPanel = document.querySelector("#admin-login-panel");
const dashboard = document.querySelector("#admin-dashboard");
const loginForm = document.querySelector("#admin-login-form");
const loginMessage = document.querySelector("#login-message");
const editorPanel = document.querySelector("#content-editor-panel");
const newsPanel = document.querySelector("#news-editor-panel");
const contentEditor = document.querySelector("#content-json");
const contentMessage = document.querySelector("#content-message");
const homepageEditor = document.querySelector("#homepage-editor");
const jsonEditorLabel = document.querySelector(".admin-json-label");
const homepageMessage = document.querySelector("#homepage-message");
const newsMessage = document.querySelector("#news-message");
const newsForm = document.querySelector("#news-form");
let activeSection = "homepage";
let editingNewsId = "";
let newsItems = [];
let homepageContent = {};

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Permintaan gagal (${response.status}).`);
  return result;
}

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

function showLogin(message = "") {
  dashboard.hidden = true;
  loginPanel.hidden = false;
  setMessage(loginMessage, message);
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  updateTab(activeSection);
}

function updateTab(section) {
  activeSection = section;
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    const active = button.dataset.adminTab === section;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  const isNews = section === "news";
  editorPanel.hidden = isNews;
  newsPanel.hidden = !isNews;
  if (isNews) loadNews();
  else {
    const info = sections[section];
    document.querySelector("#editor-title").textContent = info.title;
    document.querySelector("#editor-description").textContent = info.description;
    document.querySelector("#editor-collection").textContent = info.collection;
    const isHomepage = section === "homepage";
    homepageEditor.hidden = !isHomepage;
    contentEditor.hidden = isHomepage;
    jsonEditorLabel.hidden = isHomepage;
    document.querySelector("#save-content-button").hidden = isHomepage;
    document.querySelector("#reload-content-button").hidden = isHomepage;
    contentMessage.hidden = isHomepage;
    loadContent();
  }
}

function addField(parent, labelText, value, { multiline = false, type = "text", placeholder = "" } = {}) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText));
  const input = document.createElement(multiline ? "textarea" : "input");
  if (!multiline) input.type = type;
  else input.rows = 3;
  input.value = typeof value === "string" ? value : "";
  input.placeholder = placeholder;
  label.append(input);
  parent.append(label);
  return input;
}

function renderHomepageEditor(content) {
  homepageContent = content && typeof content === "object" && !Array.isArray(content) ? content : {};
  const hero = homepageContent.hero || {};
  const youtube = homepageContent.youtube || {};
  const quotes = homepageContent.quotes || {};

  document.querySelector("#hero-eyebrow").value = hero.eyebrow || "";
  document.querySelector("#hero-link-label").value = hero.linkLabel || "";
  document.querySelector("#hero-link").value = hero.link || "";
  document.querySelector("#hero-caption-label").value = hero.captionLabel || "";
  document.querySelector("#hero-caption-title").value = hero.captionTitle || "";

  document.querySelector("#youtube-url").value = youtube.url || "";
  document.querySelector("#youtube-section-label").value = youtube.sectionLabel || "";
  document.querySelector("#youtube-section-title").value = youtube.sectionTitle || "";
  document.querySelector("#youtube-eyebrow").value = youtube.eyebrow || "";
  document.querySelector("#youtube-title").value = youtube.title || "";
  document.querySelector("#youtube-description").value = youtube.description || "";
  document.querySelector("#youtube-empty-text").value = youtube.emptyLinkText || "";
  document.querySelector("#youtube-note").value = youtube.placeholderNote || "";

  document.querySelector("#quotes-section-label").value = quotes.sectionLabel || "";
  document.querySelector("#quotes-section-title").value = quotes.sectionTitle || "";
  document.querySelector("#quotes-section-description").value = quotes.sectionDescription || "";

  const slides = document.querySelector("#hero-slides-editor");
  slides.replaceChildren();
  (Array.isArray(homepageContent.heroSlides) ? homepageContent.heroSlides : []).forEach((slide) => {
    addHeroSlide(slide);
  });
  const quoteList = document.querySelector("#quotes-editor");
  quoteList.replaceChildren();
  (Array.isArray(quotes.items) ? quotes.items : []).forEach((quote) => addQuote(quote));
}

function addHeroSlide(slide = {}) {
  const list = document.querySelector("#hero-slides-editor");
  if (list.children.length >= 10) return;
  const card = document.createElement("article");
  card.className = "admin-repeat-card";
  const heading = document.createElement("div");
  heading.className = "admin-repeat-card-heading";
  const title = document.createElement("strong");
  title.textContent = `Slide ${list.children.length + 1}`;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "admin-remove-button";
  remove.textContent = "Hapus slide";
  remove.addEventListener("click", () => {
    if (card.dataset.previewUrl) URL.revokeObjectURL(card.dataset.previewUrl);
    card.remove();
    renumberCards(list, "Slide");
  });
  heading.append(title, remove);
  card.append(heading);
  const fields = document.createElement("div");
  fields.className = "admin-field-grid";
  const slideTitle = addField(fields, "Judul hero", slide.title);
  slideTitle.name = "slide-title";
  const imageLabel = document.createElement("label");
  imageLabel.append(document.createTextNode("File gambar hero (JPG, PNG, atau WebP)"));
  const imageInput = document.createElement("input");
  imageInput.type = "file";
  imageInput.name = "slide-image";
  imageInput.accept = "image/jpeg,image/png,image/webp";
  imageLabel.append(imageInput);
  fields.append(imageLabel);
  const imagePreview = document.createElement("div");
  imagePreview.className = "admin-image-preview";
  const preview = document.createElement("img");
  preview.alt = "";
  preview.hidden = !slide.image;
  if (slide.image) preview.src = slide.image;
  const previewNote = document.createElement("span");
  previewNote.textContent = slide.image ? "Gambar saat ini" : "Belum ada gambar dipilih";
  imagePreview.append(preview, previewNote);
  imageLabel.append(imagePreview);
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (card.dataset.previewUrl) URL.revokeObjectURL(card.dataset.previewUrl);
    card.dataset.previewUrl = URL.createObjectURL(file);
    preview.src = card.dataset.previewUrl;
    preview.hidden = false;
    previewNote.textContent = `Gambar baru: ${file.name}`;
  });
  const description = addField(fields, "Deskripsi hero", slide.description, { multiline: true });
  description.name = "slide-description";
  card.dataset.image = typeof slide.image === "string" ? slide.image : "";
  card.append(fields);
  list.append(card);
  renumberCards(list, "Slide");
}

function addQuote(quote = {}) {
  const list = document.querySelector("#quotes-editor");
  if (list.children.length >= 20) return;
  const card = document.createElement("article");
  card.className = "admin-repeat-card admin-quote-card";
  const heading = document.createElement("div");
  heading.className = "admin-repeat-card-heading";
  const title = document.createElement("strong");
  title.textContent = `Kutipan ${list.children.length + 1}`;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "admin-remove-button";
  remove.textContent = "Hapus kutipan";
  remove.addEventListener("click", () => {
    card.remove();
    renumberCards(list, "Kutipan");
  });
  heading.append(title, remove);
  card.append(heading);
  const fields = document.createElement("div");
  fields.className = "admin-field-grid";
  addField(fields, "Isi kutipan", quote.text, { multiline: true });
  addField(fields, "Nama / sumber", quote.author);
  addField(fields, "Jabatan / keterangan", quote.role);
  card.append(fields);
  list.append(card);
  renumberCards(list, "Kutipan");
}

function renumberCards(list, label) {
  [...list.children].forEach((card, index) => {
    card.querySelector(".admin-repeat-card-heading strong").textContent = `${label} ${index + 1}`;
  });
}

async function loadContent() {
  if (activeSection === "homepage") setMessage(homepageMessage, "Memuat konten...");
  else setMessage(contentMessage, "Memuat konten...");
  try {
    const result = await request("/api/admin/content");
    if (activeSection === "homepage") {
      renderHomepageEditor(result.homepage);
      setMessage(homepageMessage, "Konten beranda dimuat.");
    } else {
      contentEditor.value = JSON.stringify(result[activeSection] || {}, null, 2);
      jsonImageFiles.clear();
      renderJsonImageFields();
      setMessage(contentMessage, "Konten dimuat. Simpan setelah selesai mengedit.");
    }
  } catch (error) {
    if (activeSection === "homepage") setMessage(homepageMessage, error.message, true);
    else setMessage(contentMessage, error.message, true);
  }
}

function findImageFields(value, path = [], fields = []) {
  if (!value || typeof value !== "object") return fields;
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (key === "image" && (typeof child === "string" || child == null)) {
      fields.push({ path: childPath, value: typeof child === "string" ? child : "" });
    } else if (child && typeof child === "object") {
      findImageFields(child, childPath, fields);
    }
  }
  return fields;
}

function getPathLabel(path) {
  return path
    .map((part) => (/^\d+$/.test(part) ? `[${Number(part) + 1}]` : part))
    .join(".")
    .replace(/\.\[/g, "");
}

function renderJsonImageFields() {
  const section = document.querySelector("#json-image-fields");
  const list = document.querySelector("#json-image-list");
  list.querySelectorAll("img").forEach((image) => {
    if (image.src.startsWith("blob:")) URL.revokeObjectURL(image.src);
  });
  list.replaceChildren();
  if (!["archives", "activities"].includes(activeSection)) {
    section.hidden = true;
    return;
  }
  let content;
  try {
    content = JSON.parse(contentEditor.value);
  } catch {
    section.hidden = true;
    return;
  }
  const fields = findImageFields(content);
  section.hidden = !fields.length;
  fields.forEach(({ path, value }) => {
    const pathKey = JSON.stringify(path);
    const card = document.createElement("div");
    card.className = "admin-json-image-item";
    const label = document.createElement("label");
    label.className = "admin-json-image-label";
    const title = document.createElement("strong");
    title.textContent = getPathLabel(path);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.setAttribute("aria-label", `Pilih gambar untuk ${getPathLabel(path)}`);
    const preview = document.createElement("img");
    preview.alt = "";
    const selectedFile = jsonImageFiles.get(pathKey);
    const previewUrl = selectedFile ? URL.createObjectURL(selectedFile) : value;
    preview.hidden = !previewUrl;
    if (previewUrl) preview.src = previewUrl;
    const status = document.createElement("span");
    status.textContent = selectedFile
      ? `File baru: ${selectedFile.name}`
      : value
        ? "Gambar saat ini"
        : "Belum ada gambar";
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      if (!isAllowedImageFile(file)) {
        input.value = "";
        setMessage(contentMessage, "Pilih gambar JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.", true);
        return;
      }
      jsonImageFiles.set(pathKey, file);
      renderJsonImageFields();
    });
    label.append(title, input);
    card.append(label, preview, status);
    list.append(card);
  });
}

function setValueAtPath(object, path, value) {
  let target = object;
  for (const segment of path.slice(0, -1)) target = target[segment];
  target[path[path.length - 1]] = value;
}

async function saveHomepage() {
  const read = (selector) => document.querySelector(selector).value.trim();
  const hero = {
    ...(homepageContent.hero || {}),
    eyebrow: read("#hero-eyebrow"),
    linkLabel: read("#hero-link-label"),
    link: read("#hero-link"),
    captionLabel: read("#hero-caption-label"),
    captionTitle: read("#hero-caption-title"),
  };
  const slideCards = [...document.querySelector("#hero-slides-editor").children];
  const heroSlides = [];
  for (const card of slideCards) {
    const title = card.querySelector('[name="slide-title"]').value.trim();
    const description = card.querySelector('[name="slide-description"]').value.trim();
    const imageInput = card.querySelector('[name="slide-image"]');
    let image = card.dataset.image || "";
    const file = imageInput.files[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setMessage(homepageMessage, "Gambar hero harus berformat JPG, PNG, atau WebP.", true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMessage(homepageMessage, "Ukuran gambar hero maksimal 5 MB.", true);
        return;
      }
    }
    heroSlides.push({ title, description, image, file });
  }
  const youtube = {
    ...(homepageContent.youtube || {}),
    url: read("#youtube-url"),
    sectionLabel: read("#youtube-section-label"),
    sectionTitle: read("#youtube-section-title"),
    eyebrow: read("#youtube-eyebrow"),
    title: read("#youtube-title"),
    description: read("#youtube-description"),
    emptyLinkText: read("#youtube-empty-text"),
    placeholderNote: read("#youtube-note"),
  };
  const quoteItems = [...document.querySelector("#quotes-editor").children].map((card) => {
    const fields = card.querySelectorAll("input, textarea");
    return {
      text: fields[0].value.trim(),
      author: fields[1].value.trim(),
      role: fields[2].value.trim(),
    };
  });
  const quotes = {
    ...(homepageContent.quotes || {}),
    sectionLabel: read("#quotes-section-label"),
    sectionTitle: read("#quotes-section-title"),
    sectionDescription: read("#quotes-section-description"),
    items: quoteItems,
  };
  if (heroSlides.some((slide) => !slide.title || !slide.description || (!slide.image && !slide.file))) {
    setMessage(homepageMessage, "Lengkapi judul, deskripsi, dan file gambar pada setiap slide hero.", true);
    return;
  }
  if (quoteItems.some((quote) => !quote.text || !quote.author || !quote.role)) {
    setMessage(homepageMessage, "Lengkapi isi, nama/sumber, dan jabatan pada setiap kutipan.", true);
    return;
  }
  const content = { ...homepageContent, hero, heroSlides, youtube, quotes };
  const button = document.querySelector("#save-homepage-button");
  button.disabled = true;
  try {
    for (let index = 0; index < heroSlides.length; index += 1) {
      const slide = heroSlides[index];
      if (!slide.file) continue;
      setMessage(homepageMessage, `Mengunggah gambar slide ${index + 1}...`);
      const formData = new FormData();
      formData.append("image", slide.file);
      const uploaded = await request("/api/admin/media", {
        method: "POST",
        body: formData,
      });
      slide.image = uploaded.url;
      delete slide.file;
    }
  } catch (error) {
    button.disabled = false;
    setMessage(homepageMessage, error.message, true);
    return;
  }
  setMessage(homepageMessage, "Menyimpan konten beranda...");
  try {
    await request("/api/admin/content/homepage", {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    homepageContent = content;
    setMessage(homepageMessage, "Tersimpan. Muat ulang halaman beranda situs untuk melihat perubahan.");
  } catch (error) {
    setMessage(homepageMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function saveContent() {
  let content;
  try {
    content = JSON.parse(contentEditor.value);
  } catch {
    setMessage(contentMessage, "Format JSON belum valid. Periksa koma, tanda kutip, dan kurung.", true);
    return;
  }
  if (!content || Array.isArray(content) || typeof content !== "object") {
    setMessage(contentMessage, "Isi harus berupa objek JSON.", true);
    return;
  }
  const button = document.querySelector("#save-content-button");
  button.disabled = true;
  setMessage(contentMessage, "Menyimpan...");
  try {
    for (const [pathKey, file] of jsonImageFiles) {
      if (!isAllowedImageFile(file)) {
        throw new Error("Pilih gambar JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
      }
      setMessage(contentMessage, `Mengunggah gambar ${getPathLabel(JSON.parse(pathKey))}...`);
      const imageUrl = await uploadImage(file);
      setValueAtPath(content, JSON.parse(pathKey), imageUrl);
    }
    await request(`/api/admin/content/${activeSection}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    contentEditor.value = JSON.stringify(content, null, 2);
    jsonImageFiles.clear();
    renderJsonImageFields();
    setMessage(contentMessage, "Tersimpan. Muat ulang halaman situs untuk melihat perubahannya.");
  } catch (error) {
    setMessage(contentMessage, error.message, true);
  } finally {
    button.disabled = false;
  }
}

function renderNews() {
  const target = document.querySelector("#admin-news-list");
  target.replaceChildren();
  if (!newsItems.length) {
    const empty = document.createElement("p");
    empty.className = "admin-message";
    empty.textContent = "Belum ada berita.";
    target.append(empty);
    return;
  }
  newsItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "admin-news-item";
    const copy = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = item.title;
    const details = document.createElement("p");
    details.textContent = `${item.label} · ${item.date}`;
    copy.append(title, details);
    const actions = document.createElement("div");
    actions.className = "admin-news-item-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editNews(item));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.deleteNews = item.id;
    remove.textContent = "Hapus";
    remove.addEventListener("click", () => deleteNews(item));
    actions.append(edit, remove);
    row.append(copy, actions);
    target.append(row);
  });
}

async function loadNews() {
  setMessage(newsMessage, "Memuat berita...");
  try {
    const result = await request("/api/admin/news");
    newsItems = result.items || [];
    renderNews();
    setMessage(newsMessage, `${newsItems.length} berita dimuat.`);
  } catch (error) {
    setMessage(newsMessage, error.message, true);
  }
}

function editNews(item) {
  editingNewsId = item.id;
  newsForm.elements.imageFile.value = "";
  for (const field of ["label", "title", "description", "date", "alt"]) {
    newsForm.elements[field].value = item[field] || "";
  }
  newsForm.elements.existingImage.value = item.image || "";
  updateNewsImagePreview(item.image || "");
  newsForm.elements.id.value = item.id;
  document.querySelector("#save-news-button").textContent = "Simpan perubahan";
  document.querySelector("#cancel-news-edit").hidden = false;
  newsForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetNewsForm() {
  editingNewsId = "";
  newsForm.reset();
  newsForm.elements.id.value = "";
  newsForm.elements.existingImage.value = "";
  updateNewsImagePreview("");
  document.querySelector("#save-news-button").textContent = "Tambah berita";
  document.querySelector("#cancel-news-edit").hidden = true;
}

function updateNewsImagePreview(url, file) {
  const container = document.querySelector("#news-image-preview");
  const image = container.querySelector("img");
  const caption = container.querySelector("span");
  const remove = document.querySelector("#remove-news-image");
  if (newsImagePreviewUrl) URL.revokeObjectURL(newsImagePreviewUrl);
  newsImagePreviewUrl = file ? URL.createObjectURL(file) : "";
  const src = newsImagePreviewUrl || url;
  container.hidden = !src;
  image.hidden = !src;
  if (src) image.src = src;
  caption.textContent = file ? `Gambar baru: ${file.name}` : "Gambar saat ini";
  remove.hidden = !url && !file;
}

async function deleteNews(item) {
  if (!window.confirm(`Hapus berita "${item.title}"?`)) return;
  setMessage(newsMessage, "Menghapus berita...");
  try {
    await request(`/api/admin/news/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    setMessage(newsMessage, "Berita berhasil dihapus.");
    await loadNews();
  } catch (error) {
    setMessage(newsMessage, error.message, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = loginForm.querySelector("button[type=submit]");
  submit.disabled = true;
  setMessage(loginMessage, "Memeriksa akun...");
  try {
    const formData = new FormData(loginForm);
    await request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });
    loginForm.reset();
    showDashboard();
  } catch (error) {
    setMessage(loginMessage, error.message, true);
  } finally {
    submit.disabled = false;
  }
});

document.querySelectorAll("[data-admin-tab]").forEach((button) => {
  button.addEventListener("click", () => updateTab(button.dataset.adminTab));
});
document.querySelector("#save-content-button").addEventListener("click", saveContent);
document.querySelector("#reload-content-button").addEventListener("click", loadContent);
document.querySelector("#save-homepage-button").addEventListener("click", saveHomepage);
document.querySelector("#reload-homepage-button").addEventListener("click", loadContent);
document.querySelector("#add-hero-slide").addEventListener("click", () => addHeroSlide());
document.querySelector("#add-quote").addEventListener("click", () => addQuote());
document.querySelector("#reload-news-button").addEventListener("click", loadNews);
document.querySelector("#cancel-news-edit").addEventListener("click", resetNewsForm);
document.querySelector("#remove-news-image").addEventListener("click", () => {
  newsForm.elements.existingImage.value = "";
  newsForm.elements.imageFile.value = "";
  updateNewsImagePreview("");
});
newsForm.elements.imageFile.addEventListener("change", () => {
  const file = newsForm.elements.imageFile.files[0];
  if (!file) return;
  if (!isAllowedImageFile(file)) {
    newsForm.elements.imageFile.value = "";
    setMessage(newsMessage, "Pilih gambar JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.", true);
    return;
  }
  updateNewsImagePreview(newsForm.elements.existingImage.value, file);
});
contentEditor.addEventListener("input", () => {
  jsonImageFiles.clear();
  renderJsonImageFields();
});
newsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(newsMessage, "Menyimpan berita...");
  const formData = new FormData(newsForm);
  const item = Object.fromEntries(
    ["label", "title", "description", "date", "alt"].map((field) => [
      field,
      String(formData.get(field) || "").trim(),
    ]),
  );
  try {
    const imageFile = newsForm.elements.imageFile.files[0];
    if (imageFile) {
      if (!isAllowedImageFile(imageFile)) {
        throw new Error("Pilih gambar JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
      }
      setMessage(newsMessage, "Mengunggah gambar berita...");
      item.image = await uploadImage(imageFile);
    } else {
      item.image = newsForm.elements.existingImage.value;
    }
    await request(editingNewsId ? `/api/admin/news/${encodeURIComponent(editingNewsId)}` : "/api/admin/news", {
      method: editingNewsId ? "PUT" : "POST",
      body: JSON.stringify(item),
    });
    resetNewsForm();
    setMessage(newsMessage, "Berita berhasil disimpan.");
    await loadNews();
  } catch (error) {
    setMessage(newsMessage, error.message, true);
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await request("/api/admin/logout", { method: "POST", body: "{}" });
    showLogin("Anda sudah keluar dari admin.");
  } catch (error) {
    setMessage(contentMessage, error.message, true);
  }
});

request("/api/admin/session")
  .then(() => showDashboard())
  .catch((error) => showLogin(error.message.includes("Login admin belum") ? error.message : ""));
