const fs = require("fs");
const path = require("path");

const MEMORY_KEY = "__AUDITORIA_LOGS_STORE__";

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
  // Tenta restaurar do disco se disponível (apenas local, não no Vercel)
  const logsPath = path.join(__dirname, "..", "data", "logs.json");
  try {
    await fs.promises.access(logsPath, fs.constants.F_OK);
    const raw = await fs.promises.readFile(logsPath, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (parsed && Array.isArray(parsed.entries)) {
      const sanitized = limparLogsExpirados(parsed);
      global[MEMORY_KEY] = sanitized;
      return sanitized;
    }
  } catch (_) {}
  // Fallback: memória
  return limparLogsExpirados(getMemoryStore());
}

async function writeLogs(data) {
  const sanitized = limparLogsExpirados(data || { entries: [] });
  global[MEMORY_KEY] = sanitized;

  // Tenta persistir em disco (pode falhar no Vercel - EROFS)
  const logsPath = path.join(__dirname, "..", "data", "logs.json");
  try {
    await fs.promises.mkdir(path.dirname(logsPath), { recursive: true });
    await fs.promises.writeFile(logsPath, JSON.stringify(sanitized, null, 2), "utf8");
  } catch (error) {
    // EROFS no Vercel é esperado, manter só em memória
    if (error.code !== "EROFS") {
      console.error("Falha ao persistir logs em disco:", error);
    }
  }
}

async function appendLog(entry) {
  const logs = await readLogs();
  logs.entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
  global[MEMORY_KEY] = logs;
  // writeLogs tem try/catch interno, nunca lança
  await writeLogs(logs);
  return logs.entries[0];
}

module.exports = {
  readLogs,
  writeLogs,
  appendLog,
};
