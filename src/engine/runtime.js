/* ekoo runtime — replaces the prototype shell in production.
   Loads the shared engine, then mounts the Desktop app on laptop-size screens and the native-style
   Mobile app on phones and small tablets. Re-mounts live when the window crosses the breakpoint. */
import "./core.js";
import "./mobile.js";
import "./desktop.js";

const EK = window.EK;
export const DESKTOP_MIN = 1024; // px. Laptops and larger get the desktop web app.
const SCREENS = ["welcome","home","help","detail","success","request","chat","drive","ask","community","activity","feedback","me"];
const TITLES = {welcome:"Welcome",home:"Near you",help:"Help nearby",detail:"Activity",success:"You are in",request:"Request",chat:"Chat",drive:"Start a drive",ask:"Ask for help",community:"Community",activity:"Your activity",feedback:"Feedback",me:"Me"};

function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

/* ---------- theme ---------- */
EK.isDark = function () { const c = document.documentElement.getAttribute("data-theme"); return c ? c === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
function paintThemeColor() {
  const m = document.querySelector('meta[name="theme-color"]:not([media])') || (() => { const x = document.createElement("meta"); x.name = "theme-color"; document.head.appendChild(x); return x; })();
  m.content = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || (EK.isDark() ? "#0C0F0E" : "#F1F3F0");
}
EK.toggleTheme = function () {
  const dark = EK.isDark();
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
  store("ekoo-theme", dark ? "light" : "dark");
  paintThemeColor();
  document.dispatchEvent(new CustomEvent("ek-theme"));
};
(function () { const th = store("ekoo-theme"); if (th === "dark" || th === "light") document.documentElement.setAttribute("data-theme", th); })();

/* ---------- screen changes: title + shareable deep link (?screen=) ---------- */
EK.onScreen = function (key) {
  document.title = (TITLES[key] ? TITLES[key] + " · " : "") + "ekoo";
  try { const u = new URL(location.href); if (key === "home" || key === "welcome") u.searchParams.delete("screen"); else u.searchParams.set("screen", key); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) {}
};
EK.switchView = function () {};

/* ---------- design research dialog (opened from Me → About) ---------- */
EK.openResearch = function () {
  const { ic, REFS, esc } = EK;
  const m = document.createElement("div"); m.className = "pmodal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "About ekoo");
  m.innerHTML = '<div class="card"><button class="x" aria-label="Close">' + ic("x") + '</button><h2>About ekoo</h2><p style="color:var(--ink-2);max-width:62ch;margin:0">ekoo helps you join organised volunteering or help a neighbour, in minutes. You can use everything as a guest: no login, OTP or email needed. The design draws on these ten references.</p><div class="grid">' +
    REFS.map((r, i) => '<div class="ref"><span class="aw">' + esc(r.aw) + '</span><b>' + (i + 1) + '. ' + esc(r.n) + '</b><span>' + esc(r.take) + '</span><a href="' + r.url + '" target="_blank" rel="noopener">' + esc(r.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]) + ' ↗</a></div>').join("") + '</div></div>';
  const close = () => { m.remove(); document.removeEventListener("keydown", k); }; const k = (e) => { if (e.key === "Escape") close(); };
  m.addEventListener("click", (e) => { if (e.target === m || e.target.closest(".x")) close(); }); document.addEventListener("keydown", k);
  document.body.appendChild(m); m.querySelector(".x").focus();
};

/* ---------- view selection ---------- */
export function wantsDesktop() {
  return window.matchMedia("(min-width: " + DESKTOP_MIN + "px)").matches;
}

export function boot(root) {
  let cur = null, curKind = null;
  function mount() {
    const kind = wantsDesktop() ? "desktop" : "mobile";
    if (kind === curKind) return;
    let deep = null;
    try { deep = new URL(location.href).searchParams.get("screen"); } catch (e) {}
    if (cur && cur.unmount) cur.unmount();
    root.querySelectorAll(".ek-host").forEach((n) => n.remove());
    const host = document.createElement("div");
    host.className = "ek-host";
    if (kind === "desktop") {
      host.innerHTML = '<div class="ek-desk" id="desk"></div>';
      root.appendChild(host);
      cur = window.DesktopView; cur.mount(host.firstChild, {});
    } else {
      host.innerHTML = '<div class="mfull"><div class="screen" id="screen"></div></div>';
      root.appendChild(host);
      cur = window.MobileView; cur.mount(host.querySelector(".screen"), { framed: false });
    }
    curKind = kind;
    document.documentElement.dataset.view = kind;
    // deep link: /?screen=detail opens that screen
    if (deep && SCREENS.includes(deep) && EK.S.onboarded) cur.jump(deep);
  }
  const mq = window.matchMedia("(min-width: " + DESKTOP_MIN + "px)");
  const onChange = () => mount();
  mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
  const darkMq = matchMedia("(prefers-color-scheme: dark)");
  const onDark = () => { paintThemeColor(); document.dispatchEvent(new CustomEvent("ek-theme")); };
  darkMq.addEventListener && darkMq.addEventListener("change", onDark);
  mount(); paintThemeColor();
  return () => {
    mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange);
    darkMq.removeEventListener && darkMq.removeEventListener("change", onDark);
    if (cur && cur.unmount) cur.unmount();
    root.querySelectorAll(".ek-host").forEach((n) => n.remove());
  };
}
