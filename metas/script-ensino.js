window.copiarRelatorioEnsino = function () {
  const corpo = document.getElementById("corpo-ensino");
  const dataIn = document.getElementById("data-inicio-ensino")?.value;
  const dataFi = document.getElementById("data-fim-ensino")?.value;
  const sessao =
    typeof obterSessao === "function" ? obterSessao() : { org: "SISTEMA" };

  if (
    !corpo ||
    corpo.rows.length === 0 ||
    corpo.innerText.includes("Sincronizando") ||
    corpo.innerText.includes("Nenhum")
  ) {
    if (typeof mostrarAviso === "function")
      mostrarAviso("Não há dados para copiar!", "warning");
    return;
  }

  // Formatação das datas para o padrão brasileiro no texto
  const formatarData = (data) =>
    data ? data.split("-").reverse().join("/") : null;
  const dInicio = formatarData(dataIn) || "Início";
  const dFim = formatarData(dataFi) || "Hoje";

  // Cabeçalho Formal
  let texto = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `📑 **RELATÓRIO DE PRODUTIVIDADE - ENSINO**\n`;
  texto += `🏢 **UNIDADE:** ${sessao.org}\n`;
  texto += `📅 **PERÍODO:** ${dInicio} até ${dFim}\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  texto += `> 🎖️ **QUADRO DE DESEMPENHO DOS INSTRUTORES**\n\n`;

  let totalGeralCursos = 0;
  let totalGeralRecs = 0;

  Array.from(corpo.rows).forEach((row, index) => {
    const col = row.cells;
    if (col.length >= 5) {
      const nome = col[0].innerText.trim();
      const id = col[1].innerText.trim();
      const cursos = parseInt(col[2].innerText.trim()) || 0;
      const recs = parseInt(col[3].innerText.trim()) || 0;
      const total = col[4].innerText.trim();

      totalGeralCursos += cursos;
      totalGeralRecs += recs;

      // Medalha para o TOP 1
      const medalha =
        index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "🔹 ";

      texto += `${medalha}**${nome}** [${id}]\n`;
      texto += `├  Cursos Ministrados: \`${cursos
        .toString()
        .padStart(2, "0")}\`\n`;
      texto += `├  Recrutamentos: \`${recs.toString().padStart(2, "0")}\`\n`;
      texto += `└  **PONTUAÇÃO TOTAL: ${total}**\n\n`;
    }
  });

  // Rodapé com Resumo Estatístico
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `📊 **RESUMO DA UNIDADE NO PERÍODO**\n`;
  texto += `• Total de Cursos: ${totalGeralCursos}\n`;
  texto += `• Total de Recrutamentos: ${totalGeralRecs}\n`;
  texto += `\n*Relatório gerado automaticamente pelo Sistema de Gestão.*\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  navigator.clipboard
    .writeText(texto)
    .then(() => {
      if (typeof mostrarAviso === "function") {
        mostrarAviso("Relatório formal copiado!");
      } else {
        alert("Relatório formal copiado para o Discord!");
      }
    })
    .catch((err) => {
      console.error("Erro ao copiar:", err);
    });
};
