module.exports = async (req, res) => {
  const { org, dataInicio, dataFim } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    ENSINO_ROLES_MATRIZES_ID,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
  } = process.env;

  // 1. Define o cargo da corporação (Segurança para não misturar matrizes)
  let anchorRoleId = "";
  if (org === "PCERJ") anchorRoleId = POLICE_ROLE_ID;
  else if (org === "PRF") anchorRoleId = PRF_ROLE_ID;
  else if (org === "PMERJ") anchorRoleId = PMERJ_ROLE_ID;

  const CHANNELS_ENV = process.env[`${org}_ENSINO_CH`];
  const canaisEnsino = CHANNELS_ENV
    ? CHANNELS_ENV.split(",").map((id) => id.trim())
    : [];
  const instructorRoles = ENSINO_ROLES_MATRIZES_ID
    ? ENSINO_ROLES_MATRIZES_ID.split(",").map((id) => id.trim())
    : [];

  const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

  // CORREÇÃO DA DATA: Se não houver data, usamos valores padrão seguros
  const startTs =
    dataInicio && dataInicio !== "" ? new Date(dataInicio).getTime() : 0;
  // Se não houver data final, usamos o momento atual
  const endTs =
    dataFim && dataFim !== ""
      ? new Date(dataFim).getTime() + 86399999
      : Date.now();

  try {
    // 2. Busca membros e filtra apenas quem é da ORG e é INSTRUTOR
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    if (!Array.isArray(members))
      throw new Error("Falha ao buscar membros do Discord");

    let ensinoMap = {};
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

    // 3. Varredura de Mensagens
    for (let i = 0; i < canaisEnsino.length; i++) {
      const channelId = canaisEnsino[i];
      const isRecrutamento =
        (org === "PMERJ" && i === 2) || (org !== "PMERJ" && i === 1);

      let ultimoId = null;
      let stopLoop = false;

      for (let p = 0; p < 10; p++) {
        // Limite de 1000 mensagens por canal para performance
        if (stopLoop) break;
        const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          ultimoId ? `&before=${ultimoId}` : ""
        }`;
        const msgRes = await fetch(url, { headers });
        const msgs = await msgRes.json();

        if (!Array.isArray(msgs) || msgs.length === 0) break;

        msgs.forEach((msg) => {
          const msgTs = new Date(msg.timestamp).getTime();

          if (msgTs < startTs) {
            stopLoop = true;
            return;
          }

          if (msgTs <= endTs) {
            const idsMencionados = new Set();
            // Menções diretas
            if (msg.mentions)
              msg.mentions.forEach((m) => idsMencionados.add(m.id));

            // Menções em embeds (Regex)
            const contentStr = msg.content + JSON.stringify(msg.embeds || {});
            const matches = contentStr.match(/<@!?(\d+)>/g);
            if (matches)
              matches.forEach((m) => idsMencionados.add(m.replace(/\D/g, "")));

            idsMencionados.forEach((id) => {
              if (ensinoMap[id]) {
                if (isRecrutamento) ensinoMap[id].recs++;
                else ensinoMap[id].cursos++;
                ensinoMap[id].total++;
              }
            });
          }
        });
        ultimoId = msgs[msgs.length - 1].id;
      }
    }

    res.status(200).json(Object.values(ensinoMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
