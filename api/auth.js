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

    if (!memberRes.ok) {
      return res
        .status(401)
        .json({ error: "Membro não encontrado no servidor." });
    }

    const ORG_MAP = {
      [process.env.ROLE_ID_PCERJ?.trim()]: { id: "PCERJ", tema: "tema-pcerj" },
      [process.env.ROLE_ID_PRF?.trim()]: { id: "PRF", tema: "tema-prf" },
      [process.env.ROLE_ID_PMERJ?.trim()]: { id: "PMERJ", tema: "tema-pmerj" },
    };

    let userOrg = null;
    for (const roleId of memberData.roles) {
      if (ORG_MAP[roleId]) {
        userOrg = ORG_MAP[roleId];
        break;
      }
    }

    if (!userOrg)
      return res
        .status(403)
        .json({ error: "Acesso negado: Sem cargo administrativo." });

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
