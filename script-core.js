// VARIÁVEL GLOBAL PARA ARMAZENAR OS DADOS DO RELATÓRIO
let listaMetaCoreAtual = [];

// 1. NAVEGAÇÃO - ABRIR ABA CORE
window.abrirMetaCore = function () {
  // Alterna visibilidade das seções
  document.getElementById("secao-inatividade").style.display = "none";
  document.getElementById("secao-meta-core").style.display = "block";

  // Alterna visibilidade dos botões na Top Bar
  document.getElementById("botoes-inatividade").style.display = "none";
  document.getElementById("botoes-core").style.display = "block";

  // Atualiza Textos da Interface
  document.getElementById("titulo-pagina").innerText =
    "CONTROLE DE METAS - CORE";
  document.getElementById("subtitulo-pagina").innerText =
    "Análise de Produtividade por Período Personalizado";

  // Atualiza visual da Sidebar
  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-core").classList.add("active");

  // Opcional: Auto-preencher datas com a última semana se estiverem vazias
  const campoInicio = document.getElementById("data-inicio-core");
  const campoFim = document.getElementById("data-fim-core");
  if (!campoInicio.value) {
    const hoje = new Date();
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(hoje.getDate() - 7);

    campoInicio.value = umaSemanaAtras.toISOString().split("T")[0];
    campoFim.value = hoje.toISOString().split("T")[0];
  }
};

// 2. NAVEGAÇÃO - VOLTAR PARA INATIVIDADE
window.abrirInatividade = function () {
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-meta-core").style.display = "none";

  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("botoes-core").style.display = "none";

  document.getElementById("titulo-pagina").innerText =
    "SISTEMA DE AUDITORIA DE ATIVIDADE";
  document.getElementById("subtitulo-pagina").innerText =
    "Controle de Presença em Canais Oficiais";

  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-inatividade").classList.add("active");
};

// 3. CARREGAR DADOS DA CORE (COM FILTRO DE DATA)
window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  // Captura as datas dos inputs
  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    if (typeof mostrarAviso === "function")
      mostrarAviso("Selecione o início e o fim do período.", "error");
    else alert("Selecione o período.");
    return;
  }

  corpo.innerHTML =
    '<tr><td colspan="5" align="center">Sincronizando com Discord...</td></tr>';
  progContainer.style.display = "block";
  progBar.style.width = "30%";

  try {
    // Envia as datas para a API
    const res = await fetch(
      `/api/meta-core?start=${dataInicio}&end=${dataFim}`
    );
    const dados = await res.json();
    listaMetaCoreAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "70%";

    dados.forEach((m) => {
      const tr = document.createElement("tr");

      // CASO 1: OFICIAL DE FÉRIAS
      if (m.isFerias) {
        tr.innerHTML = `
                    <td><strong>${m.name}</strong></td>
                    <td colspan="3" align="center" style="color: #3498db; font-weight: bold; letter-spacing: 1px;">🌴 EM PERÍODO DE FÉRIAS</td>
                    <td align="center">
                        <span class="badge-info" style="background: #3498db; color: white; padding: 5px 10px; border-radius: 4px;">FÉRIAS</span>
                    </td>
                `;
      }
      // CASO 2: OFICIAL ATIVO (CÁLCULO DE METAS)
      else {
        const acoesOk = m.acoes >= 4;
        // Se o oficial NÃO tem a tag CGPC/Ensino, a meta daquela coluna é considerada OK automaticamente
        const cgpcOk = !m.temCGPC || m.cgpc >= 1;
        const ensinoOk =
          !m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2;

        const metaFinal = acoesOk && cgpcOk && ensinoOk;

        tr.innerHTML = `
                    <td><strong>${m.name}</strong></td>
                    <td style="color: ${acoesOk ? "#2ecc71" : "#ff4d4d"}">${
          m.acoes
        }/4</td>
                    <td>${
                      m.temCGPC
                        ? m.cgpc >= 1
                          ? "✅ OK"
                          : '<span style="color:#ff4d4d">❌ PENDENTE</span>'
                        : '<span style="color:#555">--</span>'
                    }</td>
                    <td>${
                      m.temEnsino
                        ? `${m.ensino_cursos}C / ${m.ensino_recrut}R`
                        : '<span style="color:#555">--</span>'
                    }</td>
                    <td align="center">
                        <span class="badge-${metaFinal ? "success" : "danger"}">
                            ${metaFinal ? "✅ META BATIDA" : "❌ PENDENTE"}
                        </span>
                    </td>
                `;
      }
      corpo.appendChild(tr);
    });

    progBar.style.width = "100%";
    if (typeof mostrarAviso === "function")
      mostrarAviso("Metas CORE atualizadas!");
  } catch (e) {
    console.error(e);
    if (typeof mostrarAviso === "function")
      mostrarAviso("Erro ao carregar metas.", "error");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1500);
  }
};

// 4. COPIAR RELATÓRIO CORE PARA DISCORD
window.copiarRelatorioCORE = function () {
  if (listaMetaCoreAtual.length === 0) {
    alert("Não há dados para copiar. Filtre as metas primeiro.");
    return;
  }

  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  let texto = "🎯 **RELATÓRIO DE METAS CORE** 🎯\n";
  texto += `📅 **PERÍODO:** ${dataInicio
    .split("-")
    .reverse()
    .join("/")} até ${dataFim.split("-").reverse().join("/")}\n`;
  texto += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  listaMetaCoreAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `👤 <@${m.id}> ➔ **🌴 EM FÉRIAS**\n`;
    } else {
      const statusIcon =
        m.acoes >= 4 &&
        (!m.temCGPC || m.cgpc >= 1) &&
        (!m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2)
          ? "✅"
          : "❌";

      texto += `👤 <@${m.id}> ➔ ${statusIcon} **Ações:** ${m.acoes}/4`;

      if (m.temCGPC) texto += ` | **CGPC:** ${m.cgpc >= 1 ? "OK" : "PENDENTE"}`;
      if (m.temEnsino)
        texto += ` | **Ensino:** ${m.ensino_cursos}C/${m.ensino_recrut}R`;

      texto += "\n";
    }
  });

  texto +=
    "\n⚠️ *Oficiais com metas pendentes devem regularizar sua situação.*";

  navigator.clipboard.writeText(texto).then(() => {
    if (typeof mostrarAviso === "function")
      mostrarAviso("Relatório CORE copiado!");
    else alert("Copiado para a área de transferência!");
  });
};
