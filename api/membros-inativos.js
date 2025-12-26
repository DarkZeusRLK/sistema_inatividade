module.exports = async (req, res) => {
  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    POLICE_ROLE_ID,
    ADMISSAO_CHANNEL_ID,
    PRF_ROLE_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ROLE_ID,
    PMERJ_ADMISSAO_CH,
  } = process.env;

  const TARGET_ROLE_ID =
    org === "PRF"
      ? PRF_ROLE_ID
      : org === "PMERJ"
      ? PMERJ_ROLE_ID
      : POLICE_ROLE_ID;

  const TARGET_ADMISSAO_CH =
    org === "PRF"
      ? PRF_ADMISSAO_CH
      : org === "PMERJ"
      ? PMERJ_ADMISSAO_CH
      : ADMISSAO_CHANNEL_ID;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

    // 1. Busca Banco de Dados de Admissão (Melhorado)
    let dadosRP = {};
    let ultimoIdMsg = null;

    if (TARGET_ADMISSAO_CH) {
      // Aumentei para 10 loops (1000 mensagens) para garantir que pegue admissões mais antigas
      for (let i = 0; i < 10; i++) {
        let url = `https://discord.com/api/v10/channels/${TARGET_ADMISSAO_CH}/messages?limit=100`;
        if (ultimoIdMsg) url += `&before=${ultimoIdMsg}`;

        const admissaoRes = await fetch(url, { headers });
        if (!admissaoRes.ok) break;

        const msgsAdmissao = await admissaoRes.json();
        if (msgsAdmissao.length === 0) break;

        msgsAdmissao.forEach((msg) => {
          const conteudoLimpo = msg.content.replace(/\*/g, ""); // Remove negritos e itálicos
          const mencao = conteudoLimpo.match(/<@!?(\d+)>/);

          // Regex mais flexíveis para pegar NOME e ID
          const nomeMatch = conteudoLimpo.match(/NOME\s*(?:DO\s*RP)?:\s*(.*)/i);
          const idMatch = conteudoLimpo.match(
            /ID(?:\s*DA\s*CIDADE)?:\s*(\d+)/i
          );

          if (mencao) {
            const userId = mencao[1];
            // Só preenche se ainda não existir (garante que pega a admissão mais recente)
            if (!dadosRP[userId]) {
              dadosRP[userId] = {
                nome: nomeMatch
                  ? nomeMatch[1].split("\n")[0].trim()
                  : "NOME NÃO CADASTRADO",
                cidadeId: idMatch ? idMatch[1].trim() : "ID NÃO ENCONTRADO",
              };
            }
          }
        });
        ultimoIdMsg = msgsAdmissao[msgsAdmissao.length - 1].id;
      }
    }

    // 2. Busca Canais e Membros
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      { headers }
    );
    const textChannels = (await channelsRes.json()).filter((c) =>
      [0, 5, 11, 12].includes(c.type)
    );

    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    const oficiaisDaForca = members.filter((m) => {
      return (
        m.roles.includes(TARGET_ROLE_ID) &&
        (!FERIAS_ROLE_ID || !m.roles.includes(FERIAS_ROLE_ID))
      );
    });

    // 3. Montagem do Mapa de Atividade
    let activityMap = {};
    oficiaisDaForca.forEach((p) => {
      const infoRP = dadosRP[p.user.id];

      activityMap[p.user.id] = {
        id: p.user.id, // ID do Discord (para a tabela e menção <@id>)
        name: p.nick || p.user.username, // Apelido do Discord (para a tabela)
        rpName: infoRP ? infoRP.nome : "DOC. ADMISSÃO NÃO ENCONTRADO", // Nome da Admissão
        cidadeId: infoRP ? infoRP.cidadeId : "0000", // ID da Admissão
        lastMsg: 0,
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // 4. Varredura de Mensagens (Verificação de Inatividade)
    for (const channel of textChannels) {
      try {
        const msgRes = await fetch(
          `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100`,
          { headers }
        );
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          msgs.forEach((msg) => {
            if (activityMap[msg.author.id]) {
              const ts = new Date(msg.timestamp).getTime();
              if (ts > activityMap[msg.author.id].lastMsg)
                activityMap[msg.author.id].lastMsg = ts;
            }
          });
        }
        await new Promise((r) => setTimeout(r, 20)); // Rate limit preventivo
      } catch (e) {
        continue;
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
