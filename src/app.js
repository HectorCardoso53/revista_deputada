import { PageFlip } from "page-flip";
import "./styles.css";

await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const appShell = document.querySelector("#appShell");
const bookElement = document.querySelector("#book");
const bookStage = document.querySelector("#bookStage");
const pages = [...document.querySelectorAll(".page")];
const total = pages.length;
const pageTitles = pages.map((page) => page.dataset.title || "Página");

const controls = {
  prev: [document.querySelector("#prevButton"), document.querySelector("#prevEdge")],
  next: [document.querySelector("#nextButton"), document.querySelector("#nextEdge")],
  first: document.querySelector("#firstButton"),
  last: document.querySelector("#lastButton"),
  input: document.querySelector("#pageInput"),
  total: document.querySelector("#pageTotal"),
  section: document.querySelector("#sectionName"),
};

controls.total.textContent = String(total);

function getPageSize() {
  const compact = window.innerWidth <= 820;
  const shortDesktop = !compact && window.innerHeight <= 700;
  const topbarHeight = compact ? 60 : shortDesktop ? 58 : 68;
  const readerHeadHeight = shortDesktop ? 34 : 42;
  const dockHeight = compact ? 60 : shortDesktop ? 56 : 64;
  const stageWidth = bookStage.clientWidth - (compact ? 26 : 118);
  const stageHeight = window.innerHeight - topbarHeight - readerHeadHeight - dockHeight - 16;
  const fullPageWidth = Math.min(402, Math.floor(stageHeight * 0.4725));
  const showSpread = stageWidth >= fullPageWidth * 2;
  const maxPageWidth = showSpread ? stageWidth / 2 : stageWidth;
  let height = Math.min(850, stageHeight, maxPageWidth / 0.4725);
  height = Math.max(370, height);
  const width = Math.round(height * 0.4725);
  return { width, height: Math.round(height), bookWidth: width * (showSpread ? 2 : 1) };
}

const pageSize = getPageSize();
document.querySelector(".book-wrap").style.width = `${pageSize.bookWidth}px`;
const pageFlip = new PageFlip(bookElement, {
  width: pageSize.width,
  height: pageSize.height,
  size: "stretch",
  minWidth: 170,
  maxWidth: 402,
  minHeight: 360,
  maxHeight: 850,
  maxShadowOpacity: 0.35,
  showCover: true,
  mobileScrollSupport: true,
  usePortrait: true,
  autoSize: true,
  drawShadow: true,
  flippingTime: 620,
  swipeDistance: 16,
  showPageCorners: true,
  clickEventForward: true,
  disableFlipByClick: true,
});

pageFlip.loadFromHTML(pages);

const flipSurface = bookElement.querySelector(".stf__block");
flipSurface?.addEventListener("mousedown", (event) => {
  if (event.target.closest("button, a")) return;
  const rect = flipSurface.getBoundingClientRect();
  const edge = Math.min(64, rect.width * 0.14);
  const x = event.clientX - rect.left;
  if (x > edge && x < rect.width - edge) event.stopImmediatePropagation();
}, true);

function goToPage(index) {
  const safeIndex = Math.max(0, Math.min(total - 1, Number(index) || 0));
  pageFlip.turnToPage(safeIndex);
  closeMobileSidebar();
}

function buildThumbnails() {
  const list = document.querySelector("#thumbnailList");
  const fragment = document.createDocumentFragment();
  pages.forEach((page, index) => {
    const button = document.createElement("button");
    const image = page.querySelector(".source-page");
    button.type = "button";
    button.className = "thumbnail";
    button.dataset.page = String(index);
    button.dataset.search = `${page.dataset.search || ""} ${page.dataset.title || ""}`.toLocaleLowerCase("pt-BR");
    button.setAttribute("aria-label", `Ir para a página ${index + 1}: ${pageTitles[index]}`);
    button.innerHTML = `
      <span class="thumbnail-preview">
        ${image ? `<img src="${image.getAttribute("src")}" alt="" loading="lazy">` : `<span class="thumbnail-placeholder">${pageTitles[index]}</span>`}
        <span class="thumbnail-index">${index + 1}</span>
      </span>
      <span class="thumbnail-title">${pageTitles[index]}</span>`;
    button.addEventListener("click", () => goToPage(index));
    fragment.appendChild(button);
  });
  list.appendChild(fragment);
}

buildThumbnails();

function updateReader() {
  const index = pageFlip.getCurrentPageIndex();
  const landscape = pageFlip.getOrientation() === "landscape";
  const offset = landscape
    ? (index === 0 ? -pageFlip.getBoundsRect().pageWidth / 2 : index >= total - 1 ? pageFlip.getBoundsRect().pageWidth / 2 : 0)
    : 0;
  bookElement.style.transform = `translateX(${offset}px)`;
  controls.input.value = String(index + 1);
  controls.section.textContent = pageTitles[index] || "Página";
  controls.prev.forEach((button) => { button.disabled = index === 0; });
  controls.next.forEach((button) => { button.disabled = index >= total - 1; });
  controls.first.disabled = index === 0;
  controls.last.disabled = index >= total - 1;
  document.querySelectorAll(".thumbnail").forEach((thumb) => {
    const active = Number(thumb.dataset.page) === index;
    thumb.classList.toggle("active", active);
    thumb.setAttribute("aria-current", active ? "page" : "false");
  });
  const activeThumb = document.querySelector(`.thumbnail[data-page="${index}"]`);
  activeThumb?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

pageFlip.on("flip", updateReader);
pageFlip.on("changeOrientation", updateReader);
controls.prev.forEach((button) => button.addEventListener("click", () => pageFlip.flipPrev()));
controls.next.forEach((button) => button.addEventListener("click", () => pageFlip.flipNext()));
controls.first.addEventListener("click", () => goToPage(0));
controls.last.addEventListener("click", () => goToPage(total - 1));
controls.input.addEventListener("change", () => goToPage(Number(controls.input.value) - 1));
controls.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    goToPage(Number(controls.input.value) - 1);
    controls.input.blur();
  }
});

document.querySelectorAll(".summary-list [data-page]").forEach((button) => {
  button.addEventListener("click", () => goToPage(button.dataset.page));
});

const pageSearch = document.querySelector("#pageSearch");
const emptySearch = document.querySelector("#emptySearch");
function filterPages() {
  const query = pageSearch.value.trim().toLocaleLowerCase("pt-BR");
  let visible = 0;
  document.querySelectorAll(".thumbnail").forEach((thumb) => {
    const matches = !query || thumb.dataset.search.includes(query);
    thumb.hidden = !matches;
    if (matches) visible += 1;
  });
  emptySearch.hidden = visible > 0;
}
pageSearch.addEventListener("input", filterPages);

document.querySelectorAll(".sidebar-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".sidebar-tab").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".sidebar-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tab.dataset.panel));
  });
});

document.querySelector("#sidebarButton").addEventListener("click", () => appShell.classList.toggle("sidebar-collapsed"));
const menuButton = document.querySelector("#menuButton");
function openMobileSidebar() {
  appShell.classList.add("mobile-sidebar-open");
  menuButton.setAttribute("aria-expanded", "true");
  window.setTimeout(() => pageSearch.focus(), 180);
}
function closeMobileSidebar() {
  appShell.classList.remove("mobile-sidebar-open");
  menuButton.setAttribute("aria-expanded", "false");
}
menuButton.addEventListener("click", openMobileSidebar);
document.querySelector("#closeSidebar").addEventListener("click", closeMobileSidebar);
document.querySelector("#sidebarBackdrop").addEventListener("click", closeMobileSidebar);

let readerZoom = 1;
function setReaderZoom(value) {
  readerZoom = Math.max(0.8, Math.min(1.3, value));
  document.querySelector("#bookTransform").style.setProperty("--reader-zoom", readerZoom);
  document.querySelector("#zoomValue").textContent = `${Math.round(readerZoom * 100)}%`;
  document.querySelector("#zoomOut").disabled = readerZoom <= 0.8;
  document.querySelector("#zoomIn").disabled = readerZoom >= 1.3;
}
document.querySelector("#zoomOut").addEventListener("click", () => setReaderZoom(readerZoom - 0.1));
document.querySelector("#zoomIn").addEventListener("click", () => setReaderZoom(readerZoom + 0.1));

const fullscreenButton = document.querySelector("#fullscreenButton");
fullscreenButton.addEventListener("click", async () => {
  if (!document.fullscreenElement) await appShell.requestFullscreen?.();
  else await document.exitFullscreen?.();
});
document.addEventListener("fullscreenchange", () => {
  fullscreenButton.setAttribute("aria-label", document.fullscreenElement ? "Sair da tela cheia" : "Entrar em tela cheia");
});

const imageViewer = document.querySelector("#imageViewer");
const viewerImage = document.querySelector("#viewerImage");
const viewerTitle = document.querySelector("#viewerTitle");
let lastZoomTrigger = null;
function openImageViewer(button) {
  const page = button.closest(".page");
  const image = page?.querySelector(".source-page");
  if (!image) return;
  lastZoomTrigger = button;
  viewerImage.src = image.currentSrc || image.src;
  viewerImage.alt = image.alt;
  viewerTitle.textContent = page.dataset.title || "Página ampliada";
  imageViewer.classList.add("open");
  imageViewer.setAttribute("aria-hidden", "false");
  document.querySelector("#closeViewer").focus();
}
function closeImageViewer() {
  imageViewer.classList.remove("open");
  imageViewer.setAttribute("aria-hidden", "true");
  viewerImage.removeAttribute("src");
  lastZoomTrigger?.focus();
}
document.querySelectorAll("[data-zoom]").forEach((button) => button.addEventListener("click", (event) => {
  event.stopPropagation();
  openImageViewer(button);
}));
document.querySelector("#closeViewer").addEventListener("click", closeImageViewer);
imageViewer.addEventListener("click", (event) => { if (event.target === imageViewer) closeImageViewer(); });

const toast = document.querySelector("#toast");
let toastTimer;
function showToast(message) {
  toast.querySelector("span").textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
document.querySelector("#shareButton").addEventListener("click", async () => {
  const shareData = {
    title: "Renata Fonseca — Minha História",
    text: "Uma trajetória de trabalho, compromisso e dedicação às pessoas.",
    url: window.location.href,
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copiado");
    }
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Não foi possível compartilhar");
  }
});

document.addEventListener("keydown", (event) => {
  if (imageViewer.classList.contains("open")) {
    if (event.key === "Escape") closeImageViewer();
    return;
  }
  if (event.key === "/" && document.activeElement !== pageSearch && document.activeElement !== controls.input) {
    event.preventDefault();
    if (window.innerWidth <= 820) openMobileSidebar();
    else appShell.classList.remove("sidebar-collapsed");
    pageSearch.focus();
    return;
  }
  if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if (event.key === "ArrowRight" || event.key === "PageDown") pageFlip.flipNext();
  if (event.key === "ArrowLeft" || event.key === "PageUp") pageFlip.flipPrev();
  if (event.key === "Home") goToPage(0);
  if (event.key === "End") goToPage(total - 1);
  if (event.key === "Escape") closeMobileSidebar();
});

updateReader();
setReaderZoom(1);
requestAnimationFrame(() => appShell.classList.add("ready"));
