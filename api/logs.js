const { readLogs } = require("./_utils/logs");
const {
  processarSolicitacoesFerias,
  listarLogsFerias,
} = require("./_utils/ferias");
const fetch = global.fetch || require("node-fetch");

async function buscarLogsExoneracaoDiscord(env) {
  const { Discord_Bot_Token, EXONERACAO_CHANNEL_ID } = env;
  if (!Discord_Bot_Token || !EXONERACAO_CHANNEL_ID) return [];

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const mensagens = [];
  let before = null;

  for (let i = 0; i < 6; i++) {
    const url = `https://discord.com/api/v10/channels/${EXONERACAO_CHANNEL_ID}/messages?limit=100${
      before ? `&before=${before}` : ""
    }`;
    const response = await fetch(url, { headers });
    if (!response.ok) break;

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    mensagens.push(...batch);
    before = batch[batch.length - 1].id;
  }

  return mensagens
    .map((msg) => {
      const content = String(msg?.content || "");
      if (!content.startsWith("SITE_LOG_EXONERACAO::")) return null;

      try {
        return {
          id: msg.id,
          ...JSON.parse(content.slice("SITE_LOG_EXONERACAO::".length)),
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

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

    if (!type || type === "ferias") {
      try {
        await processarSolicitacoesFerias(process.env);
      } catch (error) {
        console.error("Erro ao sincronizar logs de ferias:", error);
      }

      let entries = await listarLogsFerias(process.env);
      entries = entries.filter((entry) => entry.status === "aprovado");
      if (org) {
        entries = entries.filter((entry) => !entry.org || entry.org === org);
      }
      return res.status(200).json({ entries });
    }

    if (type === "exoneracao") {
      const store = await readLogs();
      const antigos = Array.isArray(store.entries)
        ? store.entries.filter((entry) => entry.type === "exoneracao")
        : [];
      const aoVivo = await buscarLogsExoneracaoDiscord(process.env);
      const mapa = new Map();

      [...aoVivo, ...antigos].forEach((entry) => {
        const chave =
          entry.id ||
          `${entry.createdAt || ""}-${entry.emissor?.id || ""}-${entry.quantidadeExonerados || 0}`;
        if (!mapa.has(chave)) mapa.set(chave, entry);
      });

      let entries = Array.from(mapa.values());
      if (org) {
        entries = entries.filter((entry) => !entry.org || entry.org === org);
      }
      return res.status(200).json({ entries });
    }

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
