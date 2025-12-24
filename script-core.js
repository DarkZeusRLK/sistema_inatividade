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

  // Auto-preencher datas com a última semana se estiverem vazias
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

// 3. CARREGAR DADOS DA CORE (LAYOUT VERTICAL EM CARDS)
window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    if (typeof mostrarAviso === "function")
      mostrarAviso("Selecione o início e o fim do período.", "error");
    else alert("Selecione o período.");
    return;
  }

  corpo.innerHTML =
    '<p style="text-align: center; color: #d4af37; padding: 20px;">Iniciando varredura nos canais operacionais...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "30%";

  try {
    const res = await fetch(
      `/api/meta-core?start=${dataInicio}&end=${dataFim}`
    );
    const dados = await res.json();
    listaMetaCoreAtual = dados;

    corpo.innerHTML = ""; // Limpa o container
    progBar.style.width = "70%";

    // Cria um container flex para os cards se não existir
    corpo.style.display = "flex";
    corpo.style.flexDirection = "column";
    corpo.style.gap = "10px";
    corpo.style.padding = "10px";

    dados.forEach((m) => {
      const card = document.createElement("div");

      // Estilo Base do Card
      card.style =
        "background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 12px; border-left: 5px solid #444; transition: 0.3s;";

      // CASO 1: OFICIAL DE FÉRIAS
      if (m.isFerias) {
        card.style.borderLeftColor = "#3498db";
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: #fff; font-size: 1.1rem; letter-spacing: 1px;">${m.name.toUpperCase()}</strong>
              <span style="background: #3498db; color: white; padding: 3px 10px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">🌴 FÉRIAS</span>
          </div>
          <div style="color: #3498db; font-size: 0.9rem; font-style: italic;">Oficial em período de licença ou férias regulamentares.</div>
        `;
      }
      // CASO 2: OFICIAL ATIVO
      else {
        const acoesOk = m.acoes >= 4;
        const cgpcOk = !m.temCGPC || m.cgpc >= 1;
        const ensinoOk =
          !m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2;
        const metaFinal = acoesOk && cgpcOk && ensinoOk;

        card.style.borderLeftColor = metaFinal ? "#2ecc71" : "#ff4d4d";

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222; padding-bottom: 8px;">
              <strong style="color: #fff; font-size: 1.1rem; letter-spacing: 1px;">${m.name.toUpperCase()}</strong>
              <span class="badge-${
                metaFinal ? "success" : "danger"
              }" style="padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.75rem;">
                  ${metaFinal ? "✅ META BATIDA" : "❌ PENDENTE"}
              </span>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 5px;">
              <div style="text-align: center; background: #0a0a0a; padding: 8px; border-radius: 6px; border: 1px solid #222;">
                  <small style="color: #888; display: block; margin-bottom: 4px; font-size: 0.65rem;">AÇÕES</small>
                  <span style="color: ${
                    acoesOk ? "#2ecc71" : "#ff4d4d"
                  }; font-weight: bold;">${m.acoes}/4</span>
              </div>
              
              <div style="text-align: center; background: #0a0a0a; padding: 8px; border-radius: 6px; border: 1px solid #222;">
                  <small style="color: #888; display: block; margin-bottom: 4px; font-size: 0.65rem;">CGPC</small>
                  <span style="color: ${
                    m.temCGPC ? (cgpcOk ? "#2ecc71" : "#ff4d4d") : "#555"
                  }; font-weight: bold;">
                      ${m.temCGPC ? (m.cgpc >= 1 ? "OK" : "0/1") : "--"}
                  </span>
              </div>

              <div style="text-align: center; background: #0a0a0a; padding: 8px; border-radius: 6px; border: 1px solid #222;">
                  <small style="color: #888; display: block; margin-bottom: 4px; font-size: 0.65rem;">ENSINO</small>
                  <span style="color: ${
                    m.temEnsino ? (ensinoOk ? "#2ecc71" : "#ff4d4d") : "#555"
                  }; font-weight: bold; font-size: 0.8rem;">
                      ${
                        m.temEnsino
                          ? `${m.ensino_cursos}C | ${m.ensino_recrut}R`
                          : "--"
                      }
                  </span>
              </div>
          </div>
        `;
      }
      corpo.appendChild(card);
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
      const ok =
        m.acoes >= 4 &&
        (!m.temCGPC || m.cgpc >= 1) &&
        (!m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2);
      const statusIcon = ok ? "✅" : "❌";

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
