// =========================================================
// GESTÃO DA SEÇÃO DE ENSINO (VERSÃO CORRIGIDA)
// =========================================================

/**
 * 1. Abre a tela de ensino, limpando as outras seções e atualizando o menu
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

  // Esconde todas as outras telas (integração com script principal)
  if (typeof resetarTelas === "function") {
    resetarTelas();
  } else {
    document
      .querySelectorAll("section")
      .forEach((s) => (s.style.display = "none"));
  }

  // Exibe a seção de ensino
  const secao = document.getElementById("secao-ensino");
  const botoes = document.getElementById("botoes-ensino");

  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  if (botoes) {
    botoes.style.display = "flex"; // Ajustado para flex para alinhar os botões
  }

  // Atualiza Menu Lateral
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  const navItem = document.getElementById("nav-ensino");
  if (navItem) navItem.classList.add("active");

  // Atualiza Títulos
  const titulo = document.getElementById("titulo-pagina");
  const subtitulo = document.getElementById("subtitulo-pagina");
  if (titulo) titulo.innerText = `DIVISÃO DE ENSINO - ${label.nome}`;
  if (subtitulo)
    subtitulo.innerText = `Relatório de Produtividade de Instrutores`;
};

/**
 * 2. Busca os dados na API e preenche a tabela
 * (Inclui proteção contra erro de JSON/404)
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

  if (!corpo)
    return console.error("Elemento corpo-ensino não encontrado no HTML!");

  // Feedback de Carregamento
  corpo.innerHTML =
    '<tr><td colspan="5" align="center" style="padding:40px; color:#d4af37;"><i class="fa-solid fa-spinner fa-spin"></i> Sincronizando com Discord...</td></tr>';

  if (prog) prog.style.display = "block";
  if (btn) btn.disabled = true;

  try {
    // Monta a URL da API
    const url = `/api/relatorios.js?tipo=ensino&org=${org}&dataInicio=${
      dataIn || ""
    }&dataFim=${dataFi || ""}`;

    const res = await fetch(url);

    // --- PROTEÇÃO DE ERRO ---
    // Se a API não responder com sucesso (ex: 404, 500), lançamos erro antes de tentar ler JSON
    if (!res.ok) {
      throw new Error(`Erro do Servidor: ${res.status} (${res.statusText})`);
    }

    const dados = await res.json();

    // Limpa a tabela
    corpo.innerHTML = "";

    // Verifica se veio vazio
    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="5" align="center" style="padding:40px; color:#666;">Nenhum registro encontrado para este período.</td></tr>';
      return;
    }

    // Filtra apenas quem tem pontuação > 0 (Opcional, remove se quiser ver zeros)
    // const dadosFiltrados = dados.filter(d => d.total > 0);
    const dadosFiltrados = dados;

    // Ordena: Maior Total -> Maior Recrutamento -> Nome
    dadosFiltrados.sort((a, b) => b.total - a.total || b.recs - a.recs);

    // Renderiza as linhas
    dadosFiltrados.forEach((inst, index) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #2b2b36"; // Linha sutil separando

      // Define ícones de Rank
      let rankIcon = `<span style="color: #555; font-size: 0.8em;">#${
        index + 1
      }</span>`;
      let corDestaque = "#eee"; // Cor padrão do nome

      if (index === 0) {
        rankIcon = "🥇";
        corDestaque = "#FFD700";
      }
      if (index === 1) {
        rankIcon = "🥈";
        corDestaque = "#C0C0C0";
      }
      if (index === 2) {
        rankIcon = "🥉";
        corDestaque = "#CD7F32";
      }

      tr.innerHTML = `
        <td style="padding: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="position: relative;">
                <img src="${
                  inst.avatar ||
                  "https://cdn.discordapp.com/embed/avatars/0.png"
                }" 
                     class="avatar-img"
                     style="width:36px; height:36px; border-radius:50%; border: 2px solid #333; object-fit: cover;"
                     onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
            </div>
            <div style="display: flex; flex-direction: column;">
                <strong style="color: ${corDestaque}; font-size: 0.95em;">${
        inst.name
      }</strong>
                <span style="font-size: 0.75em; color: #777;">${rankIcon} Ranking</span>
            </div>
          </div>
        </td>
        <td style="padding: 12px; vertical-align: middle;"><code style="background: #111; padding: 2px 6px; border-radius: 4px; color: #888; font-size: 0.85em;">${
          inst.id
        }</code></td>
        <td align="center" style="padding: 12px; vertical-align: middle;"><span style="color: #98fb98; font-weight: 500;">${
          inst.cursos
        }</span></td>
        <td align="center" style="padding: 12px; vertical-align: middle;"><span style="color: #87ceeb; font-weight: 500;">${
          inst.recs
        }</span></td>
        <td align="center" style="padding: 12px; vertical-align: middle;"><strong style="color: #d4af37; font-size: 1.1em; text-shadow: 0 0 5px rgba(212, 175, 55, 0.2);">${
          inst.total
        }</strong></td>
      `;
      corpo.appendChild(tr);
    });

    if (typeof mostrarAviso === "function")
      mostrarAviso(`Sucesso! ${dadosFiltrados.length} instrutores carregados.`);
  } catch (err) {
    console.error("Erro Crítico Ensino:", err);
    corpo.innerHTML = `<tr><td colspan="5" align="center" style="color:#ff4444; padding:40px;">
        <i class="fa-solid fa-triangle-exclamation"></i> Falha ao obter dados.<br>
        <span style="font-size: 0.8em; color: #777;">${err.message}</span>
    </td></tr>`;

    if (typeof mostrarAviso === "function")
      mostrarAviso("Erro na sincronização.", "error");
  } finally {
    if (prog) prog.style.display = "none";
    if (btn) btn.disabled = false;
  }
};

/**
 * 3. Gera relatório para o Discord (Copia para área de transferência)
 */
window.copiarRelatorioEnsino = function () {
  const corpo = document.getElementById("corpo-ensino");
  const dataIn = document.getElementById("data-inicio-ensino")?.value;
  const dataFi = document.getElementById("data-fim-ensino")?.value;
  const sessao =
    typeof obterSessao === "function" ? obterSessao() : { org: "SISTEMA" };

  // Verificações de segurança
  if (
    !corpo ||
    corpo.rows.length === 0 ||
    corpo.innerText.includes("Sincronizando") ||
    corpo.innerText.includes("Nenhum") ||
    corpo.innerText.includes("Falha")
  ) {
    if (typeof mostrarAviso === "function")
      mostrarAviso("Gere a lista antes de copiar!", "warning");
    return;
  }

  // Formatação de Datas
  const formatarDataBR = (data) =>
    data ? data.split("-").reverse().join("/") : null;
  const dInicio = formatarDataBR(dataIn) || "Início dos Tempos";
  const dFim = formatarDataBR(dataFi) || "Hoje";

  // Configuração do Relatório
  const partes = [];
  const limiteCaracteres = 1900; // Margem para Discord

  let cabecalho = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  cabecalho += `📚 **RELATÓRIO DE ENSINO - ${sessao.org}**\n`;
  cabecalho += `📅 **Período:** ${dInicio} até ${dFim}\n`;
  cabecalho += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  let textoAtual = cabecalho;
  let totalGeralCursos = 0;
  let totalGeralRecs = 0;

  const linhas = Array.from(corpo.rows);

  linhas.forEach((row, index) => {
    const col = row.cells;
    // Garante que a linha tem as colunas esperadas
    if (col.length >= 5) {
      // Extração de dados (innerText pega o texto visível)
      // col[0] é Nome, mas tem que limpar quebras de linha do HTML
      const linhasNome = col[0].innerText.split("\n");
      const nome = linhasNome[0].trim(); // Pega apenas o nome, ignora o ranking abaixo se houver

      const id = col[1].innerText.trim();
      const cursos = parseInt(col[2].innerText.trim()) || 0;
      const recs = parseInt(col[3].innerText.trim()) || 0;
      const total = col[4].innerText.trim();

      totalGeralCursos += cursos;
      totalGeralRecs += recs;

      // Ícone de Medalha baseado no index
      let rank = "🔹";
      if (index === 0) rank = "🥇";
      if (index === 1) rank = "🥈";
      if (index === 2) rank = "🥉";

      const item = `${rank} **${nome}** \n🆔 \`${id}\`\n├ 🎓 Cursos: \`${cursos}\`\n├ 📝 Recrutamentos: \`${recs}\`\n└ 🏆 **PONTOS: ${total}**\n\n`;

      // Lógica de Quebra de Mensagem
      if ((textoAtual + item).length > limiteCaracteres) {
        partes.push(textoAtual);
        textoAtual =
          `📑 **CONTINUAÇÃO RELATÓRIO...**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          item;
      } else {
        textoAtual += item;
      }
    }
  });

  // Rodapé Estatístico
  let rodape = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  rodape += `📊 **ESTATÍSTICAS TOTAIS**\n`;
  rodape += `• Instrutores Ativos: ${linhas.length}\n`;
  rodape += `• Total de Cursos Ministrados: ${totalGeralCursos}\n`;
  rodape += `• Total de Recrutamentos: ${totalGeralRecs}\n`;
  rodape += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // Tenta anexar rodapé
  if ((textoAtual + rodape).length > limiteCaracteres) {
    partes.push(textoAtual);
    partes.push(rodape); // Rodapé fica em mensagem separada se não couber
  } else {
    textoAtual += rodape;
    partes.push(textoAtual);
  }

  // Entrega ao Usuário
  if (partes.length === 1) {
    navigator.clipboard.writeText(partes[0]).then(() => {
      if (typeof mostrarAviso === "function")
        mostrarAviso("Relatório copiado para a área de transferência!");
    });
  } else {
    // Se tiver modal de divisão (Script Principal)
    if (typeof abrirModalRelatorioDividido === "function") {
      abrirModalRelatorioDividido(partes);
    } else {
      // Fallback
      navigator.clipboard.writeText(partes[0]);
      alert(
        `Relatório muito grande! (${partes.length} partes). A Parte 1 foi copiada.`
      );
    }
  }
};
