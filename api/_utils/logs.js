const fs = require("fs");
const path = require("path");
const fetch = global.fetch || require("node-fetch");

const MEMORY_KEY = "__AUDITORIA_LOGS_STORE__";
const TMP_DIR = path.join("/tmp", "sistema-inatividade");
const TMP_LOGS_FILE = path.join(TMP_DIR, "logs.json");

const GITHUB_OWNER = "DarkZeusRLK";
const GITHUB_REPO = "sistema_inatividade";
const GITHUB_PATH = "data/logs.json";

async function getGithubToken() {
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || null;
}

async function readFromGithub() {
  const token = await getGithubToken();
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3.raw" } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const parsed = JSON.parse(text || "{}");
    return parsed && Array.isArray(parsed.entries) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeToGithub(data) {
  const token = await getGithubToken();
  if (!token || !data.entries?.length) return false;

  try {
    // Primeiro pega o sha do arquivo atual
    const metaRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } }
    );
    let sha = null;
    if (metaRes.ok) {
      const meta = await metaRes.json();
      sha = meta.sha;
    }

    const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
    const body = {
      message: `chore: atualizar logs (${data.entries.length} entradas)`,
      content,
      branch: "main",
    };
    if (sha) body.sha = sha;

    const writeRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    return writeRes.ok;
  } catch {
    return false;
  }
}

function getMemoryStore() {
  if (!global[MEMORY_KEY]) {
    global[MEMORY_KEY] = { entries: [] };
  }
  return global[MEMORY_KEY];
}

function obterIndiceDia(valor) {
  if (!valor) return null;
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return Math.floor(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / (1000 * 60 * 60 * 24));
}

function limparLogsExpirados(store) {
  const entries = Array.isArray(store?.entries) ? store.entries : [];
  const hoje = new Date();
  const indiceHoje = obterIndiceDia(hoje);
  const filtrados = entries.filter((entry) => {
    if (entry?.type !== "ferias") return true;
    if (entry?.status !== "aprovado") return true;
    const indiceFim = obterIndiceDia(entry.dataFim);
    if (indiceFim === null || indiceHoje === null) return true;
    return indiceFim >= indiceHoje;
  });
  return { entries: filtrados };
}

async function readLogs() {
  // Prioridade 1: Tenta GitHub (compartilhado entre todos)
  const githubData = await readFromGithub();
  if (githubData && githubData.entries.length > 0) {
    const sanitized = limparLogsExpirados(githubData);
    global[MEMORY_KEY] = sanitized;
    return sanitized;
  }

  // Prioridade 2: Tenta /tmp (Vercel, mesma instância)
  const caminhos = [
    TMP_LOGS_FILE,
    path.join(__dirname, "..", "data", "logs.json"),
    path.join(process.cwd(), "data", "logs.json"),
  ];
  for (const caminho of caminhos) {
    try {
      await fs.promises.access(caminho, fs.constants.F_OK);
      const raw = await fs.promises.readFile(caminho, "utf8");
      const parsed = JSON.parse(raw || "{}");
      if (parsed && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        const sanitized = limparLogsExpirados(parsed);
        global[MEMORY_KEY] = sanitized;
        return sanitized;
      }
    } catch (_) {}
  }

  // Prioridade 3: Memória
  return limparLogsExpirados(getMemoryStore());
}

async function writeLogs(data) {
  const sanitized = limparLogsExpirados(data || { entries: [] });
  global[MEMORY_KEY] = sanitized;

  // Tenta GitHub (compartilhado)
  const written = await writeToGithub(sanitized);

  // Fallback: /tmp (Vercel) ou local
  const destinos = [TMP_LOGS_FILE, path.join(__dirname, "..", "data", "logs.json")];
  for (const dest of destinos) {
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.writeFile(dest, JSON.stringify(sanitized, null, 2), "utf8");
      return;
    } catch (_) {}
  }
}

async function appendLog(entry) {
  const logs = await readLogs();
  const newEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  logs.entries.unshift(newEntry);
  global[MEMORY_KEY] = logs;
  await writeLogs(logs);
  return newEntry;
}

module.exports = { readLogs, writeLogs, appendLog };
