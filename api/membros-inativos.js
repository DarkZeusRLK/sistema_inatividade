module.exports = async (req, res) => {
  const { Discord_Bot_Token, GUILD_ID, POLICE_ROLE_ID } = process.env;

  // Teste de variáveis
  if (!Discord_Bot_Token)
    return res
      .status(500)
      .json({ error: "Variável Discord_Bot_Token não encontrada no .env" });
  if (!GUILD_ID)
    return res
      .status(500)
      .json({ error: "Variável GUILD_ID não encontrada no .env" });
  if (!POLICE_ROLE_ID)
    return res
      .status(500)
      .json({ error: "Variável POLICE_ROLE_ID não encontrada no .env" });

  try {
    const testRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}`,
      {
        headers: { Authorization: `Bot ${Discord_Bot_Token}` },
      }
    );

    if (testRes.status === 401)
      return res
        .status(401)
        .json({ error: "Token do Bot é inválido ou expirou." });
    if (testRes.status === 403)
      return res.status(403).json({
        error:
          "O Bot não está no servidor ou não tem permissão de ver o servidor.",
      });

    const data = await testRes.json();
    res
      .status(200)
      .json({ status: "Conexão com Discord OK!", servidor: data.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
