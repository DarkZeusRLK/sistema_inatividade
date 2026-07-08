// api/oficio-contador.js
//
// Retorna o próximo número de ofício para uma matriz (PMERJ/PCERJ/PRF),
// contando quantos ofícios daquela matriz já existem no canal do Discord.
//
// GET /api/oficio-contador.js?org=PMERJ
// -> { proximoNumero: 3, ultimoEncontrado: 2, totalMensagensLidas: 47 }
//
// Requer variável de ambiente DISCORD_BOT_TOKEN configurada no projeto Vercel
// (Settings > Environment Variables). O bot precisa estar no servidor do canal
// com permissão "Read Message History" no canal 1406087625080705034.

const CANAL_ID = "1406087625080705034";
const MAX_PAGINAS = 5; // 5 x 100 = até 500 mensagens mais recentes
const SIGLAS_VALIDAS = ["PMERJ", "PCERJ", "PRF"];

// Aceita variações de "º" (º, o, .) entre o número e a barra, ex:
// "OFÍCIO N.º 003/2026 - PMERJ" / "OFICIO No 3/2026 - PMERJ"
function extrairNumeroOficio(conteudo, sigla) {
  const regex = new RegExp(
    `OF[IÍ]CIO\\s+N[.\\u00ba°o]*\\s*(\\d{1,})\\s*/\\s*(\\d{4})\\s*-\\s*${sigla}\\b`,
    "i"
  );
  const match = conteudo.match(regex);
  return match ? parseInt(match[1], 10) : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ erro: "Método não permitido" });
    return;
  }

  const org = String(req.query.org || "").toUpperCase();
  if (!SIGLAS_VALIDAS.includes(org)) {
    res.status(400).json({ erro: "Parâmetro 'org' inválido. Use PMERJ, PCERJ ou PRF." });
    return;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ erro: "DISCORD_BOT_TOKEN não configurado no servidor." });
    return;
  }

  try {
    let maiorNumero = 0;
    let totalMensagensLidas = 0;
    let before = null;

    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const url = new URL(`https://discord.com/api/v10/channels/${CANAL_ID}/messages`);
      url.searchParams.set("limit", "100");
      if (before) url.searchParams.set("before", before);

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bot ${token}` },
      });

      if (!resp.ok) {
        throw new Error(`Discord API respondeu ${resp.status}`);
      }

      const mensagens = await resp.json();
      if (!Array.isArray(mensagens) || mensagens.length === 0) break;

      totalMensagensLidas += mensagens.length;

      for (const msg of mensagens) {
        // Considera tanto o texto da mensagem quanto embeds (título/descrição)
        const textos = [msg.content || ""];
        if (Array.isArray(msg.embeds)) {
          msg.embeds.forEach((embed) => {
            if (embed.title) textos.push(embed.title);
            if (embed.description) textos.push(embed.description);
          });
        }

        for (const texto of textos) {
          const numero = extrairNumeroOficio(texto, org);
          if (numero !== null && numero > maiorNumero) {
            maiorNumero = numero;
          }
        }
      }

      before = mensagens[mensagens.length - 1].id;
      if (mensagens.length < 100) break; // acabaram as mensagens do canal
    }

    res.status(200).json({
      proximoNumero: maiorNumero + 1,
      ultimoEncontrado: maiorNumero,
      totalMensagensLidas,
    });
  } catch (erro) {
    console.error("Erro ao consultar contador de ofício:", erro);
    res.status(502).json({ erro: "Falha ao consultar o Discord.", detalhe: String(erro.message || erro) });
  }
};
