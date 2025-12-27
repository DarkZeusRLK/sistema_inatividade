module.exports = async (req, res) => {
  const { org, dataInicio, dataFim } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    ENSINO_ROLES_MATRIZES_ID,
    POLICE_ROLE_ID, // PCERJ
    PRF_ROLE_ID, // PRF
    PMERJ_ROLE_ID, // PMERJ
  } = process.env;

  // 1. Define o "Cargo Âncora" baseado na org selecionada
  let anchorRoleId = "";
  if (org === "PCERJ") anchorRoleId = POLICE_ROLE_ID;
  else if (org === "PRF") anchorRoleId = PRF_ROLE_ID;
  else if (org === "PMERJ") anchorRoleId = PMERJ_ROLE_ID;

  // Canais de Ensino específicos da Org
  const CHANNELS_ENV = process.env[`${org}_ENSINO_CH`];
  const canaisEnsino = CHANNELS_ENV
    ? CHANNELS_ENV.split(",").map((id) => id.trim())
    : [];

  // Todos os cargos que permitem dar instrução (Matrizes)
  const instructorRoles = ENSINO_ROLES_MATRIZES_ID
    ? ENSINO_ROLES_MATRIZES_ID.split(",").map((id) => id.trim())
    : [];

  const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

  // Configuração de Datas
  const startTs = dataInicio ? new Date(dataInicio).getTime() : 0;
  const endTs = dataFim ? new Date(dataFim).getTime() + 86399999 : Date.now();

  try {
    // 2. Busca membros e filtra: Precisa ter o cargo de INSTRUTOR e o cargo da ORG
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    let ensinoMap = {};
    const instrutores = members.filter(
      (m) =>
        m.roles.includes(anchorRoleId) && // FILTRO DE SEGURANÇA: Deve ser da corporação
        m.roles.some((r) => instructorRoles.includes(r)) // E deve ser instrutor
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

    // 3. Varredura por MENÇÕES com filtro de data
    for (let i = 0; i < canaisEnsino.length; i++) {
      const channelId = canaisEnsino[i];
      const isRecrutamento =
        (org === "PMERJ" && i === 2) || (org !== "PMERJ" && i === 1);

      let ultimoId = null;
      let alcancouDataLimite = false;

      for (let p = 0; p < 15; p++) {
        if (alcancouDataLimite) break;

        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          ultimoId ? `&before=${ultimoId}` : ""
        }`;
        const msgRes = await fetch(url, { headers });
        const msgs = await msgRes.json();
        if (!msgs || msgs.length === 0) break;

        msgs.forEach((msg) => {
          const msgTs = new Date(msg.timestamp).getTime();

          // Se a mensagem for mais antiga que a data inicial, paramos de processar este canal
          if (msgTs < startTs) {
            alcancouDataLimite = true;
            return;
          }

          // Se estiver dentro do range (ou se não houver data final definida)
          if (msgTs <= endTs) {
            const idsMencionados = new Set();
            if (msg.mentions)
              msg.mentions.forEach((m) => idsMencionados.add(m.id));

            const conteudoCompleto =
              msg.content + JSON.stringify(msg.embeds || {});
            const matches = conteudoCompleto.match(/<@!?(\d+)>/g);
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

        if (alcancouDataLimite) break;
        ultimoId = msgs[msgs.length - 1].id;
      }
    }

    res.status(200).json(Object.values(ensinoMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
