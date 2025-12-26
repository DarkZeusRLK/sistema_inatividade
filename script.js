// =========================================================
// 1. CONFIGURAÇÕES E SESSÃO
// =========================================================

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  if (!sessionStr) return null;
  return JSON.parse(sessionStr);
};

const getOrgLabel = (org) => {
  const labels = {
    PCERJ: { unidade: "CORE", nome: "PCERJ", tema: "tema-pcerj" },
    PRF: { unidade: "GRR", nome: "PRF", tema: "tema-prf" },
    PMERJ: { unidade: "BOPE", nome: "PMERJ", tema: "tema-pmerj" },
  };
  return labels[org] || labels["PCERJ"];
};

// =========================================================
// 2. INICIALIZAÇÃO DINÂMICA (SUBSTITUI OS 3 DOMContentLoaded)
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const sessao = obterSessao();
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }

  // 1. Aplica Identidade Visual
  document.body.className = sessao.tema;
  const config = getOrgLabel(sessao.org);

  const logoImg = document.getElementById("logo-org");
  const tituloPainel = document.querySelector(".sidebar-header h2");
  const nomeUsuario = document.getElementById("nome-usuario"); // Certifique-se que esse ID existe no HTML

  const BRASOES = {
    PCERJ: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    PRF: "Imagens/PRF_new.png",
    PMERJ:
      "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
  };

  if (logoImg) logoImg.src = BRASOES[sessao.org];
  if (tituloPainel) tituloPainel.innerText = config.nome;
  if (nomeUsuario) nomeUsuario.innerText = sessao.nome;

  // 2. Aplica Restrições de Acesso
  aplicarRestricoes(sessao.org);

  // 3. Abre a tela inicial
  window.abrirInatividade();
});

// =========================================================
// 3. NAVEGAÇÃO E RESTRIÇÕES
// =========================================================

function aplicarRestricoes(org) {
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

  // Bloqueio de funções via Console
  if (org !== "PCERJ")
    window.abrirMetaCore = () =>
      mostrarAviso("Acesso restrito à PCERJ", "error");
  if (org !== "PRF")
    window.abrirMetaGRR = () => mostrarAviso("Acesso restrito à PRF", "error");
  if (org !== "PMERJ")
    window.abrirMetaBOPE = () =>
      mostrarAviso("Acesso restrito à PMERJ", "error");
}

function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
  ];
  const gruposBotoes = [
    "botoes-inatividade",
    "botoes-core",
    "botoes-grr",
    "botoes-bope",
    "botoes-ferias",
  ];

  secoes.forEach((id) => {
    if (document.getElementById(id))
      document.getElementById(id).style.display = "none";
  });
  gruposBotoes.forEach((id) => {
    if (document.getElementById(id))
      document.getElementById(id).style.display = "none";
  });
  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
}

// Funções globais de abertura
window.abrirInatividade = function () {
  const sessao = obterSessao();
  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `SISTEMA DE AUDITORIA - ${sessao.org}`;
};

window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - CORE";
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - GRR";
};

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - BOPE";
};

window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS - COMANDO";
  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

// =========================================================
// 4. LÓGICA DE AUDITORIA E BARRA DE PROGRESSO
// =========================================================

let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const sessao = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btnSinc = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");

  corpo.innerHTML =
    '<tr><td colspan="5" align="center">Sincronizando...</td></tr>';
  progContainer.style.display = "block";
  progBar.style.width = "10%"; // Começa em 10%
  btnSinc.disabled = true;

  try {
    const res = await fetch(`/api/membros-inativos?org=${sessao.org}`);
    progBar.style.width = "60%"; // Meio do caminho

    const dados = await res.json();
    listaMembrosAtual = dados;

    progBar.style.width = "100%"; // Finaliza
    corpo.innerHTML = "";
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
                  membro.avatar ||
                  "https://cdn.discordapp.com/embed/avatars/0.png"
                }" class="avatar-img"><strong>${membro.name}</strong></div></td>
                <td><code>${membro.id}</code></td>
                <td>${
                  membro.lastMsg > 0
                    ? new Date(membro.lastMsg).toLocaleDateString("pt-BR")
                    : "---"
                }</td>
                <td><strong style="color: ${
                  statusExonerar ? "var(--danger)" : "var(--gold)"
                }">${dias} Dias</strong></td>
                <td align="center"><span class="${
                  statusExonerar ? "badge-danger" : "badge-success"
                }">${statusExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
            `;
      corpo.appendChild(tr);
    });
    mostrarAviso("Sincronização concluída!");
  } catch (err) {
    mostrarAviso("Erro ao buscar dados.", "error");
    corpo.innerHTML =
      '<tr><td colspan="5" align="center">Erro na conexão.</td></tr>';
  } finally {
    btnSinc.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 2000);
  }
};

// =========================================================
// 5. RELATÓRIOS E UTILITÁRIOS
// =========================================================

window.copiarRelatorioDiscord = function () {
  const sessao = obterSessao();
  if (listaMembrosAtual.length === 0)
    return mostrarAviso("Sincronize os dados primeiro.", "warning");

  const agora = new Date();
  const dataHoje = agora.toLocaleDateString("pt-BR");
  const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

  const exonerados = listaMembrosAtual.filter((m) => {
    let dataRef = Math.max(m.lastMsg || 0, m.joinedAt || 0, dataBaseAuditoria);
    let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
    return dias >= 7;
  });

  if (exonerados.length === 0)
    return mostrarAviso("Nenhum oficial para exonerar.", "success");

  const formatador = (membros) => {
    let texto = "";
    membros.forEach((m) => {
      let idRP = m.fullNickname?.split("|")[1]?.trim() || "---";
      texto += `QRA: <@${m.id}>\nNOME: ${
        m.rpName || m.name
      }\nID: ${idRP}\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────\n`;
    });
    return texto;
  };

  let cabecalho = `📋 **RELATÓRIO DE EXONERAÇÃO - ${sessao.org}** 📋\n📅 **DATA:** ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  let relatorioFinal = cabecalho + formatador(exonerados);

  if (relatorioFinal.length <= 1900) {
    navigator.clipboard
      .writeText(relatorioFinal)
      .then(() => mostrarAviso("Relatório copiado!"));
  } else {
    abrirModalDivisor(exonerados, dataHoje, cabecalho, formatador);
  }
};

function mostrarAviso(mensagem, tipo = "success") {
  let container = document.getElementById("custom-alert-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "custom-alert-container";
    document.body.appendChild(container);
  }
  const alert = document.createElement("div");
  alert.className = `pc-alert ${tipo}`;
  alert.innerHTML = `<i class="fa-solid ${
    tipo === "success" ? "fa-check-circle" : "fa-triangle-exclamation"
  }"></i> <span>${mensagem}</span>`;
  container.appendChild(alert);
  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => alert.remove(), 500);
  }, 3500);
}

window.fazerLogout = function () {
  if (confirm("Deseja sair do sistema?")) {
    localStorage.removeItem("pc_session");
    window.location.href = "login.html";
  }
};
