// Tenta usar o fetch nativo ou o node-fetch se necessário
const fetch = global.fetch || require("node-fetch");

module.exports = async (req, res) => {
  // --- 1. CABEÇALHOS CORS (OBRIGATÓRIO) ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responde rápido se for verificação do navegador
  if (req.method === "OPTIONS") return res.status(200).end();

  const { org, dataInicio, dataFim } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    ENSINO_ROLES_MATRIZES_ID,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
  } = process.env;

  // --- 2. VALIDAÇÃO BÁSICA ---
  if (!Discord_Bot_Token) {
    return res
      .status(500)
      .json({ error: "ERRO CRÍTICO: Token do Bot não configurado no .env" });
  }

  // Lógica de Cargo
  let anchorRoleId = "";
  if (org === "PCERJ") anchorRoleId = POLICE_ROLE_ID;
  else if (org === "PRF") anchorRoleId = PRF_ROLE_ID;
  else if (org === "PMERJ") anchorRoleId = PMERJ_ROLE_ID;

  // Busca canais do .env dinamicamente
  const CHANNELS_ENV = process.env[`${org}_ENSINO_CH`];
  if (!CHANNELS_ENV) {
    return res.status(500).json({
      error: `ERRO: Variável ${org}_ENSINO_CH não encontrada no .env`,
    });
  }

  const canaisEnsino = CHANNELS_ENV.split(",").map((id) => id.trim());
  const instructorRoles = ENSINO_ROLES_MATRIZES_ID
    ? ENSINO_ROLES_MATRIZES_ID.split(",").map((id) => id.trim())
    : [];

  const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

  // Tratamento de Datas
  const startTs = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : 0;
  const endTs = dataFim
    ? new Date(`${dataFim}T23:59:59`).getTime()
    : Date.now();

  try {
    // --- 3. LÓGICA DE BUSCA ---
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );

    if (!membersRes.ok)
      throw new Error(`Erro Discord Membros: ${membersRes.status}`);
    const members = await membersRes.json();

    let ensinoMap = {};

    // Filtra Instrutores da Org
    const instrutores = members.filter(
      (m) =>
        m.roles.includes(anchorRoleId) &&
        m.roles.some((r) => instructorRoles.includes(r))
    );

    instrutores.forEach((p) => {
      ensinoMap[p.user.id] = {
        id: p.user.id,
        name: p.nick || p.user.username,
        cursos: 0,
        recs: 0,
        total: 0,
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // Loop nos canais
    for (let i = 0; i < canaisEnsino.length; i++) {
      const channelId = canaisEnsino[i];
      // Define Recrutamento: PMERJ index 2, Outros index 1
      const isRecrutamento =
        (org === "PMERJ" && i === 2) || (org !== "PMERJ" && i === 1);

      let ultimoId = null;
      let stopLoop = false;

      // Limite de 5 páginas (500 msgs) para não estourar tempo da Vercel
      for (let p = 0; p < 5; p++) {
        if (stopLoop) break;

        const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          ultimoId ? `&before=${ultimoId}` : ""
        }`;

        const msgRes = await fetch(url, { headers });
        if (!msgRes.ok) break;

        const msgs = await msgRes.json();
        if (!Array.isArray(msgs) || msgs.length === 0) break;

        msgs.forEach((msg) => {
          const msgTs = new Date(msg.timestamp).getTime();

          if (msgTs < startTs) {
            stopLoop = true;
            return;
          }
          if (msgTs > endTs) return;

          const idsMencionados = new Set();
          if (msg.mentions)
            msg.mentions.forEach((m) => idsMencionados.add(m.id));

          const contentStr = msg.content + JSON.stringify(msg.embeds || {});
          const matches = contentStr.match(/<@!?(\d+)>/g);
          if (matches)
            matches.forEach((m) => idsMencionados.add(m.replace(/\D/g, "")));

          idsMencionados.forEach((id) => {
            if (ensinoMap[id]) {
              if (isRecrutamento) {
                ensinoMap[id].recs++;
                ensinoMap[id].total += 2;
              } else {
                ensinoMap[id].cursos++;
                ensinoMap[id].total += 1;
              }
            }
          });
        });
        ultimoId = msgs[msgs.length - 1].id;
      }
    }

    res.status(200).json(Object.values(ensinoMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
