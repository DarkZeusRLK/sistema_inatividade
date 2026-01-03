// VERSÃO: DEEP SCAN (Busca em Autores, Menções e Embeds)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

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

  if (!Discord_Bot_Token)
    return res.status(500).json({ error: "Token ausente." });

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  // Separa os IDs dos canais de log/chat
  const canaisParaEscanear = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 5)
    : [];

  try {
    console.log("🚀 Iniciando Auditoria Deep Scan...");

    // =================================================================
    // 1. MAPEAMENTO DE FÉRIAS (Lógica de Datas)
    // =================================================================
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
              const regex =
                /(?:término|volta|retorno|até|fim|férias)[\s\S]*?(\d{1,2})\/(\d{1,2})/;
              const match = texto.match(regex);
              if (match) {
                const dia = parseInt(match[1]);
                const mes = parseInt(match[2]) - 1;
                let ano = new Date().getFullYear();
                // Virada de ano
                if (new Date().getMonth() === 11 && mes === 0) ano++;
                const dataVolta = new Date(ano, mes, dia, 23, 59, 59).getTime();

                if (!mapaFerias[userId] || dataVolta > mapaFerias[userId]) {
                  mapaFerias[userId] = dataVolta;
                }
              }
            }
          });
        }
      } catch (e) {
        console.error("Erro Férias:", e.message);
      }
    }

    // =================================================================
    // 2. ADMISSÃO (Nomes e Passaportes)
    // =================================================================
    const dadosRP = {};
    let canalAdm = ADMISSAO_CHANNEL_ID;
    if (org === "PRF") canalAdm = PRF_ADMISSAO_CH;
    if (org === "PMERJ") canalAdm = PMERJ_ADMISSAO_CH;

    if (canalAdm) {
      let last = null;
      for (let i = 0; i < 4; i++) {
        // Lê 400 msgs de admissão
        try {
          let url = `https://discord.com/api/v10/channels/${canalAdm}/messages?limit=100`;
          if (last) url += `&before=${last}`;
          const r = await fetch(url, { headers });
          if (!r.ok) break;
          const m = await r.json();
          if (m.length === 0) break;

          m.forEach((msg) => {
            const matchUser = msg.content.match(/<@!?(\d+)>/);
            if (matchUser) {
              const uid = matchUser[1];
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

    // =================================================================
    // 3. MAPA DE ATIVIDADE (DEEP SCAN: CHAT + LOGS + MENÇÕES)
    // =================================================================
    const mapaAtividade = {}; // { userId: timestamp }

    if (canaisParaEscanear.length > 0) {
      console.log(
        `📡 Escaneando ${canaisParaEscanear.length} canais de Logs/Chat...`
      );

      const promises = canaisParaEscanear.map(async (canalId) => {
        let lastId = null;
        // Lê 5 páginas (500 mensagens) de cada canal. Isso cobre MUITA atividade.
        for (let p = 0; p < 5; p++) {
          try {
            let url = `https://discord.com/api/v10/channels/${canalId}/messages?limit=100`;
            if (lastId) url += `&before=${lastId}`;

            const r = await fetch(url, { headers });
            if (!r.ok) break; // Canal não existe ou sem permissão
            const msgs = await r.json();
            if (!msgs || msgs.length === 0) break;

            msgs.forEach((msg) => {
              const ts = new Date(msg.timestamp).getTime();

              // LISTA DE PESSOAS ATIVAS NESSA MENSAGEM
              const idsAtivos = new Set();

              // 1. O Autor da mensagem (Óbvio)
              idsAtivos.add(msg.author.id);

              // 2. Menções Diretas (Bots marcando oficiais em logs)
              if (msg.mentions) {
                msg.mentions.forEach((u) => idsAtivos.add(u.id));
              }

              // 3. Busca de IDs dentro do Conteúdo (Caso não tenha marcado azul)
              const regexContent = /<@!?(\d+)>/g;
              const matches = msg.content.match(regexContent);
              if (matches) {
                matches.forEach((m) => idsAtivos.add(m.replace(/\D/g, "")));
              }

              // 4. Busca de IDs dentro de EMBEDS (Essencial para logs de bot)
              if (msg.embeds && msg.embeds.length > 0) {
                const embedStr = JSON.stringify(msg.embeds);
                const embedMatches =
                  embedStr.match(/<@!?(\d+)>/g) ||
                  embedStr.match(/(\d{17,20})/g);
                if (embedMatches) {
                  embedMatches.forEach((m) =>
                    idsAtivos.add(m.replace(/\D/g, ""))
                  );
                }
              }

              // Atualiza o horário de atividade para todos encontrados
              idsAtivos.forEach((uid) => {
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

    // =================================================================
    // 4. PROCESSAMENTO FINAL
    // =================================================================
    const rGuild = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    if (!rGuild.ok) throw new Error("Erro ao ler membros da guilda");
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
      const fimFerias = mapaFerias[uid];

      // Pega a atividade mais recente encontrada no Deep Scan
      let ultimaMsg = mapaAtividade[uid] || 0;

      // LÓGICA DO LOBO (Férias Recentes)
      if (fimFerias && fimFerias > ultimaMsg) {
        ultimaMsg = fimFerias;
      }

      // Proteções (Cargo de Férias ou Data Futura)
      let protegido = false;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) protegido = true;
      if (fimFerias && fimFerias >= agora) protegido = true;

      if (!protegido) {
        // Se nunca falou (0), considera inativo desde a entrada no server
        // Mas limitamos a uma data base para não dar 1000 dias
        let baseCalc = ultimaMsg;
        if (baseCalc === 0) {
          // Se não achou nada, usa a data de entrada do membro
          baseCalc = new Date(p.joined_at).getTime();
        }

        const diffMs = agora - baseCalc;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // FILTRO DE 7 DIAS
        if (diffDias >= 7) {
          const dRP = dadosRP[uid] || {};
          resultado.push({
            id: uid,
            name: p.nick || p.user.username,
            rpName: dRP.nome || p.nick || p.user.global_name,
            passaporte: dRP.passaporte || "---",
            cidadeId: dRP.passaporte || "---",
            dias: diffDias,
            lastMsg: ultimaMsg, // Manda 0 se não achou msg, ou timestamp real
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
    console.error("Erro API:", error);
    res.status(500).json({ error: error.message });
  }
};
