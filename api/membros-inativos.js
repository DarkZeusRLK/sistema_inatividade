// api/membros-inativos.js - VERSÃO COM CARGOS IMUNES
// Usa o motor nativo do Node.js 18+

module.exports = async (req, res) => {
  // Configuração CORS
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
    CARGOS_IMUNES, // <--- 1. Nova variável capturada
  } = process.env;

  if (!Discord_Bot_Token) {
    return res
      .status(500)
      .json({ error: "Token do Bot não configurado no .env" });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  // 2. Transforma a string de imunes em Array
  const listaImunes = (CARGOS_IMUNES || "").split(",").map((id) => id.trim());

  const canaisScan = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 10)
    : [];

  try {
    console.log(`🚀 Iniciando auditoria para ${org || "GERAL"}...`);

    // =====================================================================
    // 1. MAPEAMENTO DE FÉRIAS (Mantido conforme original)
    // =====================================================================
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
              const txt = msg.content + JSON.stringify(msg.embeds || []);
              const mID = txt.match(/<@!?(\d+)>/) || txt.match(/(\d{17,20})/);
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
                if (!mapaFerias[userId] || dataVolta > mapaFerias[userId])
                  mapaFerias[userId] = dataVolta;
              }
            }
          });
        }
      } catch (e) {
        console.error("Erro Férias:", e.message);
      }
    }

    // =====================================================================
    // 2. BANCO DE DADOS DE ADMISSÃO (Mantido conforme original)
    // =====================================================================
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
                  passaporte: pass ? pass[1] : "---",
                  nome: nome
                    ? nome[1].replace(/\*/g, "").trim()
                    : "Desconhecido",
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

    // =====================================================================
    // 3. DEEP SCAN (Atividade em canais)
    // =====================================================================
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
              const idsEncontrados = new Set();
              idsEncontrados.add(msg.author.id);
              if (msg.mentions)
                msg.mentions.forEach((u) => idsEncontrados.add(u.id));
              const content = (
                msg.content + JSON.stringify(msg.embeds || [])
              ).toLowerCase();
              const regexIDs = content.match(/(\d{17,20})/g);
              if (regexIDs) regexIDs.forEach((id) => idsEncontrados.add(id));
              idsEncontrados.forEach((uid) => {
                if (!mapaAtividade[uid] || ts > mapaAtividade[uid])
                  mapaAtividade[uid] = ts;
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

    // =====================================================================
    // 4. PROCESSAMENTO FINAL (Com Filtro de Imunidade)
    // =====================================================================
    const rGuild = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    if (!rGuild.ok) throw new Error(`Erro Discord Guild (${rGuild.status})`);
    const members = await rGuild.json();

    const roleTarget =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // 3. FILTRO MODIFICADO: Remove quem for imune antes de processar
    const oficiais = members.filter((m) => {
      const temCargoBase = m.roles.includes(roleTarget);
      const ehImune = m.roles.some((roleId) => listaImunes.includes(roleId));
      return temCargoBase && !ehImune; // Só entra se tiver o cargo E não for imune
    });

    const resultado = [];
    const agora = Date.now();

    oficiais.forEach((p) => {
      const uid = p.user.id;
      const fimFerias = mapaFerias[uid];
      let ultimaMsg = mapaAtividade[uid] || 0;

      if (fimFerias && fimFerias > ultimaMsg) ultimaMsg = fimFerias;

      let protegido = false;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) protegido = true;
      if (fimFerias && fimFerias >= agora) {
        protegido = true;
        ultimaMsg = agora;
      }

      if (!protegido) {
        let baseCalc = ultimaMsg;
        if (baseCalc === 0) baseCalc = new Date(p.joined_at).getTime();

        const diffMs = agora - baseCalc;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDias >= 7) {
          const dRP = dadosRP[uid] || {};
          resultado.push({
            id: uid,
            name: p.nick || p.user.username,
            rpName: dRP.nome || p.nick || p.user.global_name,
            passaporte: dRP.passaporte || "---",
            cidadeId: dRP.passaporte || "---",
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
    res.status(500).json({ error: error.message || "Erro interno." });
  }
};
