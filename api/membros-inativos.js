// api/membros-inativos.js - VERSÃO COM CORREÇÃO DE PASSAPORTE E DATA
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID,
    ADMISSAO_CHANNEL_ID,
    PRF_ROLE_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ROLE_ID,
    PMERJ_ADMISSAO_CH,
    CHAT_ID_BUSCAR,
  } = process.env;

  if (!Discord_Bot_Token) {
    return res.status(500).json({ error: "Token não configurado" });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const canaisScan = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 10)
    : [];

  try {
    console.log(`🚀 Iniciando auditoria para ${org || "GERAL"}...`);

    // 1. FÉRIAS
    const mapaFerias = {};
    if (FERIAS_CHANNEL_ID) {
      try {
        const r = await fetch(
          `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
          { headers }
        );
        if (r.ok) {
          const msgs = await r.json();
          msgs.forEach((msg) => {
            let userId = null;
            if (msg.mentions && msg.mentions.length > 0)
              userId = msg.mentions[0].id;
            else {
              const mID =
                msg.content.match(/<@!?(\d+)>/) ||
                msg.content.match(/(\d{17,20})/);
              if (mID) userId = mID[1];
            }

            if (userId) {
              const texto = (
                msg.content +
                " " +
                JSON.stringify(msg.embeds || [])
              ).toLowerCase();
              const match = texto.match(
                /(?:término|volta|retorno|até|fim|férias)[\s\S]*?(\d{1,2})\/(\d{1,2})/
              );
              if (match) {
                const dia = parseInt(match[1]);
                const mes = parseInt(match[2]) - 1;
                let ano = new Date().getFullYear();
                if (new Date().getMonth() === 11 && mes === 0) ano++;
                const dataVolta = new Date(ano, mes, dia, 23, 59, 59).getTime();
                if (!mapaFerias[userId] || dataVolta > mapaFerias[userId]) {
                  mapaFerias[userId] = dataVolta;
                }
              }
            }
          });
        }
      } catch (e) {}
    }

    // 2. DADOS RP (ADMISSÃO)
    const dadosRP = {};
    let canalAdm = ADMISSAO_CHANNEL_ID;
    if (org === "PRF") canalAdm = PRF_ADMISSAO_CH;
    if (org === "PMERJ") canalAdm = PMERJ_ADMISSAO_CH;

    if (canalAdm) {
      let last = null;
      for (let i = 0; i < 3; i++) {
        try {
          let url = `https://discord.com/api/v10/channels/${canalAdm}/messages?limit=100`;
          if (last) url += `&before=${last}`;
          const r = await fetch(url, { headers });
          if (!r.ok) break;
          const m = await r.json();
          if (m.length === 0) break;

          m.forEach((msg) => {
            const uidMatch = msg.content.match(/<@!?(\d+)>/);
            if (uidMatch) {
              const uid = uidMatch[1];
              if (!dadosRP[uid]) {
                const pass = msg.content.match(/(?:Passaporte|ID)[:\s]*(\d+)/i);
                const nome = msg.content.match(/(?:Nome|RP)[:\s]*([^\n]+)/i);
                dadosRP[uid] = {
                  passaporte: pass ? pass[1] : null,
                  nome: nome ? nome[1].replace(/\*/g, "").trim() : null,
                };
              }
            }
          });
          last = m[m.length - 1].id;
        } catch (e) {
          break;
        }
      }
    }

    // 3. SCAN DE ATIVIDADE
    const mapaAtividade = {};
    if (canaisScan.length > 0) {
      const promises = canaisScan.map(async (canalId) => {
        let lastId = null;
        for (let p = 0; p < 3; p++) {
          try {
            let url = `https://discord.com/api/v10/channels/${canalId}/messages?limit=100`;
            if (lastId) url += `&before=${lastId}`;
            const r = await fetch(url, { headers });
            if (!r.ok) break;
            const msgs = await r.json();
            if (!msgs || msgs.length === 0) break;

            msgs.forEach((msg) => {
              const ts = new Date(msg.timestamp).getTime();
              const ids = new Set([msg.author.id]);
              if (msg.mentions) msg.mentions.forEach((u) => ids.add(u.id));
              const txt = (
                msg.content + JSON.stringify(msg.embeds || [])
              ).toLowerCase();
              const regexIDs = txt.match(/(\d{17,20})/g);
              if (regexIDs) regexIDs.forEach((id) => ids.add(id));

              ids.forEach((uid) => {
                if (!mapaAtividade[uid] || ts > mapaAtividade[uid]) {
                  mapaAtividade[uid] = ts;
                }
              });
            });
            lastId = msgs[msgs.length - 1].id;
          } catch (err) {
            break;
          }
        }
      });
      await Promise.all(promises);
    }

    // 4. PROCESSAMENTO FINAL
    const rGuild = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    if (!rGuild.ok) throw new Error("Erro Discord Guild");
    const members = await rGuild.json();

    const roleTarget =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    const oficiais = members.filter((m) => m.roles.includes(roleTarget));
    const resultado = [];
    const agora = Date.now();

    oficiais.forEach((p) => {
      const uid = p.user.id;
      const dRP = dadosRP[uid] || {};

      // LÓGICA DE PASSAPORTE INTELIGENTE
      // 1. Tenta pegar do banco de dados (Canal Admissão)
      // 2. Se não tiver, tenta extrair do apelido (Ex: "João | 2584")
      let passaporteFinal = dRP.passaporte;
      if (!passaporteFinal) {
        const nick = p.nick || "";
        // Tenta pegar números após uma barra vertical ou no final da string
        const matchNick =
          nick.match(/\|\s*(\d+)/) || nick.match(/\s(\d{3,6})$/);
        if (matchNick) passaporteFinal = matchNick[1];
        else passaporteFinal = "---";
      }

      let rpNameFinal =
        dRP.nome || p.nick || p.user.global_name || p.user.username;

      let fimFerias = mapaFerias[uid];
      let ultimaMsg = mapaAtividade[uid] || 0;

      if (fimFerias && fimFerias > ultimaMsg) ultimaMsg = fimFerias;

      let protegido = false;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) protegido = true;
      if (fimFerias && fimFerias >= agora) {
        protegido = true;
        ultimaMsg = agora;
      }

      if (!protegido) {
        // Se nunca falou (0), usa Joined At, mas com teto (para não dar 5 anos de inatividade)
        let baseCalc = ultimaMsg;
        if (baseCalc === 0) {
          baseCalc = new Date(p.joined_at).getTime();
        }

        const diffMs = agora - baseCalc;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDias >= 7) {
          resultado.push({
            id: uid, // ID REAL DISCORD (Snowflake)
            name: p.nick || p.user.username,
            rpName: rpNameFinal,
            cidadeId: passaporteFinal, // PASSAPORTE (Do banco ou do nick)
            dias: diffDias,
            lastMsg: ultimaMsg,
            avatar: p.user.avatar
              ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
              : null,
          });
        }
      }
    });

    resultado.sort((a, b) => b.dias - a.dias);
    res.status(200).json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
