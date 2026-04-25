const { readLogs } = require("./_utils/logs");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const { type, org } = req.query || {};
    const store = await readLogs();

    let entries = Array.isArray(store.entries) ? [...store.entries] : [];

    if (type && type !== "todos") {
      entries = entries.filter((entry) => entry.type === type);
    }

    if (org) {
      entries = entries.filter((entry) => !entry.org || entry.org === org);
    }

    return res.status(200).json({ entries });
  } catch (error) {
    console.error("Erro ao carregar logs:", error);
    return res.status(200).json({ entries: [], degraded: true });
  }
};
