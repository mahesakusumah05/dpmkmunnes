let stories = [
  {
    title: "Suara Mahasiswa,\nArah Perubahan.",
    description:
      "DPM KM UNNES hadir untuk menyerap aspirasi, mengawal kebijakan, dan memperjuangkan kepentingan mahasiswa Universitas Negeri Semarang.",
    image: "images/tugu-unnes.jpg",
  },
];

let quotes = [];

const heroTitle = document.querySelector("#hero-title");
const heroDescription = document.querySelector("#hero-description");
const heroElement = document.querySelector(".hero");
const heroImageLayers = [...document.querySelectorAll(".hero-image")];
const slideCurrent = document.querySelector("#slide-current");
let heroDots = [...document.querySelectorAll(".hero-dot")];
const heroDotsContainer = document.querySelector(".hero-dots");
const slideTotal = document.querySelector("#slide-total");
let activeSlide = 0;
let activeQuote = 0;

const monthlyNewsTitle = document.querySelector("#monthly-news-title");
let revealObserver = null;
const archiveDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
let backendArchiveItems = [];
let newsItemsFromApi = [];
let archiveItemsByDate = [];

const newsTicker = document.querySelector("#latest-news-ticker");
const archiveNewsGrid = document.querySelector("#archive-news-grid");
const latestNewsGrid = document.querySelector("#latest-news-grid");

function getContentValue(content, path) {
  return path.split(".").reduce((value, key) => value?.[key], content);
}

function setMultilineText(element, value) {
  const lines = value.split(/\r?\n/);
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index) element.append(document.createElement("br"));
    element.append(document.createTextNode(line));
  });
}

function safeContentHref(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" && url.origin !== window.location.origin) return "";
    return url.href;
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function safeImageUrl(value) {
  try {
    if (typeof value !== "string" || !value.trim()) return "";
    const url = new URL(value, window.location.origin);
    if (url.protocol === "https:") return url.href;
    if (url.origin === window.location.origin && !url.username && !url.password) return url.href;
    return "";
  } catch {
    return "";
  }
}

function isValidArchiveDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    let id = "";
    if (url.hostname === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0];
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

function renderOrganizationProfiles(profiles) {
  const grid = document.querySelector("#org-profile-grid");
  const emptyState = document.querySelector("#org-profile-empty");
  if (!grid || !emptyState) return;

  const validProfiles = Array.isArray(profiles)
    ? profiles
        .filter(
          (profile) =>
            profile &&
            profile.sample !== true &&
            typeof profile.name === "string" &&
            profile.name.trim() &&
            typeof profile.position === "string" &&
            profile.position.trim() &&
            safeImageUrl(profile.photo),
        )
        .slice(0, 100)
    : [];

  grid.replaceChildren();
  validProfiles.forEach((profile) => {
    const card = document.createElement("article");
    card.className = "org-profile-card";

    const photo = document.createElement("img");
    photo.className = "org-profile-photo";
    photo.src = safeImageUrl(profile.photo);
    photo.alt =
      typeof profile.photoAlt === "string" && profile.photoAlt.trim()
        ? profile.photoAlt.trim().slice(0, 300)
        : `Foto profil ${profile.name.trim().slice(0, 120)}`;
    photo.loading = "lazy";
    photo.decoding = "async";

    const details = document.createElement("div");
    details.className = "org-profile-details";

    const name = document.createElement("h3");
    name.textContent = profile.name.trim().slice(0, 120);

    const position = document.createElement("p");
    position.textContent = profile.position.trim().slice(0, 160);

    details.append(name, position);
    card.append(photo, details);
    grid.append(card);
  });
  emptyState.hidden = validProfiles.length > 0;
}

function applySiteContent(content) {
  document.querySelectorAll("[data-content-key]").forEach((element) => {
    const value = getContentValue(content, element.dataset.contentKey);
    if (
      typeof value === "string" &&
      value.trim() &&
      !/adikara|contoh|ilustrasi/i.test(value)
    ) {
      const text = value.trim();
      if (text.includes("\n")) setMultilineText(element, text);
      else element.textContent = text;
    }
  });
  document.querySelectorAll("[data-content-href]").forEach((element) => {
    const value = getContentValue(content, element.dataset.contentHref);
    const href = safeContentHref(value);
    if (href) element.setAttribute("href", href);
  });
  document.querySelectorAll("[data-content-src]").forEach((element) => {
    const value = getContentValue(content, element.dataset.contentSrc);
    const src = safeImageUrl(value);
    if (src) element.setAttribute("src", src);
  });
  document.querySelectorAll("[data-content-alt]").forEach((element) => {
    const value = getContentValue(content, element.dataset.contentAlt);
    if (typeof value === "string") element.setAttribute("alt", value.slice(0, 300));
  });

  const homepage = content.homepage;
  const siteHomepage = homepage && typeof homepage === "object" ? homepage : {};
  const brandLogo = safeImageUrl(siteHomepage.brandLogo);
  if (brandLogo) {
    document.querySelectorAll(".brand-emblem").forEach((image) => {
      image.setAttribute("src", brandLogo);
    });
  }

  const heroSlides = Array.isArray(siteHomepage.heroSlides)
    ? siteHomepage.heroSlides
        .filter(
          (slide) =>
            slide &&
            typeof slide.title === "string" &&
            typeof slide.description === "string" &&
            slide.sample !== true &&
            !/images\.unsplash\.com/i.test(slide.image || "") &&
            safeImageUrl(slide.image),
        )
        .slice(0, 10)
        .map((slide) => ({
          title: slide.title.trim().slice(0, 200),
          description: slide.description.trim().slice(0, 1000),
          image: safeImageUrl(slide.image),
        }))
    : [];
  const quoteItems = Array.isArray(siteHomepage.quotes)
    ? siteHomepage.quotes
    : siteHomepage.quotes?.items;
  const homepageQuotes = Array.isArray(quoteItems)
    ? quoteItems
        .filter(
          (quote) =>
            quote &&
            typeof quote.text === "string" &&
            typeof quote.author === "string" &&
            typeof quote.role === "string" &&
            !/suara dari dpm km unnes/i.test(quote.author) &&
            !/kebijakan yang baik berawal|partisipasi publik menjadikan|kerja parlemen adikara/i.test(quote.text),
        )
        .slice(0, 20)
        .map((quote) => ({
          text: quote.text.trim().slice(0, 500),
          author: quote.author.trim().slice(0, 120),
          role: quote.role.trim().slice(0, 120),
        }))
    : [];

  if (heroSlides.length) stories = heroSlides;
  quotes = homepageQuotes;
  document.dispatchEvent(
    new CustomEvent("site-content-loaded", {
      detail: { heroSlides: stories, quotes },
    }),
  );

  renderLegislationContent(content.legislation);
  renderActivityContent(content.activities);
  renderOrganizationProfiles(content.organization?.profiles);
  backendArchiveItems = Array.isArray(content.archives?.items)
    ? content.archives.items.filter(
        (item) =>
          item &&
          item.sample !== true &&
          ["laws", "activities"].includes(item.category) &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.description === "string" &&
          typeof item.label === "string" &&
          (isValidArchiveDate(item.date) || /^\d{4}$/.test(item.year || "")),
      )
    : [];
  updateArchiveItems();

  const videoUrl = siteHomepage.youtube?.url;
  const videoId = typeof videoUrl === "string" ? youtubeVideoId(videoUrl) : "";
  const videoFrame = document.querySelector(".video-embed");
  const videoWatchLink = document.querySelector(".youtube-watch-link");
  const videoSection = document.querySelector(".youtube-section");
  if (videoId && videoFrame) {
    if (videoSection) videoSection.hidden = false;
    const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    embedUrl.searchParams.set("origin", window.location.origin);
    videoFrame.src = embedUrl.href;
    videoFrame.hidden = false;
    videoFrame.title =
      typeof siteHomepage.youtube.title === "string" && siteHomepage.youtube.title.trim()
        ? siteHomepage.youtube.title.trim().slice(0, 120)
        : "Video DPM KM UNNES";
    videoFrame.closest(".video-player")?.classList.add("has-video");
    if (videoWatchLink) {
      videoWatchLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
      videoWatchLink.hidden = false;
    }
    document.querySelector(".youtube-section [data-content-key='homepage.youtube.emptyLinkText']")?.setAttribute("hidden", "");
    document.querySelector(".youtube-section [data-content-key='homepage.youtube.placeholderNote']")?.setAttribute("hidden", "");
  } else if (videoUrl && !videoId) {
    console.error("Tautan video YouTube di konten situs tidak valid.");
  }
  if (!videoId && videoSection) videoSection.hidden = true;
}

fetch("/api/content")
  .then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Konten gagal dimuat (${response.status}).`);
    if (!result || typeof result !== "object") throw new Error("Respons konten situs tidak valid.");
    applySiteContent(result);
  })
  .catch((error) => console.error("Konten situs tidak dapat dimuat dari backend:", error));

function renderNewsTicker() {
  if (!newsTicker) return;
  const [primaryGroup, duplicateGroup] = newsTicker.querySelectorAll(".news-ticker-group");
  const latestNewsItems = archiveItemsByDate.filter((item) => item.category === "news");
  primaryGroup.replaceChildren();
  duplicateGroup.replaceChildren();

  if (!latestNewsItems.length) {
    newsTicker.classList.add("is-empty");
    primaryGroup.textContent = "Belum ada berita terbaru.";
    newsTicker.style.setProperty("--ticker-duration", "0s");
    return;
  }

  newsTicker.classList.remove("is-empty");
  latestNewsItems.forEach((item) => {
    const link = document.createElement("a");
    link.className = "news-ticker-item";
    link.href = `news.html#${encodeURIComponent(item.id)}`;
    link.dataset.newsId = item.id;
    link.setAttribute("aria-haspopup", "dialog");
    link.textContent = item.title;
    primaryGroup.append(link);

    const duplicate = document.createElement("span");
    duplicate.className = "news-ticker-item";
    duplicate.textContent = item.title;
    duplicateGroup.append(duplicate);
  });

  const duration = Math.max(24, Math.round(primaryGroup.scrollWidth / 45));
  newsTicker.style.setProperty("--ticker-duration", `${duration}s`);
}

const newsDetailDialog = document.createElement("dialog");
newsDetailDialog.className = "news-detail-dialog";
newsDetailDialog.setAttribute("aria-labelledby", "news-detail-title");
newsDetailDialog.innerHTML = `
  <div class="news-detail-shell">
    <button class="news-detail-close" type="button" aria-label="Tutup berita">×</button>
    <div class="news-detail-cover" hidden><img alt="" /></div>
    <article class="news-detail-content">
      <p class="news-detail-meta"><span></span><time></time></p>
      <h2 id="news-detail-title"></h2>
      <div class="news-detail-body"></div>
    </article>
  </div>`;
document.body.append(newsDetailDialog);

newsDetailDialog.querySelector(".news-detail-close").addEventListener("click", () => {
  newsDetailDialog.close();
});
newsDetailDialog.addEventListener("click", (event) => {
  if (event.target === newsDetailDialog) newsDetailDialog.close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && newsDetailDialog.open) {
    event.preventDefault();
    newsDetailDialog.close();
  }
});

function openNewsDetail(item) {
  if (typeof newsDetailDialog.showModal !== "function") {
    window.location.href = `news.html#${encodeURIComponent(item.id)}`;
    return;
  }

  const cover = newsDetailDialog.querySelector(".news-detail-cover");
  const image = cover.querySelector("img");
  const imageUrl = safeImageUrl(item.image);
  cover.hidden = !imageUrl;
  if (imageUrl) {
    image.src = imageUrl;
    image.alt = item.alt || item.title;
  } else {
    image.removeAttribute("src");
    image.alt = "";
  }

  newsDetailDialog.querySelector(".news-detail-meta span").textContent = item.label;
  const date = newsDetailDialog.querySelector(".news-detail-meta time");
  date.textContent = isValidArchiveDate(item.date)
    ? archiveDateFormatter.format(new Date(`${item.date}T12:00:00`))
    : item.date || "";
  if (isValidArchiveDate(item.date)) date.dateTime = item.date;
  else date.removeAttribute("datetime");

  newsDetailDialog.querySelector("#news-detail-title").textContent = item.title;
  const articleText = typeof item.content === "string" && item.content.trim()
    ? item.content
    : item.description;
  const paragraphs = String(articleText || "")
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split(/\r?\n/).map(escapeHtml).join("<br>"))
    .filter(Boolean);
  newsDetailDialog.querySelector(".news-detail-body").innerHTML =
    paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
  newsDetailDialog.showModal();
}

document.addEventListener("click", (event) => {
  const trigger = event.target instanceof Element ? event.target.closest("[data-news-id]") : null;
  if (!trigger) return;
  const item = archiveItemsByDate.find(
    (candidate) => candidate.category === "news" && String(candidate.id) === trigger.dataset.newsId,
  );
  if (!item) return;
  event.preventDefault();
  openNewsDetail(item);
});

function updateArchiveItems() {
  const sortDate = (item) => item.date || `${item.year || "0000"}-01-01`;
  archiveItemsByDate = [...backendArchiveItems, ...newsItemsFromApi].sort((first, second) =>
    sortDate(second).localeCompare(sortDate(first)),
  );
  renderNewsTicker();
  renderArchiveContent();
}

function parseLawText(source) {
  const parsed = { preamble: [], chapters: [], appendix: [] };
  const lines = source.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n");
  let activeBlocks = parsed.preamble;
  let paragraphLines = [];

  const flushParagraph = () => {
    const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    if (text) activeBlocks.push({ type: "paragraph", text });
    paragraphLines = [];
  };
  const addBlock = (type, text) => activeBlocks.push({ type, text });
  const findNextLine = (start) => {
    let index = start;
    while (index < lines.length && !lines[index].trim()) index += 1;
    return index;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const chapterMatch = line.match(/^BAB\s+([IVXLCDM]+)\s*(.*)$/i);
    if (chapterMatch) {
      flushParagraph();
      const chapterNumber = chapterMatch[1].toUpperCase();
      let title = chapterMatch[2].trim();
      if (!title) {
        const titleIndex = findNextLine(index + 1);
        const candidate = lines[titleIndex]?.trim() || "";
        if (candidate && !/^(?:BAB\s+|Bagian\s+|Pasal\s+\d+|LAMPIRAN\b)/i.test(candidate)) {
          title = candidate;
          index = titleIndex;
        }
      }

      const chapter = {
        id: `bab-${chapterNumber.toLowerCase()}`,
        chapter: `BAB ${chapterNumber}`,
        title,
        blocks: [],
      };
      parsed.chapters.push(chapter);
      activeBlocks = chapter.blocks;
      continue;
    }

    if (/^LAMPIRAN\b/i.test(line)) {
      flushParagraph();
      activeBlocks = parsed.appendix;
      addBlock("heading", line);
      continue;
    }

    const inlineArticle = line.match(/^(.*?)\s+(Pasal\s+\d+)\s*$/i);
    if (inlineArticle) {
      flushParagraph();
      if (inlineArticle[1].trim()) addBlock("part", inlineArticle[1].trim());
      addBlock("article", inlineArticle[2].replace(/\s+/g, " "));
      continue;
    }

    if (/^Bagian\s+/i.test(line)) {
      flushParagraph();
      let title = line;
      if (/^Bagian\s+\S+\s*$/i.test(line)) {
        const titleIndex = findNextLine(index + 1);
        const candidate = lines[titleIndex]?.trim() || "";
        if (
          candidate &&
          !/^(?:BAB\s+|Bagian\s+|Pasal\s+\d+|LAMPIRAN\b|\d+[.)]|[a-z][.)])/i.test(candidate)
        ) {
          title = `${line} — ${candidate}`;
          index = titleIndex;
        }
      }
      addBlock("part", title);
      continue;
    }

    if (/^Pasal\s+\d+\s*$/i.test(line)) {
      flushParagraph();
      addBlock("article", line);
      continue;
    }

    if (activeBlocks === parsed.preamble && /^Menimbang\s*:?$/i.test(line)) {
      flushParagraph();
      addBlock("heading", line);
      continue;
    }

    if (
      activeBlocks === parsed.preamble &&
      !parsed.preamble.some((block) => block.type === "heading" && /^Menimbang\b/i.test(block.text))
    ) {
      flushParagraph();
      const decisionMarker = line.match(/^(.*?)\s+(MEMUTUSKAN:)\s*$/i);
      if (decisionMarker) {
        if (decisionMarker[1].trim()) addBlock("heading", decisionMarker[1].trim());
        addBlock("heading", decisionMarker[2]);
      } else {
        addBlock("heading", line);
      }
      continue;
    }

    if (
      activeBlocks === parsed.preamble &&
      /^(?:Mengingat|Memutuskan|Menetapkan)\s*:?$/i.test(line)
    ) {
      flushParagraph();
      addBlock("heading", line);
      continue;
    }

    paragraphLines.push(line);
  }
  flushParagraph();
  return parsed;
}

function appendLawTextBlock(container, block) {
  const tagName = block.type === "article" ? "h4" : block.type === "part" ? "h5" : "p";
  const element = document.createElement(tagName);
  element.className = `law-text-${block.type}`;
  if (
    block.type === "paragraph" &&
    /^(?:\d+[.)]|[a-z][.)])\s/i.test(block.text)
  ) {
    element.classList.add("law-text-list-item");
  }
  element.textContent = block.text;
  container.append(element);
}

function renderLawTextDocument(target, documentContent, parsed) {
  const content = document.createElement("div");
  content.className = "law-text-content";

  const badge = document.createElement("span");
  badge.className = "law-document-badge";
  badge.textContent = documentContent.badge || "NASKAH UNDANG-UNDANG";
  content.append(badge);

  if (parsed.preamble.length) {
    const preamble = document.createElement("header");
    preamble.className = "law-text-preamble";
    parsed.preamble.forEach((block, index) => {
      if (index === 0 || index === 2) {
        const title = document.createElement(index === 0 ? "h2" : "p");
        title.className = index === 0 ? "law-source-title" : "law-source-subject";
        title.textContent = block.text;
        preamble.append(title);
      } else if (index === 1 && /^TENTANG$/i.test(block.text)) {
        const label = document.createElement("p");
        label.className = "law-source-label";
        label.textContent = block.text;
        preamble.append(label);
      } else {
        appendLawTextBlock(preamble, block);
      }
    });
    content.append(preamble);
  }

  parsed.chapters.forEach((chapter) => {
    const section = document.createElement("section");
    section.className = "law-text-chapter";
    section.id = chapter.id;

    const heading = document.createElement("header");
    heading.className = "law-text-chapter-heading";
    const chapterLabel = document.createElement("p");
    chapterLabel.className = "law-chapter";
    chapterLabel.textContent = chapter.chapter;
    const chapterTitle = document.createElement("h3");
    chapterTitle.textContent = chapter.title;
    heading.append(chapterLabel, chapterTitle);
    section.append(heading);
    chapter.blocks.forEach((block) => appendLawTextBlock(section, block));
    content.append(section);
  });

  if (parsed.appendix.length) {
    const appendix = document.createElement("section");
    appendix.className = "law-text-appendix";
    parsed.appendix.forEach((block) => appendLawTextBlock(appendix, block));
    content.append(appendix);
  }

  target.replaceChildren(content);
}

function renderLawNavigation(navigation, items, title) {
  if (!navigation) return;
  navigation.hidden = false;
  navigation.replaceChildren();

  if (!items.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "law-toc-empty";
    emptyState.textContent = "Navigasi bab belum tersedia untuk dokumen ini.";
    navigation.append(emptyState);
    return;
  }

  const heading = document.createElement("p");
  heading.className = "law-toc-title";
  heading.textContent = title;
  navigation.append(heading);

  items.forEach((item, index) => {
    const id = typeof item.id === "string" && item.id.trim() ? item.id : `topik-${index + 1}`;
    const button = document.createElement("button");
    button.className = "law-toc-link";
    button.type = "button";
    const label = document.createElement("span");
    label.textContent = item.chapter || String(index + 1).padStart(2, "0");
    button.append(label, document.createTextNode(` ${item.title}`));
    button.addEventListener("click", () => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    navigation.append(button);
  });
}

function renderLegislationContent(content) {
  if (!content || typeof content !== "object") return;
  const bills = Array.isArray(content.bills)
    ? content.bills.filter(
        (bill) =>
          bill &&
          bill.sample !== true &&
          !/contoh|ilustrasi/i.test(`${bill.label || ""} ${bill.title || ""} ${bill.description || ""}`),
      )
    : [];
  const billMarkup = bills
    .map((bill, index) => {
      if (!bill || typeof bill.title !== "string") return "";
      const id = typeof bill.id === "string" ? bill.id : `bill-${index + 1}`;
      const documentId = typeof bill.documentId === "string" ? bill.documentId : "";
      const href = documentId
        ? `legislation.html?document=${encodeURIComponent(documentId)}#baca-undang-undang`
        : safeContentHref(bill.url) || `#${encodeURIComponent(id)}`;
      const statusType = ["review", "planning", "enacted"].includes(bill.statusType)
        ? ` status-${bill.statusType}`
        : "";
      return `<a class="bill-row" id="${escapeHtml(id)}" href="${escapeHtml(href)}"${documentId ? ` data-legislation-document="${escapeHtml(documentId)}"` : ""}>
        <span class="bill-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="bill-main"><small>${escapeHtml(bill.label || "Informasi legislasi")}</small><strong>${escapeHtml(bill.title)}</strong>${bill.description ? `<span class="bill-detail">${escapeHtml(bill.description)}</span>` : ""}</span>
        <span class="bill-status${statusType}"><i></i> ${escapeHtml(bill.status || "Belum ditentukan")}</span>
        <b class="bill-arrow">↗</b>
      </a>`;
    })
    .filter(Boolean)
    .join("");
  ["#bill-list", "#all-bills"].forEach((selector) => {
    const target = document.querySelector(selector);
    if (target) {
      target.innerHTML = billMarkup || '<p class="archive-empty">Belum ada data legislasi.</p>';
    }
  });

  const documentTarget = document.querySelector("#law-document-content");
  const tableOfContents = document.querySelector("#law-document-toc");
  let documentRenderVersion = 0;
  const renderDocument = async (documentContent) => {
    if (!documentContent || !documentTarget) return;
    const renderVersion = ++documentRenderVersion;
    const documentDownload = document.querySelector("#law-document-download");
    const configuredDownloadUrl = safeContentHref(documentContent.downloadUrl);
    const previewCandidates = [
      documentContent.textUrl,
      documentContent.previewUrl,
      configuredDownloadUrl,
    ]
      .map(safeContentHref)
      .filter(Boolean);
    const isPdfUrl = (value) => {
      try {
        return /\.pdf$/i.test(new URL(value, window.location.href).pathname);
      } catch {
        return false;
      }
    };
    const textUrl = previewCandidates.find((value) => !isPdfUrl(value)) || "";
    const previewUrl = safeContentHref(documentContent.previewUrl);
    const downloadUrl = configuredDownloadUrl || textUrl || previewUrl;
    if (documentDownload) {
      documentDownload.hidden = !downloadUrl;
      if (downloadUrl) {
        documentDownload.href = downloadUrl;
        const label = document.querySelector("#law-document-download-label");
        const fileType = isPdfUrl(downloadUrl) ? "PDF" : /\.txt$/i.test(new URL(downloadUrl, window.location.href).pathname) ? "TXT" : "dokumen";
        if (label) label.textContent = `Unduh naskah ${fileType}`;
      }
    }
    const documentNote = document.querySelector("#law-document-note");
    if (documentNote && typeof documentContent.note === "string") {
      documentNote.textContent = documentContent.note;
    }

    const sections = Array.isArray(documentContent.sections)
      ? documentContent.sections.filter((section) => section && typeof section.title === "string")
      : [];

    if (textUrl) {
      documentTarget.setAttribute("aria-busy", "true");
      documentTarget.textContent = "Memuat naskah undang-undang…";
      if (tableOfContents) {
        tableOfContents.hidden = false;
        tableOfContents.replaceChildren();
        const status = document.createElement("p");
        status.className = "law-toc-empty";
        status.textContent = "Memuat navigasi bab…";
        tableOfContents.append(status);
      }

      try {
        const sourceUrl = new URL(textUrl, window.location.href);
        if (sourceUrl.origin !== window.location.origin) {
          throw new Error("File naskah harus berasal dari situs yang sama.");
        }
        const response = await fetch(sourceUrl.href);
        if (!response.ok) throw new Error(`Permintaan naskah gagal (${response.status}).`);
        const parsed = parseLawText(await response.text());
        if (documentRenderVersion !== renderVersion) return;
        if (!parsed.chapters.length) {
          throw new Error("Tidak ada judul BAB yang dapat dikenali pada naskah.");
        }
        renderLawTextDocument(documentTarget, documentContent, parsed);
        renderLawNavigation(tableOfContents, parsed.chapters, "Navigasi bab");
      } catch (error) {
        if (documentRenderVersion !== renderVersion) return;
        console.error("Gagal memuat naskah undang-undang:", error);
        const message = document.createElement("p");
        message.className = "law-load-error";
        message.setAttribute("role", "alert");
        message.textContent = "Naskah undang-undang gagal dimuat. Silakan coba kembali atau hubungi pengelola situs.";
        documentTarget.replaceChildren(message);
        if (tableOfContents) {
          const navigationError = document.createElement("p");
          navigationError.className = "law-toc-empty";
          navigationError.textContent = "Navigasi bab tidak tersedia karena naskah gagal dimuat.";
          tableOfContents.replaceChildren(navigationError);
        }
      } finally {
        if (documentRenderVersion === renderVersion) {
          documentTarget.removeAttribute("aria-busy");
        }
      }
      return;
    }

    if (tableOfContents) {
      tableOfContents.hidden = false;
      renderLawNavigation(
        tableOfContents,
        sections.map((section, index) => ({
          ...section,
          id: typeof section.id === "string" ? section.id : `topik-${index + 1}`,
        })),
        "Daftar topik",
      );
    }
    documentTarget.innerHTML = `<div class="law-document-heading">
      <span class="law-document-badge">${escapeHtml(documentContent.badge || "DOKUMEN LEGISLASI")}</span>
      <p>${escapeHtml(documentContent.type || "DOKUMEN")}</p>
      <h3>${escapeHtml(documentContent.title || "")}</h3>
      <p class="law-document-number">${escapeHtml(documentContent.number || "")}</p>
      ${documentContent.subject ? `<h4>TENTANG</h4><p class="law-document-subject">${escapeHtml(documentContent.subject)}</p>` : ""}
      ${documentContent.note ? `<p class="law-document-note">${escapeHtml(documentContent.note)}</p>` : ""}
    </div>${sections
      .map((section, index) => {
        const id = typeof section.id === "string" ? section.id : `topik-${index + 1}`;
        const articles = Array.isArray(section.articles)
          ? section.articles.filter((article) => article && typeof article === "object")
          : [];
        return `<section class="law-topic" id="${escapeHtml(id)}">
          ${section.chapter ? `<p class="law-chapter">${escapeHtml(section.chapter)}</p>` : ""}
          <h4>${escapeHtml(section.title)}</h4>
          ${articles.map((article) => `<p><strong>${escapeHtml(article.number || "")}</strong></p><p>${escapeHtml(article.text || "")}</p>`).join("")}
        </section>`;
      })
      .join("")}
      ${documentContent.endmark ? `<p class="law-endmark">${escapeHtml(documentContent.endmark)}</p>` : ""}`;
  };

  const documents = Array.isArray(content.documents)
    ? content.documents.filter(
        (item) =>
          item &&
          item.sample !== true &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          !/contoh|bukan dokumen resmi/i.test(`${item.badge || ""} ${item.title || ""} ${item.subject || ""}`),
      )
    : [];
  const documentById = new Map(documents.map((item) => [item.id, item]));
  const linkedDocumentId = bills.find(
    (bill) => bill && typeof bill.documentId === "string" && documentById.has(bill.documentId),
  )?.documentId;
  const requestedDocumentId = new URLSearchParams(window.location.search).get("document");
  const initialDocument =
    (requestedDocumentId && documentById.get(requestedDocumentId)) ||
    (typeof content.activeDocumentId === "string" && documentById.get(content.activeDocumentId)) ||
    (linkedDocumentId && documentById.get(linkedDocumentId)) ||
    documents[0];
  renderDocument(initialDocument);

  document.querySelectorAll("#bill-list [data-legislation-document]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const selectedDocument = documentById.get(link.dataset.legislationDocument);
      if (!selectedDocument) return;
      event.preventDefault();
      renderDocument(selectedDocument);
      document.querySelector("#baca-undang-undang")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  const historyRows = Array.isArray(content.history)
    ? content.history.filter(
        (row) =>
          row &&
          row.sample !== true &&
          !/contoh|ilustrasi/i.test(`${row.document || ""} ${row.description || ""}`),
      )
    : [];
  const historyTarget = document.querySelector("#legislation-history-rows");
  if (historyTarget) {
    historyTarget.innerHTML = historyRows.length
      ? historyRows
          .map((row) => {
            const statusClass =
              row.statusType === "submitted"
                ? "status-submitted"
                : row.statusType === "enacted"
                  ? "status-enacted"
                  : "status-in-progress";
            return `<tr><td>${escapeHtml(row.document || "")}</td><td>${escapeHtml(row.topic || "")}</td><td><span class="status-badge ${statusClass}">${escapeHtml(row.status || "")}</span></td><td>${escapeHtml(row.description || "")}</td><td>${escapeHtml(row.updatedAt || "—")}</td></tr>`;
          })
          .join("")
      : '<tr><td colspan="5">Belum ada riwayat perubahan resmi yang tersedia.</td></tr>';
  }

  const processTarget = document.querySelector("#legislation-process-grid");
  if (processTarget && Array.isArray(content.processStages)) {
    processTarget.innerHTML = content.processStages
      .filter((stage) => stage && stage.sample !== true)
      .map(
        (stage, index) =>
          `<article><span>${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(stage.title || "")}</h3><p>${escapeHtml(stage.description || "")}</p></article>`,
      )
      .join("");
  }
}

function renderActivityContent(content) {
  if (!content || typeof content !== "object") return;
  const budget = content.budget || {};
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && typeof value === "string" && value.trim()) element.textContent = value.trim();
  };
  setText("#budget-document-title", budget.title);
  setText("#budget-document-subtitle", budget.subtitle);
  if (!/contoh|ilustrasi|demonstrasi/i.test(budget.notice || "")) {
    setText("#budget-notice", budget.notice);
  }
  setText("#budget-table-title", budget.tableTitle);
  setText("#oversight-notice", content.oversightNotice);
  if (!/contoh|ilustrasi|demonstrasi/i.test(content.galleryNotice || "")) {
    setText("#gallery-notice", content.galleryNotice);
  }

  const previewUrl = /contoh|demonstrasi/i.test(budget.previewUrl || "")
    ? ""
    : safeContentHref(budget.previewUrl);
  const budgetFrame = document.querySelector("#budget-document-preview");
  const budgetOpenLink = document.querySelector("#budget-document-open");
  const budgetDownloadLink = document.querySelector("#budget-document-download");
  if (previewUrl && budgetFrame) {
    budgetFrame.src = previewUrl;
    budgetFrame.title = budget.title || "Dokumen transparansi anggaran";
    budgetFrame.hidden = false;
  }
  if (!previewUrl && budgetFrame) budgetFrame.hidden = true;
  if (budgetOpenLink) {
    budgetOpenLink.hidden = !previewUrl;
    if (previewUrl) budgetOpenLink.href = previewUrl;
  }
  const budgetEmptyNote = document.querySelector(".budget-preview-empty");
  if (budgetEmptyNote) budgetEmptyNote.hidden = Boolean(previewUrl);
  const downloadUrl = safeContentHref(budget.downloadUrl);
  if (budgetDownloadLink) {
    budgetDownloadLink.hidden = !downloadUrl || /contoh|demonstrasi/i.test(budget.downloadUrl || "");
    if (downloadUrl && !budgetDownloadLink.hidden) budgetDownloadLink.href = downloadUrl;
  }

  const budgetRows = Array.isArray(budget.rows)
    ? budget.rows.filter(
        (row) =>
          row &&
          row.sample !== true &&
          !/belum diisi|menunggu dokumen|contoh/i.test(
            `${row.component || ""} ${row.period || ""} ${row.planned || ""} ${row.actual || ""} ${row.note || ""}`,
          ),
      )
    : [];
  const budgetRowsTarget = document.querySelector("#budget-table-rows");
  if (budgetRowsTarget) {
    budgetRowsTarget.innerHTML = budgetRows.length
      ? budgetRows
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.component || "")}</td><td>${escapeHtml(row.period || "")}</td><td>${escapeHtml(row.planned || "")}</td><td>${escapeHtml(row.actual || "")}</td><td>${escapeHtml(row.note || "")}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="5">Belum ada data anggaran.</td></tr>';
  }
  const budgetNotice = document.querySelector("#budget-notice");
  if (budgetNotice && (previewUrl || budgetRows.length)) budgetNotice.hidden = true;

  const oversightItems = Array.isArray(content.oversight)
    ? content.oversight.filter(
        (item) =>
          item &&
          item.sample !== true &&
          !/contoh|ilustrasi|belum ditambahkan/i.test(`${item.title || ""} ${item.description || ""}`),
      )
    : [];
  const oversightTarget = document.querySelector("#oversight-list");
  if (oversightTarget) {
    oversightTarget.innerHTML = oversightItems.length
      ? oversightItems
          .map((item, index) => {
            const fileUrl = safeContentHref(item.fileUrl);
            return `<article class="oversight-card">
              <div class="oversight-index">${String(index + 1).padStart(2, "0")}</div>
              <div class="oversight-main"><p class="eyebrow">${escapeHtml(item.label || "Laporan pengawasan DPM KM UNNES")}</p><h3>${escapeHtml(item.title || "")}</h3><p>${escapeHtml(item.description || "")}</p></div>
              <div class="oversight-status"><span>${escapeHtml(item.status || "")}</span>${fileUrl ? `<a href="${escapeHtml(fileUrl)}" target="_blank" rel="noopener noreferrer">Buka laporan <b aria-hidden="true">↗</b></a>` : ""}</div>
            </article>`;
          })
          .join("")
      : '<p class="archive-empty">Belum ada laporan pengawasan.</p>';
  }
  const oversightNotice = document.querySelector("#oversight-notice");
  if (oversightNotice && oversightItems.length) oversightNotice.hidden = true;

  const galleryItems = Array.isArray(content.gallery)
    ? content.gallery.filter(
        (item) =>
          item &&
          item.sample !== true &&
          !/contoh|ilustrasi/i.test(`${item.caption || ""} ${item.alt || ""}`),
      )
    : [];
  const galleryTarget = document.querySelector("#activity-gallery");
  if (galleryTarget) {
    galleryTarget.innerHTML = galleryItems
      .map((item) => {
        const image = safeImageUrl(item.image);
        if (!image) return "";
        const alt = item.alt || item.title || "Dokumentasi kegiatan DPM KM UNNES";
        return `<figure><a href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" loading="lazy" /></a><figcaption><strong>${escapeHtml(item.title || "")}</strong><span>${escapeHtml(item.caption || "")}</span></figcaption></figure>`;
      })
      .join("");
    if (!galleryTarget.children.length) {
      galleryTarget.innerHTML = '<p class="archive-empty">Belum ada dokumentasi kegiatan resmi.</p>';
    }
  }
  const galleryNotice = document.querySelector("#gallery-notice");
  if (galleryNotice && galleryItems.some((item) => safeImageUrl(item.image))) galleryNotice.hidden = true;
}

function renderArchiveImage(item, imageUrl) {
  const alt = escapeHtml(item.alt || item.title);
  const safeUrl = escapeHtml(imageUrl);
  return `<a class="archive-image-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" aria-label="Buka gambar: ${alt}"><img src="${safeUrl}" alt="${alt}" loading="lazy" /></a>`;
}

function renderArchiveCard(item) {
  const date = isValidArchiveDate(item.date)
    ? archiveDateFormatter.format(new Date(`${item.date}T12:00:00`))
    : /^\d{4}$/.test(item.year || "")
      ? `Tahun ${item.year}`
      : "Tanggal tidak dicantumkan";
  const sampleBadge = item.sample ? '<span class="archive-sample-badge">Contoh</span>' : "";
  const id = escapeHtml(item.id);
  const label = escapeHtml(item.label);
  const title = escapeHtml(item.title);
  const description = escapeHtml(item.description);
  const imageUrl = safeImageUrl(item.image);
  const dateText = escapeHtml(date);

  if (item.category === "news") {
    const image = imageUrl
      ? `<button class="archive-image-link news-detail-trigger" type="button" data-news-id="${id}" aria-label="Baca berita: ${escapeHtml(item.alt || item.title)}"><img src="${imageUrl}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" /></button>`
      : "";
    return `<article class="archive-card archive-record archive-news-card" id="${id}" data-archive-id="${id}">
      ${image}
      <div class="archive-card-body">
        <p class="archive-card-meta"><span>${label}</span><time${isValidArchiveDate(item.date) ? ` datetime="${escapeHtml(item.date)}"` : ""}>${dateText}</time></p>
        <h3><button class="news-detail-title news-detail-trigger" type="button" data-news-id="${id}">${title}</button></h3>
        <p class="archive-card-description">${description}</p>
        <div class="archive-card-footer">${sampleBadge}<button class="news-detail-link news-detail-trigger" type="button" data-news-id="${id}">Baca berita <span aria-hidden="true">→</span></button></div>
      </div>
    </article>`;
  }

  if (imageUrl) {
    return `<article class="archive-card archive-record archive-image-card" id="${id}" data-archive-id="${id}">
      ${renderArchiveImage(item, imageUrl)}
      <div class="archive-card-body">
        <p class="archive-card-meta"><span>${label}</span><time${isValidArchiveDate(item.date) ? ` datetime="${escapeHtml(item.date)}"` : ""}>${dateText}</time></p>
        <h3>${title}</h3>
        <p class="archive-card-description">${description}</p>
        <div class="archive-card-footer">${sampleBadge}<a href="${imageUrl}" target="_blank" rel="noopener noreferrer">Lihat gambar <span aria-hidden="true">↗</span></a></div>
      </div>
    </article>`;
  }

  const fileUrl = safeContentHref(item.file);
  if (fileUrl && item.format) {
    const format = escapeHtml(item.format);
    return `<article class="archive-card archive-record archive-file-card" id="${id}" data-archive-id="${id}">
    <div class="archive-file-preview" aria-hidden="true"><span>${format}</span><small>Dokumen</small></div>
    <div class="archive-card-body">
      <p class="archive-card-meta"><span>${label}</span><time${isValidArchiveDate(item.date) ? ` datetime="${escapeHtml(item.date)}"` : ""}>${dateText}</time></p>
      <h3>${title}</h3>
      <p class="archive-card-description">${description}</p>
      <div class="archive-card-footer">${sampleBadge}<a href="${escapeHtml(fileUrl)}" download>Unduh ${format} <span aria-hidden="true">↓</span></a></div>
    </div>
  </article>`;
  }

  return `<article class="archive-card archive-record" id="${id}" data-archive-id="${id}">
    <div class="archive-card-body">
      <p class="archive-card-meta"><span>${label}</span><time datetime="${escapeHtml(item.date)}">${dateText}</time></p>
      <h3>${title}</h3>
      <p class="archive-card-description">${description}</p>
    </div>
  </article>`;
}

function renderArchiveContent() {
  const archiveTargets = {
    news: archiveNewsGrid,
    laws: document.querySelector("#archive-laws-grid"),
    activities: document.querySelector("#archive-activities-grid"),
  };
  Object.entries(archiveTargets).forEach(([category, target]) => {
    if (!target) return;
    const categoryItems = archiveItemsByDate.filter((item) => item.category === category);
    target.innerHTML = categoryItems.length
      ? categoryItems.map(renderArchiveCard).join("")
      : `<p class="archive-empty">${category === "news" ? "Belum ada berita terbaru." : "Belum ada arsip pada kategori ini."}</p>`;
  });

  if (latestNewsGrid) {
    const newsItems = archiveItemsByDate.filter((item) => item.category === "news");
    const latestMonth = newsItems[0]?.date?.slice(0, 7);
    const latestMonthItems = newsItems.filter((item) => item.date.startsWith(latestMonth));
    latestNewsGrid.innerHTML = latestMonthItems.length
      ? latestMonthItems.map((item, index) => {
        const date = archiveDateFormatter.format(new Date(`${item.date}T12:00:00`));
        const id = escapeHtml(item.id);
        const title = escapeHtml(item.title);
        const description = escapeHtml(item.description);
        const label = escapeHtml(item.label);
        const imageUrl = safeImageUrl(item.image);
        const image = imageUrl
          ? `<button class="news-image archive-home-image news-detail-trigger" type="button" data-news-id="${id}" aria-label="Baca berita: ${escapeHtml(item.alt || item.title)}"><img src="${imageUrl}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" /></button>`
          : "";
        return `<article class="news-card${index === 0 ? " news-featured" : ""}" id="home-${id}">
          ${image}
          <div class="news-copy">
            <p class="news-meta"><span>${label}</span><time datetime="${escapeHtml(item.date)}">${escapeHtml(date)}</time></p>
            <h3><button class="news-detail-title news-detail-trigger" type="button" data-news-id="${id}">${title}</button></h3>
            <p>${description}</p>
            <button class="read-link news-detail-trigger" type="button" data-news-id="${id}">Baca berita <span>→</span></button>
          </div>
        </article>`;
      })
      .join("")
      : '<p class="archive-empty">Belum ada berita terbaru.</p>';

    if (monthlyNewsTitle && latestMonth) {
      const [year, month] = latestMonth.split("-").map(Number);
      monthlyNewsTitle.textContent = `Sorotan ${new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(new Date(year, month - 1, 1))}`;
    } else if (monthlyNewsTitle) {
      monthlyNewsTitle.textContent = "Belum ada berita terbaru";
    }
  }
}

function showNewsLoadError(error) {
  console.error("Berita tidak dapat dimuat dari backend:", error);
  const message = "Berita terbaru tidak dapat dimuat. Silakan coba kembali nanti.";
  if (newsTicker) {
    newsTicker.classList.add("is-empty");
    const [primaryGroup, duplicateGroup] = newsTicker.querySelectorAll(".news-ticker-group");
    primaryGroup.textContent = message;
    duplicateGroup.replaceChildren();
    newsTicker.style.setProperty("--ticker-duration", "0s");
  }
  if (archiveNewsGrid) archiveNewsGrid.innerHTML = `<p class="archive-empty">${message}</p>`;
  if (latestNewsGrid) latestNewsGrid.innerHTML = `<p class="archive-empty">${message}</p>`;
}

updateArchiveItems();
fetch("/api/news?limit=100")
  .then(async (response) => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Permintaan berita gagal (${response.status}).`);
    if (!Array.isArray(result.items)) throw new Error("Respons berita dari server tidak valid.");
    return result.items;
  })
  .then((newsItems) => {
    if (
      newsItems.some(
        (item) =>
          !item ||
          typeof item.id !== "string" ||
          typeof item.title !== "string" ||
          typeof item.description !== "string" ||
          typeof item.label !== "string" ||
          typeof item.date !== "string" ||
          Number.isNaN(Date.parse(`${item.date}T12:00:00`)),
      )
    ) {
      throw new Error("Data berita dari server memiliki format yang tidak valid.");
    }

    newsItemsFromApi = newsItems;
    updateArchiveItems();
  })
  .catch(showNewsLoadError);

const aspirationForm = document.querySelector("#aspiration-form");
if (aspirationForm) {
  const formStatus = document.querySelector("#aspiration-form-status");
  const submitButton = aspirationForm.querySelector('button[type="submit"]');

  aspirationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!formStatus || !submitButton) return;

    const formData = new FormData(aspirationForm);
    if (formData.get("consent") !== "true") {
      formStatus.textContent = "Persetujuan penyimpanan diperlukan untuk mengirim aspirasi.";
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Mengirim aspirasi...";
    formStatus.textContent = "";

    try {
      const response = await fetch("/api/aspirations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          campus: formData.get("campus"),
          email: formData.get("email"),
          topic: formData.get("topic"),
          message: formData.get("message"),
          consent: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Aspirasi gagal dikirim.");

      aspirationForm.reset();
      formStatus.textContent = result.message || "Aspirasi berhasil dikirim dan tersimpan.";
    } catch (error) {
      console.error("Aspirasi gagal dikirim:", error);
      formStatus.textContent =
        error instanceof TypeError
          ? "Server tidak dapat dihubungi. Silakan coba kembali nanti."
          : error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Kirim aspirasi <span aria-hidden="true">→</span>';
    }
  });
}

if (heroTitle && heroDescription && heroImageLayers.length && slideCurrent) {
  const heroDelay = 7000;
  const shouldReduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visibleImageLayer = heroImageLayers.findIndex((layer) => layer.classList.contains("is-active"));
  let heroTimer = null;
  let autoplayPaused = shouldReduceMotion.matches;
  let heroHovered = false;
  let heroFocused = false;
  heroElement?.style.setProperty("--hero-duration", `${heroDelay}ms`);

  if (visibleImageLayer < 0) visibleImageLayer = 0;
  stories.forEach((story) => {
    const image = new Image();
    image.src = story.image;
  });
  heroImageLayers.forEach((layer, index) => {
    layer.classList.toggle("is-active", index === visibleImageLayer);
    if (index === visibleImageLayer) {
      layer.style.backgroundImage = `url("${stories[0].image}")`;
    }
  });

  function updateAutoplayState() {
    const isPaused = autoplayPaused || heroHovered || heroFocused || document.hidden;
    heroElement?.classList.toggle("is-paused", isPaused);
  }

  function stopHeroTimer() {
    if (heroTimer !== null) {
      window.clearTimeout(heroTimer);
      heroTimer = null;
    }
  }

  function scheduleHeroAdvance() {
    stopHeroTimer();
    updateAutoplayState();
    if (autoplayPaused || heroHovered || heroFocused || document.hidden) return;
    heroTimer = window.setTimeout(() => {
      showSlide(activeSlide + 1);
    }, heroDelay);
  }

  function showSlide(index) {
    activeSlide = (index + stories.length) % stories.length;
    const story = stories[activeSlide];
    const nextImageLayer = (visibleImageLayer + 1) % heroImageLayers.length;
    const incomingLayer = heroImageLayers[nextImageLayer];
    const outgoingLayer = heroImageLayers[visibleImageLayer];

    incomingLayer.style.backgroundImage = `url("${story.image}")`;
    incomingLayer.classList.remove("is-active");
    requestAnimationFrame(() => {
      incomingLayer.classList.add("is-active");
      outgoingLayer.classList.remove("is-active");
    });
    visibleImageLayer = nextImageLayer;

    heroElement?.classList.remove("hero-copy-changing");
    void heroTitle.offsetWidth;
    heroElement?.classList.add("hero-copy-changing");
    setMultilineText(heroTitle, story.title);
    heroDescription.textContent = story.description;
    slideCurrent.textContent = String(activeSlide + 1).padStart(2, "0");
    if (slideTotal) slideTotal.textContent = String(stories.length).padStart(2, "0");
    heroDots.forEach((dot, dotIndex) => {
      const active = dotIndex === activeSlide;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
    scheduleHeroAdvance();
  }

  heroDotsContainer?.addEventListener("click", (event) => {
    const dot = event.target.closest(".hero-dot");
    if (dot && heroDotsContainer.contains(dot)) showSlide(Number(dot.dataset.slide));
  });
  document.addEventListener("site-content-loaded", () => {
    heroDots = stories.map((story, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `hero-dot${index === 0 ? " active" : ""}`;
      dot.dataset.slide = String(index);
      dot.setAttribute("aria-label", `Tampilkan berita ${index + 1}`);
      dot.setAttribute("aria-current", index === 0 ? "true" : "false");
      return dot;
    });
    heroDotsContainer?.replaceChildren(...heroDots);
    if (slideTotal) slideTotal.textContent = String(stories.length).padStart(2, "0");
    activeSlide = -1;
    showSlide(0);
  });
  heroElement?.addEventListener("pointermove", () => {
    if (heroHovered) return;
    heroHovered = true;
    scheduleHeroAdvance();
  });
  heroElement?.addEventListener("pointerleave", () => {
    heroHovered = false;
    scheduleHeroAdvance();
  });
  heroElement?.addEventListener("focusin", () => {
    heroFocused = true;
    scheduleHeroAdvance();
  });
  heroElement?.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && heroElement.contains(event.relatedTarget)) return;
    heroFocused = false;
    scheduleHeroAdvance();
  });
  document.addEventListener("visibilitychange", scheduleHeroAdvance);
  shouldReduceMotion.addEventListener("change", (event) => {
    autoplayPaused = event.matches;
    scheduleHeroAdvance();
  });
  scheduleHeroAdvance();
}

const quoteText = document.querySelector("#quote-text");
const quoteAuthor = document.querySelector("#quote-author");
const quoteRole = document.querySelector("#quote-role");
const quoteProgress = document.querySelector(".quote-progress span");
const quoteCard = document.querySelector(".quote-card");
const talksSection = document.querySelector(".talks-section");

if (quoteText && quoteAuthor && quoteRole && quoteProgress && quoteCard) {
  const quoteDelay = 7000;
  const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let quoteTimer = null;
  let quoteHovered = false;
  let quoteFocused = false;

  quoteCard.style.setProperty("--quote-duration", `${quoteDelay}ms`);

  function stopQuoteTimer() {
    if (quoteTimer !== null) {
      window.clearTimeout(quoteTimer);
      quoteTimer = null;
    }
  }

  function scheduleQuoteAdvance() {
    stopQuoteTimer();
    if (!quotes.length) return;
    const isPaused =
      reducedMotionPreference.matches || quoteHovered || quoteFocused || document.hidden;
    quoteCard.classList.toggle("is-paused", isPaused);
    if (isPaused) return;

    quoteTimer = window.setTimeout(() => {
      showQuote(activeQuote + 1);
    }, quoteDelay);
  }

  function showQuote(index) {
    if (!quotes.length) return;
    activeQuote = (index + quotes.length) % quotes.length;
    const quote = quotes[activeQuote];
    quoteCard.classList.remove("quote-changing");
    quoteProgress.classList.remove("is-running");
    void quoteCard.offsetWidth;
    quoteText.textContent = quote.text;
    quoteAuthor.textContent = quote.author;
    quoteRole.textContent = quote.role;
    quoteCard.classList.add("quote-changing");
    quoteProgress.classList.add("is-running");
    scheduleQuoteAdvance();
  }

  document.querySelector(".talk-prev")?.addEventListener("click", () => showQuote(activeQuote - 1));
  document.querySelector(".talk-next")?.addEventListener("click", () => showQuote(activeQuote + 1));
  quoteCard.addEventListener("pointerenter", () => {
    quoteHovered = true;
    scheduleQuoteAdvance();
  });
  quoteCard.addEventListener("pointerleave", () => {
    quoteHovered = false;
    scheduleQuoteAdvance();
  });
  quoteCard.addEventListener("focusin", () => {
    quoteFocused = true;
    scheduleQuoteAdvance();
  });
  quoteCard.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && quoteCard.contains(event.relatedTarget)) return;
    quoteFocused = false;
    scheduleQuoteAdvance();
  });
  document.addEventListener("visibilitychange", scheduleQuoteAdvance);
  reducedMotionPreference.addEventListener("change", scheduleQuoteAdvance);
  document.addEventListener("site-content-loaded", () => {
    if (!quotes.length) return;
    if (talksSection) talksSection.hidden = false;
    showQuote(0);
  });
  if (quotes.length) {
    quoteProgress.classList.add("is-running");
    scheduleQuoteAdvance();
  } else if (talksSection) {
    talksSection.hidden = true;
  }
}

const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector("#mobile-menu");
if (menuToggle && mobileMenu) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", isExpanded ? "Buka menu" : "Tutup menu");
    mobileMenu.hidden = isExpanded;
  });
  mobileMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenu.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Buka menu");
    });
  });
}

const searchToggle = document.querySelector(".search-toggle");
const searchPanel = document.querySelector(".search-panel");
const searchInput = document.querySelector("#site-search");
if (searchToggle && searchPanel && searchInput) {
  searchToggle.addEventListener("click", () => {
    const isExpanded = searchToggle.getAttribute("aria-expanded") === "true";
    searchToggle.setAttribute("aria-expanded", String(!isExpanded));
    searchPanel.hidden = isExpanded;
    if (!isExpanded) searchInput.focus();
  });

  const archiveSections = [...document.querySelectorAll("[data-archive-category]")];
  const archiveFilterButtons = [...document.querySelectorAll("[data-archive-filter]")];
  let activeArchiveCategory = "";

  function showArchiveCategory(category) {
    activeArchiveCategory = category;
    archiveSections.forEach((section) => {
      section.hidden = section.dataset.archiveCategory !== category;
    });
    const activeSection = archiveSections.find((section) => section.dataset.archiveCategory === category);
    activeSection?.querySelectorAll(".motion-reveal").forEach((item) => revealObserver?.observe(item));
    archiveFilterButtons.forEach((button) => {
      const selected = button.dataset.archiveFilter === category;
      button.setAttribute("aria-pressed", String(selected));
    });
    if (searchInput.value.trim()) {
      filterNews(searchInput.value.trim());
    }
  }

  archiveFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.archiveFilter;
      showArchiveCategory(category);
      const section = archiveSections.find((item) => item.dataset.archiveCategory === category);
      if (section) {
        window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}#${section.id}`);
      }
    });
  });

  if (archiveFilterButtons.length) {
    const categoryFromHash = archiveSections.find((section) => `#${section.id}` === window.location.hash);
    const initialCategory = categoryFromHash?.dataset.archiveCategory ?? archiveFilterButtons[0].dataset.archiveFilter;
    showArchiveCategory(initialCategory);
  }

  function filterNews(query) {
    const newsCards = [...document.querySelectorAll(".news-listing .archive-record")];
    const message = document.querySelector(".archive-search-message");
    if (!newsCards.length || !message) return;

    const selectedCards = newsCards.filter(
      (card) => card.closest("[data-archive-category]")?.dataset.archiveCategory === activeArchiveCategory,
    );
    const matches = selectedCards.filter((card) =>
      card.textContent.toLowerCase().includes(query.toLowerCase()),
    );
    selectedCards.forEach((card) => {
      card.hidden = !matches.includes(card);
    });
    message.textContent = matches.length
      ? `${matches.length} arsip ditemukan pada kategori yang dipilih.`
      : "Arsip tidak ditemukan pada kategori yang dipilih. Coba kata kunci lain atau pilih kategori lain.";
    message.hidden = false;
  }

  searchPanel.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    if (document.querySelector(".news-listing")) {
      filterNews(query);
      document.querySelector(".news-listing").scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.location.href = `news.html?q=${encodeURIComponent(query)}`;
  });

  const searchQuery = new URLSearchParams(window.location.search).get("q");
  if (searchQuery && document.querySelector(".news-listing")) {
    searchInput.value = searchQuery;
    filterNews(searchQuery);
  }

  searchInput.addEventListener("input", () => {
    if (searchInput.value.trim()) return;
    document.querySelectorAll(".news-listing .archive-record").forEach((card) => {
      card.hidden = false;
    });
    archiveSections.forEach((section) => {
      section.hidden = section.dataset.archiveCategory !== activeArchiveCategory;
    });
    const message = document.querySelector(".archive-search-message");
    if (message) {
      message.textContent = "";
      message.hidden = true;
    }
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  });
}

const backToTop = document.querySelector(".back-to-top");
if (backToTop) {
  window.addEventListener(
    "scroll",
    () => backToTop.classList.toggle("visible", window.scrollY > 500),
    { passive: true },
  );
  backToTop.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }),
  );
}

const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const rootElement = document.documentElement;
let scrollUpdatePending = false;
function updateScrollProgress() {
  const scrollableHeight = rootElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
  rootElement.style.setProperty("--scroll-progress", String(progress));
  scrollUpdatePending = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (scrollUpdatePending) return;
    scrollUpdatePending = true;
    window.requestAnimationFrame(updateScrollProgress);
  },
  { passive: true },
);
updateScrollProgress();

if ("IntersectionObserver" in window && !reducedMotionPreference.matches) {
  revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -35px 0px" },
  );

  const revealTargets = document.querySelectorAll(
    ".section-heading, .news-card, .service-card, .activity-card, .oversight-card, .activity-gallery figure, .person-card, .law-document, .budget-document-frame, .org-chart, .quote-card, .video-feature, .aspiration-layout, .contact-layout, .about-band-inner, .archive-card, .process-grid article, .status-table-wrap",
  );
  revealTargets.forEach((item, index) => {
    item.classList.add("motion-reveal");
    item.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 45}ms`);
    revealObserver.observe(item);
  });
  rootElement.classList.add("motion-enabled");
}

const supportsFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
if (!reducedMotionPreference.matches && supportsFinePointer.matches) {
  const hoverTargets = document.querySelectorAll(
    ".archive-card, .person-card, .activity-card, .oversight-card, .activity-gallery figure, .service-card, .quote-card, .video-feature, .law-document, .budget-document-frame, .process-grid article, .pillar-card",
  );
  hoverTargets.forEach((item) => {
    item.classList.add("motion-hover");
    item.addEventListener("pointermove", (event) => {
      const bounds = item.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      item.style.setProperty("--pointer-x", `${(x * 100).toFixed(1)}%`);
      item.style.setProperty("--pointer-y", `${(y * 100).toFixed(1)}%`);
    });
    item.addEventListener("pointerleave", () => {
      item.style.setProperty("--pointer-x", "50%");
      item.style.setProperty("--pointer-y", "50%");
    });
  });

  const hero = document.querySelector(".hero");
  if (hero) {
    hero.addEventListener("pointermove", (event) => {
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      hero.style.setProperty("--hero-pointer-x", `${(x * -4).toFixed(2)}px`);
      hero.style.setProperty("--hero-pointer-y", `${(y * -3).toFixed(2)}px`);
    });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--hero-pointer-x", "0px");
      hero.style.setProperty("--hero-pointer-y", "0px");
    });
  }
}
