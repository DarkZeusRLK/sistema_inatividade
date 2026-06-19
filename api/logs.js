const path = require("path");
const fs = require("fs");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "OPTIONS") return res.status(200).end();

  const query = req.query || {};
  const org = query.org;
  const type = query.type || "exoneracao";

  try {
    const logsPath = path.join(process.cwd(), "data", "logs.json");
    let logs = { entries: [] };
    try {
      const raw = await fs.promises.readFile(logsPath, "utf8");
      logs = JSON.parse(raw || '{"entries":[]}');
    } catch (_) {}

    if (!Array.isArray(logs.entries)) {
      return res.status(200).json({ entries: [] });
    }

    let entries = logs.entries;

    // Filtrar por tipo
    if (type === "exoneracao") {
      entries = entries.filter((e) => e.type === "exoneracao");
    } else if (type === "ferias") {
      entries = entries.filter((e) => e.type === "ferias");
    }

    // Filtrar por org se especificado
    if (org) {
      entries = entries.filter((e) => e.org === org);
    }

    return res.status(200).json({ entries });
  } catch (error) {
    console.error("Erro ao carregar logs:", error);
    return res.status(500).json({
      error: "Erro interno ao carregar logs.",
    });
  }
};
