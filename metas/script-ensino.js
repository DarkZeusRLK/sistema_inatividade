// =========================================================
// GESTÃO DA SEÇÃO DE ENSINO
// =========================================================

/**
 * Abre a tela de ensino, limpando as outras seções e atualizando o menu
 */
window.abrirEnsino = function () {
  const sessao =
    typeof obterSessao === "function"
      ? obterSessao()
      : JSON.parse(localStorage.getItem("pc_session") || "{}");
  if (!sessao || !sessao.org) return;

  const label =
    typeof getOrgLabel === "function"
      ? getOrgLabel(sessao.org)
      : { nome: sessao.org };

  // Chama a função global do script.js para esconder todas as outras telas
  if (typeof resetarTelas === "function") {
    resetarTelas();
  } else {
    // Fallback caso resetarTelas não esteja acessível
    document
      .querySelectorAll("section")
      .forEach((s) => (s.style.display = "none"));
  }

  // Exibe a seção de ensino e seus botões específicos no header
  const secao = document.getElementById("secao-ensino");
  const botoes = document.getElementById("botoes-ensino");

  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  if (botoes) {
    botoes.style.display = "block";
  }

  // Atualiza estado visual do menu lateral
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const navItem = document.getElementById("nav-ensino");
  if (navItem) navItem.classList.add("active");

  // Atualiza títulos da página
  const titulo = document.getElementById("titulo-pagina");
  const subtitulo = document.getElementById("subtitulo-pagina");
  if (titulo) titulo.innerText = `DIVISÃO DE ENSINO - ${label.nome}`;
  if (subtitulo)
    subtitulo.innerText = `Relatório Automático de Metas e Instrutoria`;
};

/**
 * Busca os dados na API e preenche a tabela
 */
window.carregarRelatorioEnsino = async function () {
  const sessao =
    typeof obterSessao === "function"
      ? obterSessao()
      : JSON.parse(localStorage.getItem("pc_session") || "{}");
  const org = sessao.org;

  const dataIn = document.getElementById("data-inicio-ensino")?.value;
  const dataFi = document.getElementById("data-fim-ensino")?.value;
  const corpo = document.getElementById("corpo-ensino");
  const prog = document.getElementById("progress-container-ensino");
  const btn = document.getElementById("btn-sincronizar-ensino");

  if (!corpo) return console.error("Elemento corpo-ensino não encontrado!");

  // Limpeza e Feedback Visual
  corpo.innerHTML =
    '<tr><td colspan="5" align="center" style="padding:40px; color:#d4af37;"><i class="fa-solid fa-spinner fa-spin"></i> Sincronizando com Discord...</td></tr>';
  if (prog) prog.style.display = "block";
  if (btn) btn.disabled = true;

  try {
    const url = `/api/relatorio-ensino?org=${org}&dataInicio=${
      dataIn || ""
    }&dataFim=${dataFi || ""}`;
    const res = await fetch(url);
    const dados = await res.json();

    if (res.status !== 200) throw new Error(dados.error || "Erro na API");

    corpo.innerHTML = ""; // Limpa o carregando

    if (!dados || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="5" align="center" style="padding:40px; color:#666;">Nenhum registro encontrado para este período ou corporação.</td></tr>';
      return;
    }

    // Ordena por maior pontuação total
    dados.sort((a, b) => b.total - a.total);

    dados.forEach((inst) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #222";
      tr.innerHTML = `
        <td style="padding: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${
              inst.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
            }" 
                 style="width:32px; height:32px; border-radius:50%; border: 1px solid #333;">
            <strong style="color: #eee;">${inst.name}</strong>
          </div>
        </td>
        <td style="padding: 12px;"><code style="color: #888;">${
          inst.id
        }</code></td>
        <td align="center" style="padding: 12px;"><span style="color: #00ff00;">${
          inst.cursos
        }</span></td>
        <td align="center" style="padding: 12px;"><span style="color: #00d9ff;">${
          inst.recs
        }</span></td>
        <td align="center" style="padding: 12px;"><strong style="color: #d4af37; font-size: 1.1em;">${
          inst.total
        }</strong></td>
      `;
      corpo.appendChild(tr);
    });

    if (typeof mostrarAviso === "function") mostrarAviso("Ensino atualizado!");
  } catch (err) {
    console.error("Erro Ensino:", err);
    corpo.innerHTML = `<tr><td colspan="5" align="center" style="color:#ff4444; padding:40px;">Erro: ${err.message}</td></tr>`;
    if (typeof mostrarAviso === "function")
      mostrarAviso("Falha ao sincronizar.", "error");
  } finally {
    if (prog) prog.style.display = "none";
    if (btn) btn.disabled = false;
  }
};

/**
 * Gera um relatório formal e bonito para o Discord
 */
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

  // Função interna para formatar data ISO (YYYY-MM-DD) para BR (DD/MM/YYYY)
  const formatarDataBR = (data) =>
    data ? data.split("-").reverse().join("/") : null;
  const dInicio = formatarDataBR(dataIn) || "Início";
  const dFim = formatarDataBR(dataFi) || "Hoje";

  // Início da montagem do texto
  let texto = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `📑 **RELATÓRIO DE PRODUTIVIDADE - ENSINO**\n`;
  texto += `🏢 **UNIDADE:** ${sessao.org}\n`;
  texto += `📅 **PERÍODO:** ${dInicio} até ${dFim}\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

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

      // Medalha para os 3 primeiros
      const rank =
        index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "🔹 ";

      texto += `${rank}**${nome}** [${id}]\n`;
      texto += `├  Cursos: \`${cursos.toString().padStart(2, "0")}\`\n`;
      texto += `├  Recrutamentos: \`${recs.toString().padStart(2, "0")}\`\n`;
      texto += `└  **PONTUAÇÃO: ${total}**\n\n`;
    }
  });

  // Rodapé estatístico
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `📊 **RESUMO GERAL DO PERÍODO**\n`;
  texto += `• Total de Cursos: ${totalGeralCursos}\n`;
  texto += `• Total de Recrutamentos: ${totalGeralRecs}\n`;
  texto += `\n*Relatório gerado automaticamente pelo Sistema de Gestão.*\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  navigator.clipboard
    .writeText(texto)
    .then(() => {
      if (typeof mostrarAviso === "function")
        mostrarAviso("Relatório formal copiado!");
    })
    .catch((err) => {
      console.error("Erro ao copiar:", err);
      alert("Erro ao copiar para a área de transferência.");
    });
};
