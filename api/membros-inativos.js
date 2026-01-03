// api/membros-inativos.js - VERSÃO OTIMIZADA E SEGURA
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

  // Limpa e valida os IDs dos canais de chat/log
  const canaisScan = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 10)
    : [];

  try {
    console.log(`🚀 Iniciando auditoria para ${org || "GERAL"}...`);

    // =====================================================================
    // 1. MAPEAMENTO DE FÉRIAS (Leitura Rápida)
    // =====================================================================
    const mapaFerias = {}; // { userId: timestampVolta }

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
            // Pega ID por menção ou regex no texto
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
              // Regex para: volta, retorno, até, fim + data
              const match = texto.match(
                /(?:término|volta|retorno|até|fim|férias)[\s\S]*?(\d{1,2})\/(\d{1,2})/
              );

              if (match) {
                const dia = parseInt(match[1]);
                const mes = parseInt(match[2]) - 1;
                let ano = new Date().getFullYear();
                // Se estamos em Dezembro e a data é Janeiro, é ano que vem
                if (new Date().getMonth() === 11 && mes === 0) ano++;

                const dataVolta = new Date(ano, mes, dia, 23, 59, 59).getTime();

                // Salva a maior data encontrada
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

    // =====================================================================
    // 2. BANCO DE DADOS DE ADMISSÃO (Passaportes e Nomes)
    // =====================================================================
    const dadosRP = {};
    let canalAdm = ADMISSAO_CHANNEL_ID;
    if (org === "PRF") canalAdm = PRF_ADMISSAO_CH;
    if (org === "PMERJ") canalAdm = PMERJ_ADMISSAO_CH;

    if (canalAdm) {
      // Lê até 3 páginas (300 msgs) para não pesar
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
    // 3. DEEP SCAN: CHAT, LOGS, PRISÕES (Otimizado)
    // =====================================================================
    const mapaAtividade = {}; // { userId: timestamp }

    if (canaisScan.length > 0) {
      console.log(`📡 Escaneando ${canaisScan.length} canais...`);

      // Processa canais em PARALELO, mas com tratamento de erro individual
      const promises = canaisScan.map(async (canalId) => {
        let lastId = null;
        // LER 3 PÁGINAS (300 mensagens) é o equilíbrio ideal entre performance e histórico
        // Mais que isso causa o Erro 500 na Vercel
        for (let p = 0; p < 3; p++) {
          try {
            let url = `https://discord.com/api/v10/channels/${canalId}/messages?limit=100`;
            if (lastId) url += `&before=${lastId}`;

            const r = await fetch(url, { headers });
            // Se der erro no canal (ex: 403 Forbidden), para esse canal e segue a vida
            if (!r.ok) break;

            const msgs = await r.json();
            if (!msgs || msgs.length === 0) break;

            msgs.forEach((msg) => {
              const ts = new Date(msg.timestamp).getTime();
              const idsEncontrados = new Set();

              // 1. Autor
              idsEncontrados.add(msg.author.id);

              // 2. Menções do Discord (Campo específico)
              if (msg.mentions)
                msg.mentions.forEach((u) => idsEncontrados.add(u.id));

              // 3. Regex no Texto (Caso o bot apenas escreva o ID ou <@ID>)
              const content = (
                msg.content + JSON.stringify(msg.embeds || [])
              ).toLowerCase();

              // Procura padrões de ID do Discord (17 a 20 dígitos)
              const regexIDs = content.match(/(\d{17,20})/g);
              if (regexIDs) {
                regexIDs.forEach((id) => idsEncontrados.add(id));
              }

              // Salva atividade
              idsEncontrados.forEach((uid) => {
                if (!mapaAtividade[uid] || ts > mapaAtividade[uid]) {
                  mapaAtividade[uid] = ts;
                }
              });
            });
            lastId = msgs[msgs.length - 1].id;
          } catch (err) {
            console.error(`Erro ao ler canal ${canalId}:`, err.message);
            break;
          }
        }
      });

      await Promise.all(promises);
    }

    // =====================================================================
    // 4. PROCESSAMENTO FINAL
    // =====================================================================

    // Busca membros do servidor
    const rGuild = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    if (!rGuild.ok) {
      throw new Error(
        `Erro Discord Guild (${rGuild.status}) - Verifique o Token e GUILD_ID`
      );
    }
    const members = await rGuild.json();

    const roleTarget =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Filtra quem tem o cargo
    const oficiais = members.filter((m) => m.roles.includes(roleTarget));

    const resultado = [];
    const agora = Date.now();

    oficiais.forEach((p) => {
      const uid = p.user.id;
      const fimFerias = mapaFerias[uid];

      // Pega última atividade encontrada no scan
      let ultimaMsg = mapaAtividade[uid] || 0;

      // LÓGICA DO LOBO: Se a volta das férias é mais recente que a mensagem no chat, usa a data das férias
      if (fimFerias && fimFerias > ultimaMsg) {
        ultimaMsg = fimFerias;
      }

      // PROTEÇÃO: Se a data de volta é HOJE ou FUTURO, o oficial está "Ativo hoje"
      let protegido = false;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) protegido = true;
      if (fimFerias && fimFerias >= agora) {
        protegido = true;
        ultimaMsg = agora; // Zera o contador de inatividade
      }

      if (!protegido) {
        // Se nunca falou (0), usa a data de entrada no servidor como base
        // Mas limitamos a base para não dar 1000 dias (ex: usa 01/01/2024 como teto)
        let baseCalc = ultimaMsg;
        if (baseCalc === 0) {
          const joined = new Date(p.joined_at).getTime();
          // Se entrou antes de 2024, considera 01/01/2024 para não ficar feio
          // Se entrou semana passada, usa data real
          baseCalc = joined;
        }

        const diffMs = agora - baseCalc;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // FILTRO: Retorna apenas quem tem 7 ou mais dias
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

    console.log(`✅ Sucesso! ${resultado.length} inativos encontrados.`);
    res.status(200).json(resultado);
  } catch (error) {
    console.error("🔥 ERRO FATAL API:", error);
    // Retorna erro formatado para o frontend não dar "Failed to load"
    res
      .status(500)
      .json({ error: error.message || "Erro interno no servidor." });
  }
};
