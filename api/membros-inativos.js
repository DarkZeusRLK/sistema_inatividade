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

    // 1. Busca Banco de Dados de Admissão
    let dadosRP = {};
    let ultimoIdMsg = null;

    if (TARGET_ADMISSAO_CH) {
      for (let i = 0; i < 10; i++) {
        let url = `https://discord.com/api/v10/channels/${TARGET_ADMISSAO_CH}/messages?limit=100`;
        if (ultimoIdMsg) url += `&before=${ultimoIdMsg}`;

        const admissaoRes = await fetch(url, { headers });
        if (!admissaoRes.ok) break;

        const msgsAdmissao = await admissaoRes.json();
        if (msgsAdmissao.length === 0) break;

        msgsAdmissao.forEach((msg) => {
          const conteudoLimpo = msg.content.replace(/\*/g, "");
          const mencao = conteudoLimpo.match(/<@!?(\d+)>/);
          const nomeMatch = conteudoLimpo.match(/NOME\s*(?:DO\s*RP)?:\s*(.*)/i);
          const idMatch = conteudoLimpo.match(
            /ID(?:\s*DA\s*CIDADE)?:\s*(\d+)/i
          );

          if (mencao) {
            const userId = mencao[1];
            if (!dadosRP[userId]) {
              dadosRP[userId] = {
                nome: nomeMatch ? nomeMatch[1].split("\n")[0].trim() : null,
                cidadeId: idMatch ? idMatch[1].trim() : null,
              };
            }
          }
        });
        ultimoIdMsg = msgsAdmissao[msgsAdmissao.length - 1].id;
      }
    }

    // 2. Busca Membros do Servidor
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
      const nicknameDiscord = p.nick || p.user.username;

      let idFinal = "Não Identificado";
      if (infoRP && infoRP.cidadeId) {
        idFinal = infoRP.cidadeId;
      } else {
        const extrairIdDoNick = nicknameDiscord.match(/\|\s*(\d+)/);
        if (extrairIdDoNick) idFinal = extrairIdDoNick[1];
      }

      let nomeFinal = "Não consta em admissão";
      if (infoRP && infoRP.nome) {
        nomeFinal = infoRP.nome;
      }

      activityMap[p.user.id] = {
        id: p.user.id,
        name: nicknameDiscord,
        rpName: nomeFinal,
        cidadeId: idFinal,
        lastMsg: 0,
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // 4. Varredura de Canais (Atividade baseada em MENÇÕES)
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      { headers }
    );
    const textChannels = (await channelsRes.json()).filter((c) =>
      [0, 5, 11, 12].includes(c.type)
    );

    for (const channel of textChannels) {
      try {
        const msgRes = await fetch(
          `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100`,
          { headers }
        );
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          msgs.forEach((msg) => {
            // LÓGICA ALTERADA: Verifica se alguém do nosso mapa foi MENCIONADO na mensagem
            if (msg.mentions && msg.mentions.length > 0) {
              msg.mentions.forEach((mencionado) => {
                if (activityMap[mencionado.id]) {
                  const ts = new Date(msg.timestamp).getTime();
                  // Só atualiza se a menção encontrada for mais recente que a já salva
                  if (ts > activityMap[mencionado.id].lastMsg) {
                    activityMap[mencionado.id].lastMsg = ts;
                  }
                }
              });
            }
          });
        }
      } catch (e) {
        continue;
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
