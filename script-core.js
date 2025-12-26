// VARIÁVEL GLOBAL PARA ARMAZENAR OS DADOS DO RELATÓRIO
let listaMetaCoreAtual = [];

// 1. NAVEGAÇÃO - ABRIR ABA CORE
window.abrirMetaCore = function () {
  // 1. Chama o reset global (que agora limpa todos os dourados da navbar)
  if (typeof resetarTelas === "function") {
    resetarTelas();
  }

  // 2. Mostra o conteúdo do CORE
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";

  // 3. Ativa o botão correto na sidebar
  document.getElementById("nav-core").classList.add("active");

  document.getElementById("titulo-pagina").innerText =
    "CONTROLE DE METAS - CORE";
  document.getElementById("subtitulo-pagina").innerText =
    "Análise de Produtividade por Período Personalizado";

  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-core").classList.add("active");

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

// 2. VOLTAR PARA INATIVIDADE (CORREÇÃO DE NAVEGAÇÃO)
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

// 3. CARREGAR DADOS CORE (ALERTAS FORMALIZADOS)
window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    mostrarAviso("Por favor, selecione o período para filtragem.", "warning");
    return;
  }

  corpo.innerHTML =
    '<p style="text-align: center; color: #d4af37; padding: 20px;">Sincronizando registros operacionais...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "40%";

  try {
    const res = await fetch(
      `/api/meta-core?start=${dataInicio}&end=${dataFim}`
    );
    const dados = await res.json();
    listaMetaCoreAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    dados.forEach((m) => {
      const card = document.createElement("div");
      card.style =
        "background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 10px; border-left: 5px solid #444;";

      if (m.isFerias) {
        card.style.borderLeftColor = "#3498db";
        card.innerHTML = `<strong style="color:#fff">${m.name.toUpperCase()}</strong><span style="color:#3498db; font-size:0.8rem;">🌴 EM FÉRIAS</span>`;
      } else {
        const ok =
          m.acoes >= 4 &&
          (!m.temCGPC || m.cgpc >= 1) &&
          (!m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2);
        card.style.borderLeftColor = ok ? "#2ecc71" : "#ff4d4d";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #222; padding-bottom:5px;">
            <strong style="color:#fff">${m.name.toUpperCase()}</strong>
            <span style="color:${
              ok ? "#2ecc71" : "#ff4d4d"
            }; font-weight:bold; font-size:0.75rem;">${
          ok ? "✅ META BATIDA" : "❌ PENDENTE"
        }</span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-size:0.8rem; color:#bbb; margin-top:5px;">
            <div><small style="display:block; color:#666;">AÇÕES</small> ${
              m.acoes
            }/4</div>
            <div><small style="display:block; color:#666;">CGPC</small> ${
              m.temCGPC ? (m.cgpc >= 1 ? "OK" : "Pendente") : "--"
            }</div>
            <div><small style="display:block; color:#666;">ENSINO</small> ${
              m.temEnsino ? `${m.ensino_cursos}C|${m.ensino_recrut}R` : "--"
            }</div>
          </div>
        `;
      }
      corpo.appendChild(card);
    });

    mostrarAviso("Metas CORE sincronizadas com sucesso!");
  } catch (e) {
    mostrarAviso("Erro ao conectar com o servidor de metas.", "error");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

// 4. COPIAR RELATÓRIO DISCORD (VERTICAL)
window.copiarRelatorioCORE = function () {
  if (listaMetaCoreAtual.length === 0) {
    mostrarAviso(
      "Não há dados para copiar. Filtre as metas primeiro.",
      "error"
    );
    return;
  }

  const dIni = document
    .getElementById("data-inicio-core")
    .value.split("-")
    .reverse()
    .join("/");
  const dFim = document
    .getElementById("data-fim-core")
    .value.split("-")
    .reverse()
    .join("/");

  let texto = `🎯 **RELATÓRIO DE METAS CORE**\n📅 **PERÍODO:** ${dIni} a ${dFim}\n━━━━━━━━━━━━━━━━━━\n\n`;

  listaMetaCoreAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `👤 **OFICIAL:** <@${m.id}>\n🌴 **STATUS:** EM FÉRIAS\n\n`;
    } else {
      const ok =
        m.acoes >= 4 &&
        (!m.temCGPC || m.cgpc >= 1) &&
        (!m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2);
      texto += `👤 **OFICIAL:** <@${m.id}>\n`;
      texto += `📊 **STATUS:** ${ok ? "✅ META BATIDA" : "❌ PENDENTE"}\n`;
      texto += `┠ **Ações:** ${m.acoes}/4\n`;
      if (m.temCGPC)
        texto += `┠ **CGPC:** ${m.cgpc >= 1 ? "OK" : "PENDENTE"}\n`;
      if (m.temEnsino)
        texto += `┠ **Ensino:** ${m.ensino_cursos} Cursos / ${m.ensino_recrut} Recrut.\n`;
      texto += `\n`;
    }
  });

  texto += `━━━━━━━━━━━━━━━━━━\n⚠️ *Relatório formalizado via Painel Administrativo.*`;

  navigator.clipboard.writeText(texto).then(() => {
    mostrarAviso("Relatório vertical copiado para o Discord!");
  });
};
