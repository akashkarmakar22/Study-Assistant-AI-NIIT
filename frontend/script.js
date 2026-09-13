const API_URL = "https://study-hall-qdhb.onrender.com/chat";

const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const menuBtn = document.getElementById("menu-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const sessionListEl = document.getElementById("session-list");
const chatArea = document.getElementById("chat-area");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const errorBanner = document.getElementById("error-banner");
const fileInput = document.getElementById("file-input");
const attachBtn = document.getElementById("attach-btn");
const themeToggle = document.getElementById("theme-toggle");
const themeToggleMobile = document.getElementById("theme-toggle-mobile");

//Theme

const THEME_KEY = "aurora_theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
}

themeToggle.addEventListener("click", toggleTheme);
themeToggleMobile.addEventListener("click", toggleTheme);
initTheme();

//Mobile sidebar

function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.remove("hidden");
}
function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.add("hidden");
}
menuBtn.addEventListener("click", openSidebar);
sidebarBackdrop.addEventListener("click", closeSidebar);

//Sessions (multi-chat, saved in localStorage)

const SESSIONS_KEY = "aurora_sessions";
const ACTIVE_KEY = "aurora_active_session";

let sessions = [];
let activeId = null;

function loadSessions() {
  try {
    const saved = localStorage.getItem(SESSIONS_KEY);
    sessions = saved ? JSON.parse(saved) : [];
  } catch {
    sessions = [];
  }
  activeId = localStorage.getItem(ACTIVE_KEY);

  if (sessions.length === 0) {
    createSession();
  } else if (!sessions.find((s) => s.id === activeId)) {
    activeId = sessions[0].id;
  }
}

function saveSessions() {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  localStorage.setItem(ACTIVE_KEY, activeId);
}

function createSession() {
  const session = {
    id: crypto.randomUUID(),
    title: "New chat",
    messages: [],
  };
  sessions.unshift(session);
  activeId = session.id;
  saveSessions();
  return session;
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeId);
}

function deleteSession(id) {
  sessions = sessions.filter((s) => s.id !== id);
  if (sessions.length === 0) {
    createSession();
  } else if (activeId === id) {
    activeId = sessions[0].id;
  }
  saveSessions();
  renderSessionList();
  renderChatArea();
}

function switchSession(id) {
  activeId = id;
  saveSessions();
  renderSessionList();
  renderChatArea();
  closeSidebar();
}

function renderSessionList() {
  sessionListEl.innerHTML = "";
  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = `session-item ${session.id === activeId ? "active" : ""}`;

    const title = document.createElement("span");
    title.className = "session-title";
    title.textContent = session.title;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "session-delete";
    deleteBtn.setAttribute("aria-label", "Delete chat");
    deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSession(session.id);
    });

    item.appendChild(title);
    item.appendChild(deleteBtn);
    item.addEventListener("click", () => switchSession(session.id));
    sessionListEl.appendChild(item);
  });
}

//Markdown

function renderMarkdown(text) {
  return DOMPurify.sanitize(marked.parse(text, { breaks: true }));
}

//Chat area rendering

const SUGGESTIONS = [
  { emoji: "💡", text: "Explain a concept to me" },
  { emoji: "📄", text: "Summarize my notes" },
  { emoji: "🧠", text: "Quiz me on a topic" },
  { emoji: "✍️", text: "Help me solve a problem" },
];

function renderChatArea() {
  const session = getActiveSession();
  chatArea.innerHTML = "";

  if (!session || session.messages.length === 0) {
    const hero = document.createElement("div");
    hero.className = "hero";
    hero.innerHTML = `
      <h1 class="hero-title">Ready to ace your studies?</h1>
      <p class="hero-subtitle">Ask a question, paste your notes, or upload a document — I'll explain, summarize, or quiz you on it.</p>
      <div class="chip-grid"></div>
    `;
    const chipGrid = hero.querySelector(".chip-grid");
    SUGGESTIONS.forEach((s) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.innerHTML = `<span class="chip-emoji">${s.emoji}</span><span>${s.text}</span>`;
      chip.addEventListener("click", () => {
        messageInput.value = s.text;
        messageInput.focus();
      });
      chipGrid.appendChild(chip);
    });
    chatArea.appendChild(hero);
    return;
  }

  const container = document.createElement("div");
  container.className = "messages";
  session.messages.forEach((m) => {
    container.appendChild(buildMessageRow(m.role, m.content));
  });
  chatArea.appendChild(container);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function buildMessageRow(role, text, { animate = false } = {}) {
  const row = document.createElement("div");
  row.className = animate ? `row ${role} enter` : `row ${role}`;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar-sm";
    avatar.textContent = "AI";
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = `bubble bubble--${role}`;
  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(text);
  } else {
    bubble.textContent = text;
  }
  row.appendChild(bubble);
  return row;
}

function appendMessageLive(role, text) {
  let container = chatArea.querySelector(".messages");
  if (!container) {
    // First message in this session - replace hero with a fresh list.
    chatArea.innerHTML = "";
    container = document.createElement("div");
    container.className = "messages";
    chatArea.appendChild(container);
  }
  const row = buildMessageRow(role, text, { animate: true });
  container.appendChild(row);
  chatArea.scrollTop = chatArea.scrollHeight;
  row.addEventListener("animationend", () => row.classList.remove("enter"), { once: true });
  return row;
}

function addLoadingRow() {
  let container = chatArea.querySelector(".messages");
  if (!container) {
    chatArea.innerHTML = "";
    container = document.createElement("div");
    container.className = "messages";
    chatArea.appendChild(container);
  }
  const row = document.createElement("div");
  row.className = "row assistant loading";
  row.innerHTML = `
    <div class="avatar-sm">AI</div>
    <div class="bubble bubble--assistant">
      <span class="pulse-dot"></span><span class="pulse-dot"></span><span class="pulse-dot"></span>
    </div>`;
  container.appendChild(row);
  chatArea.scrollTop = chatArea.scrollHeight;
  return row;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.remove("hidden");
}
function clearError() {
  errorBanner.classList.add("hidden");
  errorBanner.textContent = "";
}

function updateSessionTitle(session, firstMessage) {
  if (session.title === "New chat") {
    session.title = firstMessage.length > 36 ? firstMessage.slice(0, 36) + "…" : firstMessage;
  }
}

//Send / Upload

async function sendMessage(userText) {
  const session = getActiveSession();
  appendMessageLive("user", userText);
  session.messages.push({ role: "user", content: userText });
  updateSessionTitle(session, userText);
  saveSessions();
  renderSessionList();

  const loadingRow = addLoadingRow();
  sendBtn.disabled = true;
  clearError();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userText,
        history: session.messages.slice(0, -1),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Request failed with status ${response.status}`);
    }

    const data = await response.json();
    loadingRow.remove();
    appendMessageLive("assistant", data.reply);
    session.messages.push({ role: "assistant", content: data.reply });
    saveSessions();
  } catch (err) {
    loadingRow.remove();
    showError(`Couldn't reach the assistant: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

async function uploadFile(file) {
  const session = getActiveSession();
  appendMessageLive("user", `📎 ${file.name}`);
  updateSessionTitle(session, file.name);

  const loadingRow = addLoadingRow();
  attachBtn.disabled = true;
  sendBtn.disabled = true;
  clearError();

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(API_URL.replace("/chat", "/upload"), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Upload failed with status ${response.status}`);
    }

    const data = await response.json();
    loadingRow.remove();
    appendMessageLive("assistant", data.summary);
    session.messages.push({ role: "user", content: `[Uploaded file: ${data.filename}]` });
    session.messages.push({ role: "assistant", content: data.summary });
    saveSessions();
    renderSessionList();
  } catch (err) {
    loadingRow.remove();
    showError(`Couldn't process that file: ${err.message}`);
  } finally {
    attachBtn.disabled = false;
    sendBtn.disabled = false;
  }
}

// Events

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  messageInput.value = "";
  sendMessage(text);
});

attachBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) uploadFile(file);
  fileInput.value = "";
});

newChatBtn.addEventListener("click", () => {
  createSession();
  renderSessionList();
  renderChatArea();
  closeSidebar();
  messageInput.focus();
});

// Init

loadSessions();
renderSessionList();
renderChatArea();