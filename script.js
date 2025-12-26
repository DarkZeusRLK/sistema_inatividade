// =========================================================
// 1. UTILITÁRIOS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  if (!sessionStr) return { org: "PCERJ" };
  return JSON.parse(sessionStr);
};

const getOrgLabel = (org) => {
  const labels = {
    PCERJ: { unidade: "CORE", nome: "PCERJ" },
    PRF: { unidade: "GRR", nome: "PRF" },
    PMERJ: { unidade: "BOPE", nome: "PMERJ" },
  };
  return labels[org] || labels["PCERJ"];
};

window.fazerLogout = function () {
  if (confirm("Deseja realmente encerrar sua sessão no painel?")) {
    localStorage.removeItem("pc_session");
    window.location.href = "login.html";
  }
};

// =========================================================
// 1.5 SISTEMA DE PERMISSÕES POR ORGANIZAÇÃO
// =========================================================

function aplicarRestricoes() {
  const { org } = obterSessao();

  const permissoes = {
    PCERJ: {
      mostrar: ["nav-core", "nav-porte", "nav-admin"],
      esconder: ["nav-grr", "nav-bope"],
    },
    PRF: {
      mostrar: ["nav-grr"],
      esconder: ["nav-core", "nav-bope", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope"],
      esconder: ["nav-core", "nav-grr", "nav-porte", "nav-admin"],
    },
  };

  const config = permissoes[org] || permissoes["PCERJ"];

  config.esconder.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  config.mostrar.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "flex";
  });

  if (org !== "PCERJ") {
    window.abrirMetaCore = () => mostrarAviso("Acesso negado à PCERJ", "error");
  }
  if (org !== "PRF") {
    window.abrirMetaGRR = () => mostrarAviso("Acesso negado à PRF", "error");
  }
  if (org !== "PMERJ") {
    window.abrirMetaBOPE = () => mostrarAviso("Acesso negado à PMERJ", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  aplicarRestricoes();
  const sessao = JSON.parse(localStorage.getItem("pc_session"));

  if (!sessao) {
    window.location.href = "login.html";
    return;
  }

  document.body.className = sessao.tema;

  const logoImg = document.getElementById("logo-org");
  const tituloPainel = document.querySelector(".sidebar-header h2");

  const BRASOES = {
    PCERJ: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    PRF: "Imagens/PRF_new.png",
    PMERJ:
      "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
  };

  if (logoImg && BRASOES[sessao.org]) {
    logoImg.src = BRASOES[sessao.org];
  }

  if (tituloPainel) {
    tituloPainel.innerText = sessao.org;
  }

  const nomeUsuario = document.getElementById("nome-usuario");
  if (nomeUsuario) nomeUsuario.innerText = sessao.nome;

  window.abrirInatividade();
});

// =========================================================
// 2. SISTEMA DE NAVEGAÇÃO E CONTROLE DE INTERFACE
// =========================================================

function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
  ];

  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });

  const gruposBotoes = [
    "botoes-inatividade",
    "botoes-core",
    "botoes-grr",
    "botoes-bope",
    "botoes-ferias",
  ];
  gruposBotoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
}

window.abrirInatividade = function () {
  const { org } = obterSessao();
  const label = getOrgLabel(org);
  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `SISTEMA DE AUDITORIA - ${label.nome}`;
  document.getElementById("subtitulo-pagina").innerText =
    "Controle de Presença em Canais Oficiais";
};

window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - CORE";
  document.getElementById("subtitulo-pagina").innerText =
    "Contabilização de Metas e Produtividade PCERJ";
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("secao-meta-grr").style.visibility = "visible";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - GRR";
  document.getElementById("subtitulo-pagina").innerText =
    "Contabilização de Metas e Produtividade PRF";
};

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("secao-meta-bope").style.visibility = "visible";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - BOPE";
  document.getElementById("subtitulo-pagina").innerText =
    "Contabilização de Metas e Produtividade PMERJ";
};

window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS - COMANDO";
  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

// =========================================================
// 3. ALERTAS E INATIVIDADE
// =========================================================

function mostrarAviso(mensagem, tipo = "success") {
  let container = document.getElementById("custom-alert-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "custom-alert-container";
    document.body.appendChild(container);
  }
  const alert = document.createElement("div");
  alert.className = `pc-alert ${tipo}`;
  const icon =
    tipo === "success" ? "fa-check-circle" : "fa-exclamation-triangle";
  alert.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${mensagem}</span>`;
  container.appendChild(alert);
  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => alert.remove(), 500);
  }, 4000);
}

let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btnSinc = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");

  if (!corpo) return;
  corpo.innerHTML = "";
  if (btnCopiar) btnCopiar.style.display = "none";

  // --- INÍCIO DA ANIMAÇÃO DE PROGRESSÃO ---
  progContainer.style.display = "block";
  progBar.style.width = "0%";

  let largura = 0;
  // Intervalo para fazer a barra subir "falsamente" até 90% enquanto a API não responde
  const progressoSimulado = setInterval(() => {
    if (largura >= 90) {
      clearInterval(progressoSimulado);
    } else {
      largura += Math.random() * 5; // Incrementos aleatórios para parecer real
      progBar.style.width = largura + "%";
    }
  }, 200);
  // --- FIM DA ANIMAÇÃO DE PROGRESSÃO ---

  const originalTexto = btnSinc.innerHTML;
  btnSinc.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO...';
  btnSinc.disabled = true;

  try {
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    const data = await res.json();
    dadosInatividadeGlobal = data.dados;
    listaMembrosAtual = dados;

    // Para a simulação e completa a barra
    clearInterval(progressoSimulado);
    progBar.style.width = "100%";

    if (btnCopiar) btnCopiar.style.display = "inline-block";

    dados.sort((a, b) => (a.lastMsg || 0) - (b.lastMsg || 0));
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

    dados.forEach((membro) => {
      let dataRef = Math.max(
        membro.lastMsg || 0,
        membro.joinedAt || 0,
        dataBaseAuditoria
      );
      const dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
      const statusExonerar = dias >= 7;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><div class="user-cell"><img src="${
          membro.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
        }" class="avatar-img"><strong>${membro.name}</strong></div></td>
        <td><code>${membro.id}</code></td>
        <td>${
          membro.lastMsg > 0
            ? new Date(membro.lastMsg).toLocaleDateString("pt-BR")
            : "---"
        }</td>
        <td><strong style="color: ${
          statusExonerar ? "#ff4d4d" : "#d4af37"
        }">${dias} Dias</strong></td>
        <td align="center"><span class="${
          statusExonerar ? "badge-danger" : "badge-success"
        }">${statusExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
      `;
      corpo.appendChild(tr);
    });
    mostrarAviso("Dados atualizados.");
  } catch (err) {
    clearInterval(progressoSimulado);
    progBar.style.backgroundColor = "#ff4d4d"; // Barra fica vermelha em caso de erro
    mostrarAviso("Erro na sincronização.", "error");
  } finally {
    btnSinc.innerHTML = originalTexto;
    btnSinc.disabled = false;
    // Esconde a barra após 2 segundos de conclusão
    setTimeout(() => {
      progContainer.style.display = "none";
      progBar.style.backgroundColor = ""; // Reseta cor para o padrão (gold/blue)
    }, 2000);
  }
};

// =========================================================
// 4. LÓGICA DE COPIAR RELATÓRIO DE INATIVIDADE (CORRIGIDA)
// =========================================================

async function executarCopia(texto) {
  console.log("Tentando copiar texto...");
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (err) {
      console.error("Falha na Clipboard API:", err);
    }
  }

  // Fallback: Método antigo para navegadores sem HTTPS ou suporte à API
  const textArea = document.createElement("textarea");
  textArea.value = texto;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const ok = document.execCommand("copy");
    document.body.removeChild(textArea);
    return ok;
  } catch (err) {
    console.error("Falha no fallback de cópia:", err);
    document.body.removeChild(textArea);
    return false;
  }
}

window.copiarRelatorioDiscord = () => {
  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    return mostrarAviso(
      "Não há dados para copiar. Sincronize primeiro.",
      "error"
    );
  }

  const { org } = obterSessao();
  const config = getOrgLabel(org);
  const dataRef = new Date().toLocaleDateString("pt-BR");

  // Cabeçalho do Relatório
  let relatorioTexto = `**AUDITORIA DE PRESENÇA - ${config.nome}**\n`;
  relatorioTexto += `📅 Data: ${dataRef}\n`;
  relatorioTexto += `⚠️ *Oficiais com mais de 7 dias de ausência sem justificativa.*\n\n`;

  // Filtra e formata apenas os que estão em situação crítica (Exemplo: > 7 dias)
  const inativos = dadosInatividadeGlobal.filter((o) => o.diasAusente >= 7);

  if (inativos.length === 0) {
    relatorioTexto += "✅ Nenhum oficial em situação de inatividade crítica.";
  } else {
    inativos.forEach((oficial) => {
      const status =
        oficial.diasAusente >= 10 ? "❌ [EXONERAÇÃO]" : "⚠️ [ADVERTÊNCIA]";
      relatorioTexto += `${status} **${oficial.rpName}** (${oficial.id})\n`;
      relatorioTexto += `└ *Última atividade: ${oficial.ultimaMsg} (${oficial.diasAusente} dias)*\n\n`;
    });
  }

  // Utiliza a função de dividir relatório que você já tem para enviar ao modal
  dividirRelatorio(relatorioTexto, (bloco) => bloco);
};

function abrirModalDivisor(membros, data, header, formatador) {
  const modal = document.getElementById("modal-relatorio");
  const container = document.getElementById("container-botoes-partes");

  if (!modal || !container) {
    console.error("Modal de divisão não encontrado no HTML!");
    return mostrarAviso("Erro: Estrutura do Modal ausente no HTML.", "error");
  }

  container.innerHTML = "";
  const limitePorParte = 6;

  for (let i = 0; i < membros.length; i += limitePorParte) {
    const bloco = membros.slice(i, i + limitePorParte);
    const parte = Math.floor(i / limitePorParte) + 1;

    const btn = document.createElement("button");
    btn.className = "btn-gold";
    btn.style.margin = "5px";
    btn.innerHTML = `<i class="fa-solid fa-copy"></i> PARTE ${parte}`;
    btn.onclick = () => {
      const texto = header + `(PARTE ${parte})\n\n` + formatador(bloco);
      executarCopia(texto).then(() => {
        mostrarAviso(`Parte ${parte} copiada!`);
        btn.style.background = "#28a745";
      });
    };
    container.appendChild(btn);
  }
  modal.style.display = "flex";
}
// =========================================================
// 5. FILTRAR METAS GRR (CORRIGIDA/ADICIONADA)
// =========================================================

window.filtrarMetaGRR = function () {
  const dataInicio = document.getElementById("data-inicio-grr").value;
  const dataFim = document.getElementById("data-fim-grr").value;

  if (!dataInicio || !dataFim) {
    return mostrarAviso("Selecione o período completo.", "warning");
  }

  // Chama a função global que deve estar no meta-grr.js para recarregar com as datas
  if (typeof window.carregarMetaGRR === "function") {
    window.carregarMetaGRR(dataInicio, dataFim);
    mostrarAviso("Filtro aplicado.");
  } else {
    mostrarAviso("Função de carga não encontrada.", "error");
  }
};

// =========================================================
// 6. FÉRIAS E ANTECIPAÇÃO (MANTIDOS IGUAL)
// =========================================================

window.atualizarListaFerias = async function () {
  const { org } = obterSessao();
  const select = document.getElementById("select-oficiais-ferias");
  const logContainer = document.getElementById("status-ferias-info");
  if (!select) return;
  logContainer.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando dados de férias...';
  select.innerHTML = '<option value="">⏳ Sincronizando...</option>';
  try {
    const res = await fetch(`/api/verificar-ferias?org=${org}`);
    const data = await res.json();
    select.innerHTML = '<option value="">Selecione para antecipar...</option>';
    if (data.oficiais.length === 0) {
      select.innerHTML = '<option value="">Nenhum oficial em férias.</option>';
    } else {
      data.oficiais.forEach((oficial) => {
        const opt = document.createElement("option");
        opt.value = oficial.id;
        opt.textContent = `🌴 ${oficial.nome} (Até: ${oficial.dataRetorno})`;
        select.appendChild(opt);
      });
    }
    logContainer.innerHTML =
      data.logs?.length > 0
        ? "<strong>Remoções Hoje:</strong><br>" +
          data.logs.map((l) => `✅ ${l}`).join("<br>")
        : '<i class="fa-solid fa-check-double"></i> Tudo atualizado.';
  } catch (e) {
    logContainer.innerHTML =
      '<span style="color:red">Erro ao carregar dados.</span>';
    select.innerHTML = '<option value="">Erro ao carregar.</option>';
  }
};

window.executarAntecipacao = async function () {
  const userId = document.getElementById("select-oficiais-ferias").value;
  if (!userId) return mostrarAviso("Selecione um oficial.", "warning");
  if (!confirm("Confirmar retorno antecipado?")) return;
  try {
    const res = await fetch("/api/verificar-ferias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      mostrarAviso("Férias antecipadas!");
      window.atualizarListaFerias();
    }
  } catch (e) {
    mostrarAviso("Falha na comunicação.", "error");
  }
};
