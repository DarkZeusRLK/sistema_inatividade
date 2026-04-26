const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const MEMORY_KEY = "__AUDITORIA_LOGS_STORE__";

const DEFAULT_LOGS = {
  entries: [],
};

function cloneDefaultLogs() {
  return {
    entries: [],
  };
}

function getMemoryStore() {
  if (!global[MEMORY_KEY]) {
    global[MEMORY_KEY] = cloneDefaultLogs();
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

  return {
    entries: filtrados,
  };
}

async function readLogs() {
  try {
    await fs.promises.access(LOGS_FILE, fs.constants.F_OK);
    const raw = await fs.promises.readFile(LOGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || !Array.isArray(parsed.entries)) {
      return getMemoryStore();
    }
    const sanitized = limparLogsExpirados(parsed);
    global[MEMORY_KEY] = sanitized;

    if (sanitized.entries.length !== parsed.entries.length) {
      await writeLogs(sanitized);
    }

    return sanitized;
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.error("Falha ao ler arquivo de logs, usando memoria:", error);
    }
    const memoryStore = limparLogsExpirados(getMemoryStore());
    global[MEMORY_KEY] = memoryStore;
    return memoryStore;
  }
}

async function writeLogs(data) {
  const sanitized = limparLogsExpirados(data || cloneDefaultLogs());
  global[MEMORY_KEY] = sanitized;

  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(
      LOGS_FILE,
      JSON.stringify(sanitized, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Falha ao persistir logs em disco, mantendo em memoria:", error);
  }
}

async function appendLog(entry) {
  const logs = await readLogs();
  logs.entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });
  await writeLogs(logs);
  return global[MEMORY_KEY].entries[0];
}

module.exports = {
  readLogs,
  writeLogs,
  appendLog,
  LOGS_FILE,
};
