const stories = [
  {
    title: "Suara Parlemen<br />Adikara.",
    description:
      "Bekerja bersama untuk menyerap aspirasi, merumuskan kebijakan, dan membangun masa depan Indonesia.",
    image:
      "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=2200&q=85",
  },
  {
    title: "Membangun kemajuan<br />melalui dialog.",
    description:
      "Gagasan dari seluruh penjuru negeri bertemu untuk merumuskan kebijakan yang membawa Indonesia maju.",
    image:
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=2200&q=85",
  },
  {
    title: "Parlemen Adikara terbuka,<br />lebih dekat.",
    description:
      "Kenali kerja DPM KM UNNES dan ikut serta dalam percakapan yang membentuk masa depan Indonesia.",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=85",
  },
];

const quotes = [
  {
    text: "“Kebijakan yang baik berawal dari mendengarkan masyarakat yang terdampak.”",
    author: "Suara dari DPM KM UNNES",
    role: "Anggota DPM KM UNNES",
  },
  {
    text: "“Partisipasi publik menjadikan demokrasi lebih terbuka dan tanggap.”",
    author: "Suara dari DPM KM UNNES",
    role: "Anggota DPM KM UNNES",
  },
  {
    text: "“Kerja Parlemen Adikara adalah komitmen bersama untuk masa depan yang lebih baik.”",
    author: "Suara dari DPM KM UNNES",
    role: "Anggota DPM KM UNNES",
  },
];

const heroTitle = document.querySelector("#hero-title");
const heroDescription = document.querySelector("#hero-description");
const heroElement = document.querySelector(".hero");
const heroImageLayers = [...document.querySelectorAll(".hero-image")];
const slideCurrent = document.querySelector("#slide-current");
const heroDots = [...document.querySelectorAll(".hero-dot")];
let activeSlide = 0;
let activeQuote = 0;

const monthlyNewsTitle = document.querySelector("#monthly-news-title");
let revealObserver = null;
const archiveDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const staticArchiveItems =
  typeof archiveItems === "undefined" ? [] : archiveItems.filter((item) => item.category !== "news");
let archiveItemsByDate = [...staticArchiveItems].sort((first, second) =>
  second.date.localeCompare(first.date),
);

const newsTicker = document.querySelector("#latest-news-ticker");
const archiveNewsGrid = document.querySelector("#archive-news-grid");
const latestNewsGrid = document.querySelector("#latest-news-grid");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[character];
  });
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

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

function renderArchiveImage(item, imageUrl) {
  const alt = escapeHtml(item.alt || item.title);
  return `<a class="archive-image-link" href="${imageUrl}" target="_blank" rel="noopener noreferrer" aria-label="Buka gambar: ${alt}"><img src="${imageUrl}" alt="${alt}" loading="lazy" /></a>`;
}

function renderArchiveCard(item) {
  const date = archiveDateFormatter.format(new Date(`${item.date}T12:00:00`));
  const sampleBadge = item.sample ? '<span class="archive-sample-badge">Contoh</span>' : "";
  const id = escapeHtml(item.id);
  const label = escapeHtml(item.label);
  const title = escapeHtml(item.title);
  const description = escapeHtml(item.description);
  const imageUrl = safeImageUrl(item.image);
  const dateText = escapeHtml(date);

  if (imageUrl) {
    return `<article class="archive-card archive-record archive-image-card" id="${id}" data-archive-id="${id}">
      ${renderArchiveImage(item, imageUrl)}
      <div class="archive-card-body">
        <p class="archive-card-meta"><span>${label}</span><time datetime="${escapeHtml(item.date)}">${dateText}</time></p>
        <h3>${title}</h3>
        <p class="archive-card-description">${description}</p>
        <div class="archive-card-footer">${sampleBadge}<a href="${imageUrl}" target="_blank" rel="noopener noreferrer">Lihat gambar <span aria-hidden="true">↗</span></a></div>
      </div>
    </article>`;
  }

  if (item.file && item.format) {
    const format = escapeHtml(item.format);
    return `<article class="archive-card archive-record archive-file-card" id="${id}" data-archive-id="${id}">
    <div class="archive-file-preview" aria-hidden="true"><span>${format}</span><small>Dokumen</small></div>
    <div class="archive-card-body">
      <p class="archive-card-meta"><span>${label}</span><time datetime="${escapeHtml(item.date)}">${dateText}</time></p>
      <h3>${title}</h3>
      <p class="archive-card-description">${description}</p>
      <div class="archive-card-footer">${sampleBadge}<a href="${escapeHtml(item.file)}" download>Unduh ${format} <span aria-hidden="true">↓</span></a></div>
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
      : category === "news"
        ? '<p class="archive-empty">Belum ada berita terbaru.</p>'
        : "";
  });

  if (latestNewsGrid) {
    const newsItems = archiveItemsByDate.filter((item) => item.category === "news");
    const latestMonth = newsItems[0]?.date.slice(0, 7);
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
          ? `<a class="news-image archive-home-image" href="news.html#${encodeURIComponent(item.id)}" aria-label="Lihat arsip gambar: ${escapeHtml(item.alt || item.title)}"><img src="${imageUrl}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy" /></a>`
          : "";
        return `<article class="news-card${index === 0 ? " news-featured" : ""}" id="home-${id}">
          ${image}
          <div class="news-copy">
            <p class="news-meta"><span>${label}</span><time datetime="${escapeHtml(item.date)}">${escapeHtml(date)}</time></p>
            <h3><a href="news.html#${encodeURIComponent(item.id)}">${title}</a></h3>
            <p>${description}</p>
            <a class="read-link" href="news.html#${encodeURIComponent(item.id)}">Lihat arsip <span>→</span></a>
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

renderNewsTicker();
renderArchiveContent();
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

    archiveItemsByDate = [...staticArchiveItems, ...newsItems].sort((first, second) =>
      second.date.localeCompare(first.date),
    );
    renderNewsTicker();
    renderArchiveContent();
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
      formStatus.textContent = "Persetujuan penyimpanan data diperlukan untuk mengirim aspirasi.";
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
      formStatus.textContent = result.message || "Aspirasi berhasil dikirim.";
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
    heroTitle.innerHTML = story.title;
    heroDescription.textContent = story.description;
    slideCurrent.textContent = String(activeSlide + 1).padStart(2, "0");
    heroDots.forEach((dot, dotIndex) => {
      const active = dotIndex === activeSlide;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
    scheduleHeroAdvance();
  }

  heroDots.forEach((dot) => {
    dot.addEventListener("click", () => showSlide(Number(dot.dataset.slide)));
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
    const isPaused =
      reducedMotionPreference.matches || quoteHovered || quoteFocused || document.hidden;
    quoteCard.classList.toggle("is-paused", isPaused);
    if (isPaused) return;

    quoteTimer = window.setTimeout(() => {
      showQuote(activeQuote + 1);
    }, quoteDelay);
  }

  function showQuote(index) {
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
  quoteProgress.classList.add("is-running");
  scheduleQuoteAdvance();
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
    item.style.setProperty("--reveal-delay", `${Math.min(index % 5, 4) * 85}ms`);
    revealObserver.observe(item);
  });
  rootElement.classList.add("motion-enabled");
}

const supportsHoverTilt = window.matchMedia("(hover: hover) and (pointer: fine)");
if (!reducedMotionPreference.matches && supportsHoverTilt.matches) {
  const tiltTargets = document.querySelectorAll(
    ".archive-card, .person-card, .activity-card, .oversight-card, .activity-gallery figure, .service-card, .quote-card, .video-feature, .law-document, .budget-document-frame, .process-grid article, .pillar-card",
  );
  tiltTargets.forEach((item) => {
    item.classList.add("motion-tilt");
    item.addEventListener("pointermove", (event) => {
      const bounds = item.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      item.style.setProperty("--tilt-x", `${(y * -3.2).toFixed(2)}deg`);
      item.style.setProperty("--tilt-y", `${(x * 3.2).toFixed(2)}deg`);
      item.style.setProperty("--pointer-x", `${(x + 0.5) * 100}%`);
      item.style.setProperty("--pointer-y", `${(y + 0.5) * 100}%`);
    });
    item.addEventListener("pointerleave", () => {
      item.style.setProperty("--tilt-x", "0deg");
      item.style.setProperty("--tilt-y", "0deg");
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
      hero.style.setProperty("--hero-pointer-x", `${(x * -10).toFixed(2)}px`);
      hero.style.setProperty("--hero-pointer-y", `${(y * -8).toFixed(2)}px`);
    });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--hero-pointer-x", "0px");
      hero.style.setProperty("--hero-pointer-y", "0px");
    });
  }
}
