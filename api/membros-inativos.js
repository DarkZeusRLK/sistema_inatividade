// api/membros-inativos.js
// ATUALIZADO: "Não consta na aba de admissão" se não achar nome.
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
    POLICE_ROLE_IDS, // Lista de IDs de patentes para exibir o nome correto
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

    // 2. BUSCA TRIPLA: Membros + Mensagens Admissão + CARGOS DO SERVIDOR
    const [membersRes, admissaoRes, rolesRes] = await Promise.all([
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
    ]);

    if (!membersRes.ok)
      throw new Error(`Erro Discord Membros: ${membersRes.status}`);

    const oficiais = await membersRes.json();
    const serverRoles = rolesRes.ok ? await rolesRes.json() : [];

    // 3. MAPEAR NOMES DOS CARGOS (ID -> Nome)
    const idsPatentes = POLICE_ROLE_IDS
      ? POLICE_ROLE_IDS.split(",").map((i) => i.trim())
      : [];
    const mapRolesNames = {};
    serverRoles.forEach((r) => {
      mapRolesNames[r.id] = r.name;
    });

    // 4. MAPEAR NOMES RP (Canais de Admissão)
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
            const matchNome = msg.content.match(
              /(?:Nome|Nick|Oficial):\s*(.+?)(\n|$)/i
            );
            if (matchNome) {
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            }
          }
        });
      }
    }

    // 5. PROCESSAMENTO
    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      if (p.user.bot) return;

      // Filtro de Org (Só processa se tiver o cargo da policia selecionada)
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;

      const uid = p.user.id;

      const temCargoImune = p.roles.some((roleId) =>
        listaImunes.includes(roleId)
      );
      if (temCargoImune) return;

      const temFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);
      if (temFerias) return;

      let baseData = new Date(p.joined_at).getTime();
      const diffMs = agora - baseData;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDias >= 7) {
        // Tenta pegar o Passaporte do Nick (ex: "Dark | 1921")
        const apelido = p.nick || p.user.username;
        const matchPassaporte = apelido.match(/(\d+)/);
        const passaporte = matchPassaporte ? matchPassaporte[0] : "---";

        // --- MUDANÇA AQUI: LÓGICA DO NOME RP ---
        let nomeRpFinal = mapaNomesRP[uid];

        if (!nomeRpFinal) {
          // Se não achou na admissão, coloca a mensagem padrão
          nomeRpFinal = "Não consta na aba de admissão";
        }

        // --- LÓGICA DE PATENTE ---
        const idPatenteEncontrada = idsPatentes.find((id) =>
          p.roles.includes(id)
        );
        const nomePatente = idPatenteEncontrada
          ? mapRolesNames[idPatenteEncontrada]
          : "Oficial";

        resultado.push({
          id: uid,
          name: p.nick || p.user.username, // Apelido do Discord (Exibido na tabela)
          rpName: nomeRpFinal, // Nome RP ou Mensagem de Erro (Exibido no relatório)
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
