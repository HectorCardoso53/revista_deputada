import { PageFlip } from "page-flip";
import "./styles.css";

await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const appShell = document.querySelector("#appShell");
const bookElement = document.querySelector("#book");
const bookStage = document.querySelector("#bookStage");
const bookWrap = document.querySelector(".book-wrap");
const pages = [...document.querySelectorAll(".page")];
const total = pages.length;
const pageTitles = pages.map((page) => page.dataset.title || "Página");

pages.forEach((page) => { page.dataset.density = "hard"; });
await document.fonts?.ready;
await Promise.all(pages.flatMap((page) => [...page.querySelectorAll("img")]).map((image) => image.decode ? image.decode().catch(() => undefined) : Promise.resolve()));

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
bookWrap.style.width = `${pageSize.bookWidth}px`;
const pageFlip = new PageFlip(bookElement, {
  width: pageSize.width,
  height: pageSize.height,
  size: "stretch",
  minWidth: 170,
  maxWidth: 402,
  minHeight: 360,
  maxHeight: 850,
  maxShadowOpacity: 0.46,
  showCover: true,
  mobileScrollSupport: true,
  usePortrait: true,
  autoSize: true,
  drawShadow: true,
  flippingTime: 760,
  swipeDistance: 16,
  showPageCorners: false,
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

let pinchStartDist = 0;
let pinchStartZoom = 1;

function touchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

bookStage.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2) {
    pinchStartDist = touchDist(e.touches);
    pinchStartZoom = readerZoom;
  }
}, { passive: true });

bookStage.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    setReaderZoom(pinchStartZoom * (touchDist(e.touches) / pinchStartDist));
  }
}, { passive: true });

let lastBookTap = 0;
bookStage.addEventListener("touchend", (e) => {
  if (e.target.closest("button, a")) return;
  if (e.changedTouches.length === 1 && e.touches.length === 0) {
    const now = Date.now();
    if (now - lastBookTap < 300) {
      setReaderZoom(readerZoom > 1 ? 1 : 1.3);
      lastBookTap = 0;
    } else { lastBookTap = now; }
  }
}, { passive: true });

function goToPage(index) {
  const parsed = Number(index);
  if (!Number.isFinite(parsed)) return;
  const safeIndex = Math.max(0, Math.min(total - 1, Math.round(parsed)));
  if (pageFlip.getState() === "read" && safeIndex !== pageFlip.getCurrentPageIndex()) {
    runProgrammaticFlip(() => pageFlip.flip(safeIndex, "top"));
  }
  closeMobileSidebar();
}

let activeDirection = 0;
let queuedDirection = 0;

function runProgrammaticFlip(callback) {
  const settings = pageFlip.getSettings();
  const clickWasDisabled = settings.disableFlipByClick;
  settings.disableFlipByClick = false;
  try {
    callback();
  } finally {
    settings.disableFlipByClick = clickWasDisabled;
  }
}

function runFlip(direction) {
  activeDirection = direction;
  runProgrammaticFlip(() => {
    if (direction < 0) pageFlip.flipPrev("top");
    else pageFlip.flipNext("top");
  });
}

function navigateBy(direction) {
  if (pageFlip.getState() === "read") {
    runFlip(direction);
    return;
  }

  // A real touch can arrive while the page is finishing a fold. Keep the
  // opposite navigation request instead of silently discarding the tap.
  if (direction !== activeDirection) queuedDirection = direction;
}

function flipPrevious() {
  navigateBy(-1);
}

function flipNext() {
  navigateBy(1);
}

const thumbnails = [];
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
    thumbnails.push(button);
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
  thumbnails.forEach((thumb, thumbIndex) => {
    const active = thumbIndex === index;
    thumb.classList.toggle("active", active);
    thumb.setAttribute("aria-current", active ? "page" : "false");
  });
  thumbnails[index]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

pageFlip.on("flip", updateReader);
pageFlip.on("changeOrientation", updateReader);
pageFlip.on("changeState", (event) => {
  bookElement.dataset.state = event.data;
  if (event.data !== "read") return;

  const pendingDirection = queuedDirection;
  activeDirection = 0;
  queuedDirection = 0;
  if (pendingDirection) requestAnimationFrame(() => navigateBy(pendingDirection));
});
controls.prev.forEach((button) => {
  button.addEventListener("click", flipPrevious);
  button.addEventListener("touchend", (e) => { e.preventDefault(); e.stopPropagation(); flipPrevious(); }, { passive: false });
});
controls.next.forEach((button) => {
  button.addEventListener("click", flipNext);
  button.addEventListener("touchend", (e) => { e.preventDefault(); e.stopPropagation(); flipNext(); }, { passive: false });
});
controls.first.addEventListener("click", () => goToPage(0));
controls.last.addEventListener("click", () => goToPage(total - 1));
function submitPageInput() {
  const requested = Number(controls.input.value.trim());
  // Um valor inválido deve devolver o número atual, e não empurrar o leitor para a capa.
  if (!Number.isFinite(requested) || controls.input.value.trim() === "") {
    controls.input.value = String(pageFlip.getCurrentPageIndex() + 1);
    return;
  }
  // Um pedido fora do intervalo é limitado silenciosamente, e goToPage é ignorado durante
  // uma virada em curso: em ambos os casos o campo precisa refletir o destino real.
  const target = Math.max(0, Math.min(total - 1, Math.round(requested) - 1));
  const accepted = pageFlip.getState() === "read";
  goToPage(target);
  controls.input.value = String((accepted ? target : pageFlip.getCurrentPageIndex()) + 1);
}
controls.input.addEventListener("change", submitPageInput);
controls.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitPageInput();
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
  thumbnails.forEach((thumb) => {
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
menuButton.addEventListener("click", () => {
  if (appShell.classList.contains("mobile-sidebar-open")) closeMobileSidebar();
  else openMobileSidebar();
});
document.querySelector("#closeSidebar").addEventListener("click", closeMobileSidebar);
document.querySelector("#sidebarBackdrop").addEventListener("click", closeMobileSidebar);

const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.3;
let readerZoom = 1;
function setReaderZoom(value) {
  // Sem o arredondamento, somas de 0.1 param em 1.2999999999999998 e os botões nunca desativam.
  readerZoom = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value)) * 100) / 100;
  document.querySelector("#bookTransform").style.setProperty("--reader-zoom", readerZoom);
  document.querySelector("#zoomValue").textContent = `${Math.round(readerZoom * 100)}%`;
  document.querySelector("#zoomOut").disabled = readerZoom <= ZOOM_MIN;
  document.querySelector("#zoomIn").disabled = readerZoom >= ZOOM_MAX;
}
document.querySelector("#zoomOut").addEventListener("click", () => setReaderZoom(readerZoom - 0.1));
document.querySelector("#zoomIn").addEventListener("click", () => setReaderZoom(readerZoom + 0.1));

const fullscreenButton = document.querySelector("#fullscreenButton");
fullscreenButton.addEventListener("click", async () => {
  try {
    // O visualizador de imagem e o toast ficam fora de #appShell; a tela cheia precisa ser
    // do documento inteiro, senão eles somem quando o leitor está em fullscreen.
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  } catch {
    showToast("Tela cheia indisponível neste navegador");
  }
});
document.addEventListener("fullscreenchange", () => {
  const isFullscreen = !!document.fullscreenElement;
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia");
  if (window.innerWidth <= 820) {
    appShell.classList.toggle("reading-fullscreen", isFullscreen);
    lastSizeSignature = "";
    syncBookLayout();
  }
});

const imageViewer = document.querySelector("#imageViewer");
const viewerImage = document.querySelector("#viewerImage");
const viewerTitle = document.querySelector("#viewerTitle");
let lastZoomTrigger = null;

let vScale = 1, vPanX = 0, vPanY = 0;
let vPinchDist0 = 0, vPinchScale0 = 1;
let vDragX0 = 0, vDragY0 = 0, vPanX0 = 0, vPanY0 = 0;
let vLastTap = 0;

function applyViewerTransform() {
  viewerImage.style.transform = `scale(${vScale}) translate(${vPanX}px,${vPanY}px)`;
  viewerImage.style.cursor = vScale > 1 ? "grab" : "";
}
function resetViewerTransform() {
  vScale = 1; vPanX = 0; vPanY = 0;
  viewerImage.style.transform = "";
  viewerImage.style.cursor = "";
}

imageViewer.addEventListener("touchstart", (e) => {
  viewerImage.style.transition = "none";
  if (e.touches.length === 2) {
    vPinchDist0 = touchDist(e.touches);
    vPinchScale0 = vScale;
  } else if (e.touches.length === 1) {
    vDragX0 = e.touches[0].clientX;
    vDragY0 = e.touches[0].clientY;
    vPanX0 = vPanX; vPanY0 = vPanY;
  }
}, { passive: true });

imageViewer.addEventListener("touchmove", (e) => {
  if (e.touches.length === 2) {
    e.preventDefault();
    vScale = Math.max(1, Math.min(5, vPinchScale0 * (touchDist(e.touches) / vPinchDist0)));
    applyViewerTransform();
  } else if (e.touches.length === 1 && vScale > 1) {
    e.preventDefault();
    vPanX = vPanX0 + (e.touches[0].clientX - vDragX0) / vScale;
    vPanY = vPanY0 + (e.touches[0].clientY - vDragY0) / vScale;
    applyViewerTransform();
  }
}, { passive: false });

imageViewer.addEventListener("touchend", (e) => {
  if (e.changedTouches.length === 1 && e.touches.length === 0) {
    const now = Date.now();
    const dx = Math.abs(e.changedTouches[0].clientX - vDragX0);
    const dy = Math.abs(e.changedTouches[0].clientY - vDragY0);
    if (dx < 10 && dy < 10 && now - vLastTap < 300) {
      vScale > 1 ? resetViewerTransform() : (vScale = 2.5, applyViewerTransform());
      vLastTap = 0;
    } else { vLastTap = now; }
  }
}, { passive: true });

function openImageViewer(button) {
  const page = button.closest(".page");
  const image = page?.querySelector(".source-page");
  if (!image) return;
  lastZoomTrigger = button;
  viewerImage.src = image.currentSrc || image.src;
  viewerImage.alt = image.alt;
  viewerTitle.textContent = page.dataset.title || "Página ampliada";
  resetViewerTransform();
  imageViewer.classList.add("open");
  imageViewer.setAttribute("aria-hidden", "false");
  document.querySelector("#closeViewer").focus();
}
function closeImageViewer() {
  imageViewer.classList.remove("open");
  imageViewer.setAttribute("aria-hidden", "true");
  viewerImage.removeAttribute("src");
  resetViewerTransform();
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
    // navigator.clipboard só existe em contexto seguro (https ou localhost).
    else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Link copiado");
    } else {
      showToast("Copie o link da barra de endereços");
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
  if (event.key === "Escape") {
    closeMobileSidebar();
    return;
  }
  // Com o sumário aberto em telas pequenas as setas pertencem à lista, não ao livro.
  if (appShell.classList.contains("mobile-sidebar-open")) return;
  if (event.key === "ArrowRight" || event.key === "PageDown") flipNext();
  if (event.key === "ArrowLeft" || event.key === "PageUp") flipPrevious();
  if (event.key === "Home") goToPage(0);
  if (event.key === "End") goToPage(total - 1);
});

let resizeFrame = 0;
const sizeSignature = (size) => `${size.width}x${size.height}x${size.bookWidth}`;
let lastSizeSignature = sizeSignature(pageSize);
function syncBookLayout() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const nextSize = getPageSize();
    // syncBookLayout redimensiona um filho de #bookStage, que é o próprio alvo do
    // ResizeObserver. Sem esta guarda o observador se realimenta a cada quadro.
    const signature = sizeSignature(nextSize);
    if (signature === lastSizeSignature) return;
    lastSizeSignature = signature;
    bookWrap.style.width = `${nextSize.bookWidth}px`;
    pageFlip.update();
    updateReader();
  });
}
window.addEventListener("resize", syncBookLayout);
const bookStageObserver = new ResizeObserver(syncBookLayout);
bookStageObserver.observe(bookStage);

updateReader();
setReaderZoom(1);
requestAnimationFrame(() => {
  appShell.classList.add("ready");
  appShell.setAttribute("aria-busy", "false");
  const size = getPageSize();
  bookWrap.style.width = `${size.bookWidth + 1}px`;
  pageFlip.update();
  requestAnimationFrame(() => {
    bookWrap.style.width = `${size.bookWidth}px`;
    pageFlip.update();
    updateReader();
  });
});
