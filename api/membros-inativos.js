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
    CHAT_ID_BUSCAR,
  } = process.env;

  const canaisPermitidos = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
    : [];
  const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

  try {
    // 1. Busca Banco de Dados de Admissão
    let dadosRP = {};
    let ultimoIdAdmissao = null;
    if (org) {
      const targetAdm =
        org === "PRF"
          ? PRF_ADMISSAO_CH
          : org === "PMERJ"
          ? PMERJ_ADMISSAO_CH
          : ADMISSAO_CHANNEL_ID;

      if (targetAdm) {
        for (let i = 0; i < 5; i++) {
          let url = `https://discord.com/api/v10/channels/${targetAdm}/messages?limit=100`;
          if (ultimoIdAdmissao) url += `&before=${ultimoIdAdmissao}`;
          const resAdm = await fetch(url, { headers });
          const msgs = await resAdm.json();
          if (!msgs || msgs.length === 0) break;

          msgs.forEach((msg) => {
            const m = msg.content.match(/<@!?(\d+)>/);
            if (m && !dadosRP[m[1]]) {
              const nome = msg.content
                .replace(/\*/g, "")
                .match(/NOME\s*(?:DO\s*RP)?:\s*(.*)/i);
              const idCid = msg.content.match(
                /ID(?:\s*DA\s*CIDADE)?:\s*(\d+)/i
              );
              dadosRP[m[1]] = {
                nome: nome
                  ? nome[1].split("\n")[0].trim()
                  : "Nome não identificado",
                cidadeId: idCid ? idCid[1].trim() : "---",
              };
            }
          });
          ultimoIdAdmissao = msgs[msgs.length - 1].id;
        }
      }
    }

    // 2. Busca Membros (Incluso quem está de férias)
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    const TARGET_ROLE =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Filtra apenas pelo cargo da corporação, permitindo quem está de férias
    const oficiaisDaForca = members.filter((m) =>
      m.roles.includes(TARGET_ROLE)
    );

    // 3. Mapa de Atividade
    let activityMap = {};
    oficiaisDaForca.forEach((p) => {
      const nick = p.nick || p.user.username;
      const estaDeFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);

      activityMap[p.user.id] = {
        id: p.user.id,
        name: nick,
        rpName: dadosRP[p.user.id]?.nome || "Não consta em admissão",
        cidadeId:
          nick.match(/\|\s*(\d+)/)?.[1] ||
          dadosRP[p.user.id]?.cidadeId ||
          "---",
        lastMsg: 0,
        isFerias: estaDeFerias, // Nova propriedade para o Frontend
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : "https://cdn.discordapp.com/embed/avatars/0.png",
      };
    });

    // 4. Varredura PROFUNDA (Aumentado para 30 páginas = 3000 Mensagens)
    for (const channelId of canaisPermitidos) {
      let ultimoIdBusca = null;
      for (let p = 0; p < 30; p++) {
        try {
          let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
          if (ultimoIdBusca) url += `&before=${ultimoIdBusca}`;

          const msgRes = await fetch(url, { headers });
          const msgs = await msgRes.json();
          if (!msgs || msgs.length === 0) break;

          msgs.forEach((msg) => {
            const ts = new Date(msg.timestamp).getTime();
            const idsParaChecar = new Set();

            // Autor e menções diretas
            idsParaChecar.add(msg.author.id);
            if (msg.mentions)
              msg.mentions.forEach((m) => idsParaChecar.add(m.id));

            // Menções em texto (Regex robusta para <@ID> e <@!ID>)
            const mencoesTexto = msg.content.match(/<@!?(\d+)>/g);
            if (mencoesTexto) {
              mencoesTexto.forEach((m) =>
                idsParaChecar.add(m.replace(/\D/g, ""))
              );
            }

            // Busca em Embeds (Importante para Bots de cursos/prisões)
            if (msg.embeds && msg.embeds.length > 0) {
              msg.embeds.forEach((embed) => {
                const embedData = JSON.stringify(embed);
                const mencoesEmbed = embedData.match(/<@!?(\d+)>/g);
                if (mencoesEmbed) {
                  mencoesEmbed.forEach((m) =>
                    idsParaChecar.add(m.replace(/\D/g, ""))
                  );
                }
              });
            }

            // Atualiza timestamp se encontrar atividade mais recente
            idsParaChecar.forEach((userId) => {
              if (activityMap[userId] && ts > activityMap[userId].lastMsg) {
                activityMap[userId].lastMsg = ts;
              }
            });
          });
          ultimoIdBusca = msgs[msgs.length - 1].id;
        } catch (e) {
          break;
        }
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
