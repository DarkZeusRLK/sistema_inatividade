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
                nome: nome ? nome[1].split("\n")[0].trim() : null,
                cidadeId: idCid ? idCid[1].trim() : null,
              };
            }
          });
          ultimoIdAdmissao = msgs[msgs.length - 1].id;
        }
      }
    }

    // 2. Busca Membros
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
    const oficiaisDaForca = members.filter(
      (m) =>
        m.roles.includes(TARGET_ROLE) &&
        (!FERIAS_ROLE_ID || !m.roles.includes(FERIAS_ROLE_ID))
    );

    // 3. Mapa de Atividade
    let activityMap = {};
    oficiaisDaForca.forEach((p) => {
      const nick = p.nick || p.user.username;
      activityMap[p.user.id] = {
        id: p.user.id,
        name: nick,
        rpName: dadosRP[p.user.id]?.nome || "Não consta em admissão",
        cidadeId:
          nick.match(/\|\s*(\d+)/)?.[1] ||
          dadosRP[p.user.id]?.cidadeId ||
          "---",
        lastMsg: 0,
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // 4. Varredura PROFUNDA (20 Páginas = 2000 Mensagens)
    for (const channelId of canaisPermitidos) {
      let ultimoIdBusca = null;
      for (let p = 0; p < 20; p++) {
        // Aumentado para 2000 mensagens para alcançar dias anteriores
        try {
          let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
          if (ultimoIdBusca) url += `&before=${ultimoIdBusca}`;
          const msgRes = await fetch(url, { headers });
          const msgs = await msgRes.json();
          if (!msgs || msgs.length === 0) break;

          msgs.forEach((msg) => {
            const ts = new Date(msg.timestamp).getTime();
            const idsParaChecar = new Set();

            // Captura autor
            idsParaChecar.add(msg.author.id);
            // Captura menções padrão
            if (msg.mentions)
              msg.mentions.forEach((m) => idsParaChecar.add(m.id));

            // LÓGICA EXTRA: Captura menções dentro de TEXTO ou EMBEDS (Bots/Webhooks)
            // Procura o padrão <@ID> ou <@!ID>
            const mencoesTexto = msg.content.match(/<@!?(\d+)>/g);
            if (mencoesTexto)
              mencoesTexto.forEach((m) => idsParaChecar.add(m.match(/\d+/)[0]));

            if (msg.embeds) {
              msg.embeds.forEach((embed) => {
                const fullEmbedText = JSON.stringify(embed);
                const mencoesEmbed = fullEmbedText.match(/<@!?(\d+)>/g);
                if (mencoesEmbed)
                  mencoesEmbed.forEach((m) =>
                    idsParaChecar.add(m.match(/\d+/)[0])
                  );
              });
            }

            // Atualiza o mapa se o ID estiver na lista de oficiais
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
