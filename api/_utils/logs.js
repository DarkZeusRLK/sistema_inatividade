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

async function readLogs() {
  try {
    await fs.promises.access(LOGS_FILE, fs.constants.F_OK);
    const raw = await fs.promises.readFile(LOGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || !Array.isArray(parsed.entries)) {
      return getMemoryStore();
    }
    global[MEMORY_KEY] = parsed;
    return parsed;
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      console.error("Falha ao ler arquivo de logs, usando memoria:", error);
    }
    return getMemoryStore();
  }
}

async function writeLogs(data) {
  global[MEMORY_KEY] = data;

  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(LOGS_FILE, JSON.stringify(data, null, 2), "utf8");
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
  return logs.entries[0];
}

module.exports = {
  readLogs,
  writeLogs,
  appendLog,
  LOGS_FILE,
};
