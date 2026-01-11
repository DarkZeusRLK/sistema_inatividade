// api/membros-inativos.js
// VERSÃO FINAL: DATA FORMATADA + DIAS CORRIDOS (SEPARADOS)
module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { org } = req.query;

  // Variáveis de Ambiente
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    // Canais
    ADMISSAO_CHANNEL_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ADMISSAO_CH,
    PF_ADMISSAO_CH,
    // Cargos
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID,
    // Configs
    CARGOS_IMUNES,
    POLICE_ROLE_IDS,
    CHAT_ID_BUSCAR,
  } = process.env;

  if (!Discord_Bot_Token) {
    return res.status(500).json({ error: "Token do Bot não configurado." });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    const fetch = global.fetch || require("node-fetch");

    // 1. SELEÇÃO DE ORG
    let canalAdmissaoId = ADMISSAO_CHANNEL_ID;
    let cargoBaseOrg = POLICE_ROLE_ID;

    if (org === "PRF") {
      canalAdmissaoId = PRF_ADMISSAO_CH;
      cargoBaseOrg = PRF_ROLE_ID;
    } else if (org === "PMERJ") {
      canalAdmissaoId = PMERJ_ADMISSAO_CH;
      cargoBaseOrg = PMERJ_ROLE_ID;
    } else if (org === "PF") {
      canalAdmissaoId = PF_ADMISSAO_CH;
      cargoBaseOrg = PF_ROLE_ID;
    }

    // 2. CANAIS DE ATIVIDADE
    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
      : [];

    // 3. BUSCAS PARALELAS
    const promisesAtividade = canaisAtividadeIds.map((id) =>
      fetch(`https://discord.com/api/v10/channels/${id}/messages?limit=100`, {
        headers,
      })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [])
    );

    const [membersRes, admissaoRes, rolesRes, ...mensagensAtividadeArrays] =
      await Promise.all([
        // A. Membros
        fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
          { headers }
        ),
        // B. Admissão
        canalAdmissaoId
          ? fetch(
              `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
              { headers }
            )
          : Promise.resolve(null),
        // C. Cargos
        fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
          headers,
        }),
        // D. Atividade
        ...promisesAtividade,
      ]);

    if (!membersRes.ok) throw new Error(`Erro Membros: ${membersRes.status}`);

    const oficiais = await membersRes.json();
    const serverRoles = rolesRes.ok ? await rolesRes.json() : [];

    // 4. MAPEAR PATENTES
    const idsPatentes = POLICE_ROLE_IDS ? POLICE_ROLE_IDS.split(",") : [];
    const mapRolesNames = {};
    serverRoles.forEach((r) => (mapRolesNames[r.id] = r.name));

    // 5. PROCESSAR ADMISSÃO
    const mapaNomesRP = {};
    const mapaPassaporteRP = {};

    if (admissaoRes && admissaoRes.ok) {
      const mensagens = await admissaoRes.json();
      if (Array.isArray(mensagens)) {
        mensagens.forEach((msg) => {
          let userIdEncontrado = null;

          if (msg.mentions && msg.mentions.length > 0) {
            userIdEncontrado = msg.mentions[0].id;
          } else {
            const tudoJunto = JSON.stringify(msg);
            const matchId = tudoJunto.match(/(\d{17,20})/);
            if (matchId) userIdEncontrado = matchId[0];
          }

          if (userIdEncontrado) {
            let textoAnalise = msg.content || "";
            if (msg.embeds && msg.embeds.length > 0) {
              msg.embeds.forEach((embed) => {
                textoAnalise += `\n ${embed.title || ""} \n ${
                  embed.description || ""
                }`;
                if (embed.fields) {
                  embed.fields.forEach((f) => {
                    textoAnalise += `\n ${f.name}: ${f.value}`;
                  });
                }
              });
            }

            const matchNome = textoAnalise.match(
              /(?:Nome(?:\s+RP|\s+Civil)?|Identidade|Membro)(?:[\s\W]*):(?:\s*)(.*?)(?:\n|$|\||•)/i
            );

            const matchPassaporte = textoAnalise.match(
              /(?:Passaporte|ID|Identidade|Rg|Registro)(?:[\s\W]*):(?:\s*)(\d+)/i
            );

            if (matchNome) {
              let nomeBruto = matchNome[1];
              mapaNomesRP[userIdEncontrado] = nomeBruto
                .replace(/[*_`]/g, "")
                .trim();
            }

            if (matchPassaporte) {
              mapaPassaporteRP[userIdEncontrado] = matchPassaporte[1].trim();
            }
          }
        });
      }
    }

    // 6. MAPEAR ATIVIDADE (Chat)
    const mapaUltimaAtividade = {};
    const atualizarAtividade = (userId, timestamp) => {
      const time = new Date(timestamp).getTime();
      if (!mapaUltimaAtividade[userId] || time > mapaUltimaAtividade[userId]) {
        mapaUltimaAtividade[userId] = time;
      }
    };

    mensagensAtividadeArrays.forEach((lista) => {
      if (Array.isArray(lista)) {
        lista.forEach((msg) => {
          atualizarAtividade(msg.author.id, msg.timestamp);
          if (msg.mentions) {
            msg.mentions.forEach((u) =>
              atualizarAtividade(u.id, msg.timestamp)
            );
          }
        });
      }
    });

    // 7. GERAÇÃO DO RELATÓRIO
    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      if (p.user.bot) return;
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;

      const uid = p.user.id;

      if (p.roles.some((r) => listaImunes.includes(r))) return;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) return;

      // --- CÁLCULO DE DATAS E FORMATOS ---
      let baseData = mapaUltimaAtividade[uid];
      let diffDias;

      // Strings que serão exibidas
      let textoData = "Sem registro";
      let textoDias = "---";

      if (baseData) {
        // 1. Calcula Diferença
        diffDias = Math.floor((agora - baseData) / (1000 * 60 * 60 * 24));

        // 2. Formata Data (DD/MM/AAAA)
        const dataObj = new Date(baseData);
        const dia = String(dataObj.getDate()).padStart(2, "0");
        const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
        const ano = dataObj.getFullYear();
        textoData = `${dia}/${mes}/${ano}`;

        // 3. Formata Dias Corridos
        textoDias = `${diffDias} dias`;
      } else {
        // Sem registro recente
        diffDias = 99999;
        textoData = "Sem registro";
        textoDias = "---";
      }

      // Filtra apenas quem tem 7 dias ou mais (ou sem registro)
      if (diffDias >= 7) {
        const apelido = p.nick || p.user.username;
        let passaporte = "---";

        // Passaporte
        if (mapaPassaporteRP[uid]) {
          passaporte = mapaPassaporteRP[uid];
        } else {
          if (apelido.includes("|")) {
            const partes = apelido.split("|");
            const ultima = partes[partes.length - 1].trim();
            if (/^\d+$/.test(ultima)) passaporte = ultima;
          } else {
            const nums = apelido.match(/(\d+)/g);
            if (nums) passaporte = nums[nums.length - 1];
          }
        }

        // Nome RP
        let nomeRp = mapaNomesRP[uid];
        if (!nomeRp) {
          nomeRp = apelido
            .replace(/\[.*?\]/g, "")
            .replace(/\(.*?\)/g, "")
            .split("|")[0]
            .replace(/[0-9]/g, "")
            .replace(/[^\w\s\u00C0-\u00FF]/g, "")
            .trim();

          if (!nomeRp) nomeRp = "Não identificado";
        }

        // Patente
        const idPatente = idsPatentes.find((id) => p.roles.includes(id));
        const nomePatente = idPatente ? mapRolesNames[idPatente] : "Oficial";

        resultado.push({
          id: uid,
          name: apelido,
          rpName: nomeRp,
          passaporte: passaporte,
          cargo: nomePatente,

          // --- CAMPOS FORMATADOS PARA O FRONTEND ---
          dataUltimaMsg: textoData, // Ex: "14/12/2025"
          dias: textoDias, // Ex: "10 dias"
          diasNumber: diffDias, // Numérico (para ordenação)

          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
          joined_at: p.joined_at,
        });
      }
    });

    // Ordena pelo número de dias (invisível)
    resultado.sort((a, b) => b.diasNumber - a.diasNumber);

    // Remove o auxiliar antes de enviar
    const final = resultado.map((item) => {
      const { diasNumber, ...resto } = item;
      return resto;
    });

    res.status(200).json(final);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
};
