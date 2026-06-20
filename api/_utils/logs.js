const fs = require("fs");
const path = require("path");

const MEMORY_KEY = "__AUDITORIA_LOGS_STORE__";

// No Vercel, /tmp é o único diretório com permissão de escrita
const TMP_DIR = path.join("/tmp", "sistema-inatividade");
const TMP_LOGS_FILE = path.join(TMP_DIR, "logs.json");

const DEFAULT_LOGS = { entries: [] };

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
  return Math.floor(
    Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) /
      (1000 * 60 * 60 * 24)
  );
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
  // Tenta do /tmp primeiro (Vercel) ou disco local
  const caminhos = [
    TMP_LOGS_FILE,
    path.join(__dirname, "..", "data", "logs.json"),
    path.join(process.cwd(), "data", "logs.json"),
  ];
  const tentados = new Set();
  for (const caminho of caminhos) {
    if (tentados.has(caminho)) continue;
    tentados.add(caminho);
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
  return limparLogsExpirados(getMemoryStore());
}

async function writeLogs(data) {
  const sanitized = limparLogsExpirados(data || { entries: [] });
  global[MEMORY_KEY] = sanitized;

  // Tenta /tmp (Vercel), depois local, depois fallback silence
  const destinos = [TMP_LOGS_FILE, path.join(__dirname, "..", "data", "logs.json")];
  const tentados = new Set();
  for (const dest of destinos) {
    if (tentados.has(dest)) continue;
    tentados.add(dest);
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.writeFile(dest, JSON.stringify(sanitized, null, 2), "utf8");
      return; // Primeiro que funcionar já basta
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

module.exports = {
  readLogs,
  writeLogs,
  appendLog,
};
