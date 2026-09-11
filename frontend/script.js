const API_URL = "http://localhost:8001/chat";

const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const errorBanner = document.getElementById("error-banner");
const fileInput = document.getElementById("file-input");
const attachBtn = document.getElementById("attach-btn");
const clearBtn = document.getElementById("clear-btn");

const statMessages = document.getElementById("stat-messages");
const statDocs = document.getElementById("stat-docs");
const statTime = document.getElementById("stat-time");

let history = [];
let messagesSent = 0;
let docsSummarized = 0;
const sessionStart = Date.now();

// ---------- Persistence ----------
// Chat history lives in this browser only (localStorage) - there's no
// database, so it won't follow you to another device, but it does survive
// refreshes and closing/reopening the tab.
const HISTORY_KEY = "study_dashboard_history";
const STATS_KEY = "study_dashboard_stats";

function saveState() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  localStorage.setItem(STATS_KEY, JSON.stringify({ messagesSent, docsSummarized }));
}

function loadState() {
  try {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    const savedStats = localStorage.getItem(STATS_KEY);

    if (savedHistory) {
      history = JSON.parse(savedHistory);
    }
    if (savedStats) {
      const parsed = JSON.parse(savedStats);
      messagesSent = parsed.messagesSent || 0;
      docsSummarized = parsed.docsSummarized || 0;
    }
  } catch (err) {
    console.warn("Could not load saved chat history:", err);
    history = [];
  }
}

function renderSavedHistory() {
  if (history.length === 0) {
    addMessage("assistant", "Hey — what are we working through today? Paste your notes, ask me to explain something, upload a document to summarize, or have me quiz you.");
    return;
  }
  history.forEach((m) => addMessage(m.role, m.content));
  bumpStat(statMessages, messagesSent);
  bumpStat(statDocs, docsSummarized);
}

// ---------- Stats ----------

function updateSessionTime() {
  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  statTime.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
}
setInterval(updateSessionTime, 1000);

function bumpStat(el, newValue) {
  el.textContent = newValue;
}

// ---------- Chat rendering ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderMarkdown(text) {
  const rawHtml = marked.parse(text, { breaks: true });
  return DOMPurify.sanitize(rawHtml);
}

function addMessage(role, text) {
  const row = document.createElement("div");
  row.className = `row ${role} enter`;

  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar-sm avatar-sm--ai";
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

  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  row.addEventListener("animationend", () => row.classList.remove("enter"), { once: true });
  return row;
}

function addLoadingRow() {
  const row = document.createElement("div");
  row.className = "row assistant loading";
  row.innerHTML = `
    <div class="avatar-sm avatar-sm--ai">AI</div>
    <div class="bubble bubble--assistant">
      <span class="pulse-dot"></span><span class="pulse-dot"></span><span class="pulse-dot"></span>
    </div>`;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
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

// ---------- Chat send ----------

async function sendMessage(userText) {
  addMessage("user", userText);
  history.push({ role: "user", content: userText });

  const loadingRow = addLoadingRow();
  sendBtn.disabled = true;
  clearError();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText, history: history.slice(0, -1) }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `Request failed with status ${response.status}`);
    }

    const data = await response.json();
    loadingRow.remove();
    addMessage("assistant", data.reply);
    history.push({ role: "assistant", content: data.reply });

    messagesSent += 1;
    bumpStat(statMessages, messagesSent);
    saveState();
  } catch (err) {
    loadingRow.remove();
    showError(`Couldn't reach the assistant: ${err.message}`);
  } finally {
    sendBtn.disabled = false;
  }
}

// ---------- File upload ----------

async function uploadFile(file) {
  const row = document.createElement("div");
  row.className = "row user enter";
  row.innerHTML = `<div class="bubble bubble--user">📎 ${escapeHtml(file.name)}</div>`;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  row.addEventListener("animationend", () => row.classList.remove("enter"), { once: true });

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
    addMessage("assistant", data.summary);
    history.push({ role: "user", content: `[Uploaded file: ${data.filename}]` });
    history.push({ role: "assistant", content: data.summary });

    docsSummarized += 1;
    bumpStat(statDocs, docsSummarized);
    saveState();
  } catch (err) {
    loadingRow.remove();
    showError(`Couldn't process that file: ${err.message}`);
  } finally {
    attachBtn.disabled = false;
    sendBtn.disabled = false;
  }
}

// ---------- Events ----------

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

clearBtn.addEventListener("click", () => {
  history = [];
  messagesSent = 0;
  docsSummarized = 0;
  chatWindow.innerHTML = "";
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(STATS_KEY);
  bumpStat(statMessages, 0);
  bumpStat(statDocs, 0);
  addMessage("assistant", "New chat started — what are we working on?");
});

// Restore previous conversation (if any) on load.
loadState();
renderSavedHistory();