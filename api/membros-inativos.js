// api/membros-inativos.js
// VERSÃO FINAL CORRIGIDA:
// 1. Busca estrita por "Nome" ou "Nome RP" (Ignora Codinome)
// 2. Filtra por Org
// 3. Verifica atividade real (Chat/Menção)
// 4. Ignora Férias
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
    ADMISSAO_CHANNEL_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ADMISSAO_CH,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
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
    // 1. DEFINIÇÕES DE ORG
    let canalAdmissaoId = ADMISSAO_CHANNEL_ID;
    let cargoBaseOrg = POLICE_ROLE_ID;

    if (org === "PRF") {
      canalAdmissaoId = PRF_ADMISSAO_CH;
      cargoBaseOrg = PRF_ROLE_ID;
    }
    if (org === "PMERJ") {
      canalAdmissaoId = PMERJ_ADMISSAO_CH;
      cargoBaseOrg = PMERJ_ROLE_ID;
    }

    // 2. PREPARAR LISTA DE CANAIS DE ATIVIDADE
    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
      : [];

    // 3. FETCHS EM PARALELO
    const promisesAtividade = canaisAtividadeIds.map((id) =>
      fetch(`https://discord.com/api/v10/channels/${id}/messages?limit=100`, {
        headers,
      })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [])
    );

    const [membersRes, admissaoRes, rolesRes, ...mensagensAtividadeArrays] =
      await Promise.all([
        fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
          { headers }
        ),
        canalAdmissaoId
          ? fetch(
              `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
              { headers }
            )
          : Promise.resolve(null),
        fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
          headers,
        }),
        ...promisesAtividade,
      ]);

    if (!membersRes.ok)
      throw new Error(`Erro Discord Membros: ${membersRes.status}`);

    const oficiais = await membersRes.json();
    const serverRoles = rolesRes.ok ? await rolesRes.json() : [];

    // 4. MAPEAR CARGOS E NOMES
    const idsPatentes = POLICE_ROLE_IDS
      ? POLICE_ROLE_IDS.split(",").map((i) => i.trim())
      : [];
    const mapRolesNames = {};
    serverRoles.forEach((r) => (mapRolesNames[r.id] = r.name));

    // 5. MAPEAR NOMES RP (ADMISSÃO) - CORREÇÃO DO REGEX AQUI
    const mapaNomesRP = {};
    if (admissaoRes && admissaoRes.ok) {
      const mensagens = await admissaoRes.json();
      if (Array.isArray(mensagens)) {
        mensagens.forEach((msg) => {
          let userIdEncontrado = null;
          if (msg.mentions && msg.mentions.length > 0)
            userIdEncontrado = msg.mentions[0].id;
          else {
            const matchId = msg.content.match(/(\d{17,20})/);
            if (matchId) userIdEncontrado = matchId[0];
          }

          if (userIdEncontrado) {
            // REGEX NOVO: Busca especificamente por "Nome:", "Nome RP:", "Nome Civil:"
            // O (?:\n|^) garante que pegamos no começo da linha, evitando pegar meio de frase
            // O [^\n]* garante que pegamos o resto da linha
            const matchNome = msg.content.match(
              /(?:\n|^|\*)(?:Nome|Nome\s+RP|Nome\s+Civil|Identidade)[\s]*:[\s]*(.+?)(?:\n|$)/i
            );

            if (matchNome) {
              // Limpa negrito (**), itálico (*), código (`) e espaços extras
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            }
          }
        });
      }
    }

    // 6. MAPEAR ATIVIDADE REAL (AUTOR + MENÇÕES)
    const mapaUltimaAtividade = {};
    const atualizarAtividade = (userId, timestamp) => {
      const time = new Date(timestamp).getTime();
      if (!mapaUltimaAtividade[userId] || time > mapaUltimaAtividade[userId]) {
        mapaUltimaAtividade[userId] = time;
      }
    };

    mensagensAtividadeArrays.forEach((listaMensagens) => {
      if (Array.isArray(listaMensagens)) {
        listaMensagens.forEach((msg) => {
          atualizarAtividade(msg.author.id, msg.timestamp);
          if (msg.mentions && msg.mentions.length > 0) {
            msg.mentions.forEach((usuarioMarcado) => {
              atualizarAtividade(usuarioMarcado.id, msg.timestamp);
            });
          }
        });
      }
    });

    // 7. PROCESSAMENTO FINAL
    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      if (p.user.bot) return;
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;

      const uid = p.user.id;

      if (p.roles.some((roleId) => listaImunes.includes(roleId))) return;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) return;

      let baseData;
      if (mapaUltimaAtividade[uid]) {
        baseData = mapaUltimaAtividade[uid];
      } else {
        baseData = new Date(p.joined_at).getTime();
      }

      const diffMs = agora - baseData;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDias >= 7) {
        const apelido = p.nick || p.user.username;
        const matchPassaporte = apelido.match(/(\d+)/);
        const passaporte = matchPassaporte ? matchPassaporte[0] : "---";

        let nomeRpFinal = mapaNomesRP[uid];
        if (!nomeRpFinal) {
          nomeRpFinal = "Não consta na aba de admissão";
        }

        const idPatenteEncontrada = idsPatentes.find((id) =>
          p.roles.includes(id)
        );
        const nomePatente = idPatenteEncontrada
          ? mapRolesNames[idPatenteEncontrada]
          : "Oficial";

        resultado.push({
          id: uid,
          name: p.nick || p.user.username,
          rpName: nomeRpFinal,
          passaporte: passaporte,
          cargo: nomePatente,
          dias: diffDias,
          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
          joined_at: p.joined_at,
        });
      }
    });

    resultado.sort((a, b) => b.dias - a.dias);
    res.status(200).json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno no servidor API" });
  }
};
