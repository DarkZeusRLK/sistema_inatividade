// api/membros-inativos.js
// ATUALIZADO: Busca Nome do RP nos canais de Admissão
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
    ADMISSAO_CHANNEL_ID, // PCERJ (Padrão)
    PRF_ADMISSAO_CH, // PRF
    PMERJ_ADMISSAO_CH, // PMERJ
    CARGOS_IMUNES,
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

  try {
    // 1. DEFINIR CANAL DE ADMISSÃO COM BASE NA ORG
    let canalAdmissaoId = ADMISSAO_CHANNEL_ID; // Padrão PCERJ
    if (org === "PRF") canalAdmissaoId = PRF_ADMISSAO_CH;
    if (org === "PMERJ") canalAdmissaoId = PMERJ_ADMISSAO_CH;

    // 2. BUSCAR DADOS EM PARALELO (Membros + Mensagens do Canal de Admissão)
    // Buscamos as últimas 100 mensagens para mapear os nomes
    const [membersRes, admissaoRes] = await Promise.all([
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
    ]);

    if (!membersRes.ok) {
      throw new Error(`Erro Discord: ${membersRes.status}`);
    }

    const oficiais = await membersRes.json();

    // 3. CRIAR MAPA DE NOMES RP (ID do Discord -> Nome na Admissão)
    const mapaNomesRP = {};

    if (admissaoRes && admissaoRes.ok) {
      const mensagens = await admissaoRes.json();
      if (Array.isArray(mensagens)) {
        mensagens.forEach((msg) => {
          // Tenta encontrar menções ou IDs na mensagem
          let userIdEncontrado = null;

          // Se tiver menção direta <@ID>
          if (msg.mentions && msg.mentions.length > 0) {
            userIdEncontrado = msg.mentions[0].id;
          }
          // Se tiver ID no texto
          else {
            const matchId = msg.content.match(/(\d{17,20})/);
            if (matchId) userIdEncontrado = matchId[0];
          }

          if (userIdEncontrado) {
            // Tenta extrair o nome. Padrões comuns: "Nome: Fulano" ou "Nick: Fulano"
            // Pega tudo depois de "Nome:" até o fim da linha
            const matchNome = msg.content.match(
              /(?:Nome|Nick|Oficial):\s*(.+?)(\n|$)/i
            );
            if (matchNome) {
              // Limpa formatação negrito/itálico se houver
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            }
          }
        });
      }
    }

    // 4. PROCESSAMENTO DE INATIVIDADE
    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      // Pula bots
      if (p.user.bot) return;

      const uid = p.user.id;

      // Verifica Imunidade por Cargo
      const temCargoImune = p.roles.some((roleId) =>
        listaImunes.includes(roleId)
      );
      if (temCargoImune) return;

      // Verifica Férias
      const temFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);
      if (temFerias) return;

      // Cálculo de Inatividade (Baseado na entrada no servidor se não tiver mensagem)
      // Como não temos acesso fácil a "Last Message" via API simples sem Gateway,
      // usaremos 'joined_at' como base se não houver outra métrica.
      // *NOTA: Para precisão exata de chat, seria necessário um banco de dados externo.*
      // Aqui assumimos a lógica de dias corridos desde a entrada ou data fixa.

      let baseData = new Date(p.joined_at).getTime();

      // Fallback para a Data Fixa do script se 'joined_at' for muito antigo e queremos auditar a partir de X
      // Mas para inatividade real, usamos joined_at.

      const diffMs = agora - baseData;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Filtro básico de 7 dias para listar
      if (diffDias >= 7) {
        // Tenta pegar o Passaporte do Nick (ex: "Dark | 1921" -> "1921")
        const apelido = p.nick || p.user.username;
        const matchPassaporte = apelido.match(/(\d+)/);
        const passaporte = matchPassaporte ? matchPassaporte[0] : "---";

        // Tenta pegar o Nome RP do Mapa de Admissões, se não achar, usa o Nick sem números
        let nomeRpFinal = mapaNomesRP[uid];
        if (!nomeRpFinal) {
          nomeRpFinal = apelido.replace(/[\d|]/g, "").trim(); // Fallback
        }

        // Pega o cargo mais alto (simplificado)
        const cargo = p.roles.length > 0 ? "Oficial" : "Recruta"; // Lógica simplificada pois precisaria mapear Roles

        resultado.push({
          id: uid,
          name: p.nick || p.user.username, // NOME QUE VAI APARECER NA TABELA (Nick Discord)
          rpName: nomeRpFinal, // NOME QUE VAI PARA O RELATÓRIO (Do canal de admissão)
          passaporte: passaporte,
          cargo: cargo,
          dias: diffDias,
          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
          joined_at: p.joined_at,
        });
      }
    });

    res.status(200).json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno no servidor API" });
  }
};
