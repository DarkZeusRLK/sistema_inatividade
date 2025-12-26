require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

// Note que aqui usamos "/" porque o arquivo já está na rota /api/auth
app.post("*", async (req, res) => {
  const { token } = req.body;

  try {
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID?.trim()}/member`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const memberData = await memberRes.json();
    if (!memberRes.ok)
      return res.status(401).json({ error: "Membro não encontrado." });

    // IDs vindos do seu arquivo .env
    const rolePCERJ = process.env.POLICE_ROLE_ID?.trim();
    const rolePRF = process.env.PRF_ROLE_ID?.trim();
    const rolePMERJ = process.env.PMERJ_ROLE_ID?.trim();

    let userOrg = null;

    // DEFINIÇÃO POR PRIORIDADE:
    // Verificamos primeiro as forças específicas (PMERJ/PRF)
    if (memberData.roles.includes(rolePMERJ)) {
      userOrg = { id: "PMERJ", tema: "tema-pmerj" };
    } else if (memberData.roles.includes(rolePRF)) {
      userOrg = { id: "PRF", tema: "tema-prf" };
    } else if (memberData.roles.includes(rolePCERJ)) {
      userOrg = { id: "PCERJ", tema: "tema-pcerj" };
    }

    if (!userOrg) {
      return res
        .status(403)
        .json({ error: "Você não tem um cargo autorizado para este painel." });
    }

    res.json({
      org: userOrg.id,
      tema: userOrg.tema,
      nome: memberData.nick || memberData.user.username,
    });
  } catch (err) {
    res.status(500).json({ error: "Falha na comunicação com o servidor." });
  }
});

module.exports = app;
