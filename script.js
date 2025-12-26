// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];
const DATA_BASE_AUDITORIA = new Date("2025-12-08T00:00:00").getTime();

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  if (!sessionStr) return { org: "PCERJ" };
  return JSON.parse(sessionStr);
};

const getOrgLabel = (org) => {
  const labels = {
    PCERJ: {
      unidade: "CORE",
      nome: "PCERJ",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    },
    PRF: {
      unidade: "GRR",
      nome: "PRF",
      logo: "Imagens/PRF_new.png",
    },
    PMERJ: {
      unidade: "BOPE",
      nome: "PMERJ",
      logo: "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    },
  };
  return labels[org] || labels["PCERJ"];
};

function mostrarAviso(msg, tipo = "success") {
  const toast = document.createElement("div");
  toast.className = `toast-aviso ${tipo}`;
  toast.innerHTML = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// =========================================================
// 2. SISTEMA DE PERMISSÕES E INTERFACE
// =========================================================

function aplicarRestricoes() {
  const { org } = obterSessao();
  const configOrg = getOrgLabel(org);

  const logoElemento = document.getElementById("logo-sidebar");
  if (logoElemento) logoElemento.src = configOrg.logo;

  const permissoes = {
    PCERJ: {
      mostrar: ["nav-core", "nav-porte", "nav-admin", "nav-ferias"],
      esconder: ["nav-grr", "nav-bope"],
    },
    PRF: {
      mostrar: ["nav-grr", "nav-ferias"],
      esconder: ["nav-core", "nav-bope", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope", "nav-ferias"],
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
}

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

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
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
  ).innerText = `AUDITORIA - ${label.nome}`;
};

window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

// =========================================================
// 4. LÓGICA DE AUDITORIA E BARRA DE PROGRESSO
// =========================================================

window.carregarInatividade = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progPercent = document.getElementById("progress-percentage");
  const progLabel = document.getElementById("progress-label");

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "CONECTANDO AO DISCORD...";
  btn.disabled = true;

  let width = 0;
  const interval = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 2;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";
    }
  }, 150);

  try {
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    const dados = await res.json();

    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "VARREDURA COMPLETA!";

    const agora = Date.now();

    dadosInatividadeGlobal = dados.map((m) => {
      let dataRef = Math.max(
        m.lastMsg || 0,
        m.joinedAt || 0,
        DATA_BASE_AUDITORIA
      );
      let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
      return { ...m, diasInatividade: dias, precisaExonerar: dias >= 7 };
    });

    if (dadosInatividadeGlobal.length > 0)
      btnCopiar.style.display = "inline-block";

    dadosInatividadeGlobal.sort(
      (a, b) => b.diasInatividade - a.diasInatividade
    );

    dadosInatividadeGlobal.forEach((m) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><div class="user-cell"><img src="${
          m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
        }" class="avatar-img"><strong>${m.name}</strong></div></td>
        <td><code>${m.id}</code></td>
        <td>${
          m.lastMsg > 0
            ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
            : "---"
        }</td>
        <td><strong style="color: ${
          m.precisaExonerar ? "#ff4d4d" : "#d4af37"
        }">${m.diasInatividade} Dias</strong></td>
        <td align="center"><span class="${
          m.precisaExonerar ? "badge-danger" : "badge-success"
        }">${m.precisaExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
      `;
      corpo.appendChild(tr);
    });

    mostrarAviso("Dados sincronizados.");
  } catch (err) {
    clearInterval(interval);
    mostrarAviso("Erro ao buscar dados.", "error");
  } finally {
    btn.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

// =========================================================
// 5. FUNÇÕES DE CÓPIA COM LIMITE DE 4000 CARACTERES
// =========================================================

window.copiarRelatorioDiscord = function () {
  const { org } = obterSessao();
  const label = getOrgLabel(org);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    mostrarAviso("Sincronize os dados primeiro.", "warning");
    return;
  }

  const exonerados = dadosInatividadeGlobal.filter((m) => m.precisaExonerar);
  if (exonerados.length === 0) {
    mostrarAviso("Nenhum oficial para exoneração.", "warning");
    return;
  }

  const partes = [];
  let textoAtual = `📋 **RELATÓRIO DE EXONERAÇÃO - ${label.nome}** 📋\n📅 DATA: ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  exonerados.forEach((m) => {
    const item = `QRA: <@${m.id}>\nID: ${m.id}\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────\n`;

    // Se adicionar este item ultrapassar 4000, fecha a parte atual e começa uma nova
    if ((textoAtual + item).length > 3950) {
      partes.push(textoAtual);
      textoAtual =
        `📋 **RELATÓRIO DE EXONERAÇÃO - ${label.nome} (Continuação)** 📋\n\n` +
        item;
    } else {
      textoAtual += item;
    }
  });
  partes.push(textoAtual);

  abrirModalRelatorioDividido(partes);
};

// --- NOVAS FUNÇÕES PARA CORE, GRR E BOPE ---

window.copiarRelatorioCore = () =>
  copiarMetasGenerico("CORE (PCERJ)", "corpo-meta-core");
window.copiarRelatorioGRR = () =>
  copiarMetasGenerico("GRR (PRF)", "corpo-meta-grr");
window.copiarRelatorioBOPE = () =>
  copiarMetasGenerico("BOPE (PMERJ)", "corpo-meta-bope");

function copiarMetasGenerico(titulo, containerId) {
  const container = document.getElementById(containerId);
  if (
    !container ||
    container.innerText.trim() === "" ||
    container.innerText.includes("Carregando")
  ) {
    mostrarAviso("Não há dados de metas para copiar.", "warning");
    return;
  }

  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const partes = [];
  let textoAtual = `📊 **RELATÓRIO DE METAS - ${titulo}** 📊\n📅 DATA: ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Tenta pegar todas as linhas da tabela ou cards
  const itens = container.querySelectorAll("tr, .card-meta");

  itens.forEach((el) => {
    const info = el.innerText.replace(/\s+/g, " ").trim();
    const item = `${info}\n────────────────────────────────\n`;

    if ((textoAtual + item).length > 3950) {
      partes.push(textoAtual);
      textoAtual =
        `📊 **RELATÓRIO DE METAS - ${titulo} (Cont.)** 📊\n\n` + item;
    } else {
      textoAtual += item;
    }
  });
  partes.push(textoAtual);
  abrirModalRelatorioDividido(partes);
}

// --- MODAL DE COPIA INTELIGENTE ---

function abrirModalRelatorioDividido(partes) {
  let modal = document.getElementById("modal-relatorio");
  if (!modal) return;

  const container = document.getElementById("container-botoes-partes");
  container.innerHTML = ""; // Limpa anterior

  partes.forEach((texto, index) => {
    const divParte = document.createElement("div");
    divParte.className = "bloco-copia";
    divParte.style.marginBottom = "20px";

    const label = document.createElement("strong");
    label.innerText = `PARTE ${index + 1} (${texto.length} caracteres)`;
    label.style.display = "block";
    label.style.marginBottom = "5px";

    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.style.width = "100%";
    textarea.style.height = "150px";
    textarea.style.background = "#000";
    textarea.style.color = "#04d361"; // Verde para facilitar leitura
    textarea.style.border = "1px solid #333";
    textarea.style.padding = "10px";
    textarea.style.fontSize = "12px";
    textarea.style.resize = "none";
    textarea.readOnly = true;

    const btnCopiar = document.createElement("button");
    btnCopiar.innerHTML = `<i class="fa-solid fa-copy"></i> COPIAR PARTE ${
      index + 1
    }`;
    btnCopiar.className = "btn-gold";
    btnCopiar.style.width = "100%";
    btnCopiar.style.marginTop = "5px";
    btnCopiar.onclick = () => {
      textarea.select();
      navigator.clipboard.writeText(texto);
      mostrarAviso(`Parte ${index + 1} copiada!`);
    };

    divParte.appendChild(label);
    divParte.appendChild(textarea);
    divParte.appendChild(btnCopiar);
    container.appendChild(divParte);
  });

  modal.style.display = "flex";
}

window.fecharModalRelatorio = () => {
  document.getElementById("modal-relatorio").style.display = "none";
};

// =========================================================
// 6. GESTÃO DE FÉRIAS E OUTRAS FUNÇÕES
// =========================================================

window.atualizarListaFerias = async function () {
  const { org } = obterSessao();
  const select = document.getElementById("select-oficiais-ferias");
  const logContainer = document.getElementById("status-ferias-info");

  if (!select) return;
  select.innerHTML = '<option value="">Sincronizando...</option>';

  try {
    const res = await fetch(`/api/verificar-ferias?org=${org}`);
    const data = await res.json();

    select.innerHTML = '<option value="">Selecione para antecipar...</option>';
    if (data.oficiais && data.oficiais.length > 0) {
      data.oficiais.forEach((oficial) => {
        const opt = document.createElement("option");
        opt.value = oficial.id;
        opt.textContent = `🌴 ${oficial.nome} (Até: ${oficial.dataRetorno})`;
        select.appendChild(opt);
      });
    } else {
      select.innerHTML = '<option value="">Nenhum oficial em férias.</option>';
    }
    logContainer.innerHTML =
      data.logs?.length > 0
        ? data.logs.join("<br>")
        : "Sem retornos pendentes.";
  } catch (e) {
    mostrarAviso("Erro ao carregar férias.", "error");
  }
};

window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "AUDITORIA - METAS CORE (PCERJ)";
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("secao-meta-grr").style.visibility = "visible";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "AUDITORIA - METAS GRR (PRF)";
};

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("secao-meta-bope").style.visibility = "visible";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "AUDITORIA - METAS BOPE (PMERJ)";
};

document.addEventListener("DOMContentLoaded", () => {
  aplicarRestricoes();
  window.abrirInatividade();
});
