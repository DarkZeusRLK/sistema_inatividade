// =========================================================
// CRON: PROCESSAMENTO AUTOMÁTICO DE FÉRIAS
// =========================================================
const { processarFerias } = require("./_ferias-service");

module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID,
  } = process.env;

  const env = {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID,
  };

  const orgs = ["PCERJ", "PMERJ", "PF", "PRF"];
  const resultado = {};

  try {
    for (const org of orgs) {
      try {
        resultado[org] = await processarFerias({ org, env });
      } catch (e) {
        resultado[org] = { error: e?.message || "Erro ao processar." };
      }
    }

    res.status(200).json({ ok: true, resultado });
  } catch (error) {
    console.error("Erro no cron-ferias:", error);
    res.status(500).json({ ok: false, error: "Erro interno no cron de férias." });
  }
};
