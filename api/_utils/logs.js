const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

const DEFAULT_LOGS = {
  entries: [],
};

async function ensureLogsFile() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.promises.access(LOGS_FILE, fs.constants.F_OK);
  } catch (_) {
    await fs.promises.writeFile(
      LOGS_FILE,
      JSON.stringify(DEFAULT_LOGS, null, 2),
      "utf8"
    );
  }
}

async function readLogs() {
  await ensureLogsFile();
  try {
    const raw = await fs.promises.readFile(LOGS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { ...DEFAULT_LOGS };
    }
    return parsed;
  } catch (_) {
    return { ...DEFAULT_LOGS };
  }
}

async function writeLogs(data) {
  await ensureLogsFile();
  await fs.promises.writeFile(LOGS_FILE, JSON.stringify(data, null, 2), "utf8");
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
