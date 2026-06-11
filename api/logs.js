/*
async function buscarLogsExoneracaoDiscord(env) {
  const { Discord_Bot_Token, EXONERACAO_CHANNEL_ID } = env;
  if (!Discord_Bot_Token || !EXONERACAO_CHANNEL_ID) return [];

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const mensagens = [];
  let before = null;

  for (let i = 0; i < 6; i++) {
    const url = `https://discord.com/api/v10/channels/${EXONERACAO_CHANNEL_ID}/messages?limit=100${
      before ? `&before=${before}` : ""
    }`;
    const response = await fetch(url, { headers });
    if (!response.ok) break;

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    mensagens.push(...batch);
    before = batch[batch.length - 1].id;
  }

  return mensagens
    .map((msg) => {
      const content = String(msg?.content || "");
      if (!content.startsWith("SITE_LOG_EXONERACAO::")) return null;

      try {
        return {
          id: msg.id,
          ...JSON.parse(content.slice("SITE_LOG_EXONERACAO::".length)),
        };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}
*/