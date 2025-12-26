// =========================================================
// 1. CONFIGURAÇÕES, SESSÃO E UTILITÁRIOS
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

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Função para encerrar a sessão
window.fazerLogout = function () {
  if (confirm("Deseja realmente encerrar sua sessão no painel?")) {
    localStorage.removeItem("pc_session");
    window.location.href = "login.html";
  }
};

// =========================================================
// 2. INICIALIZAÇÃO E PERMISSÕES
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const sessao = obterSessao();
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }

  // Aplica o Tema e Identidade Visual
  document.body.className = sessao.tema;

  const logoImg = document.getElementById("logo-org");
  const tituloPainel = document.querySelector(".sidebar-header h2");
  const nomeUsuario = document.getElementById("nome-usuario");

  const BRASOES = {
    PCERJ: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    PRF: "Imagens/PRF_new.png",
    PMERJ:
      "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
  };

  if (logoImg) logoImg.src = BRASOES[sessao.org] || BRASOES.PCERJ;
  if (tituloPainel) tituloPainel.innerText = sessao.org;
  if (nomeUsuario) nomeUsuario.innerText = sessao.nome;

  aplicarRestricoes(sessao.org);
  window.abrirInatividade(); // Tela inicial padrão
});

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
}

// =========================================================
// 3. NAVEGAÇÃO ENTRE TELAS
// =========================================================

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
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });

  gruposBotoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
}

window.abrirInatividade = function () {
  const sessao = obterSessao();
  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `AUDITORIA DE ATIVIDADE - ${sessao.org}`;
};

window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - CORE";
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("secao-meta-grr").style.visibility = "visible";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - GRR";
};

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("secao-meta-bope").style.visibility = "visible";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - BOPE";
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
// 4. AUDITORIA E BARRA DE PROGRESSO
// =========================================================

let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const sessao = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btnSinc = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");

  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progLabel = document.getElementById("progress-label");
  const progPerc = document.getElementById("progress-percentage");

  if (!corpo) return;
  corpo.innerHTML =
    '<tr><td colspan="5" align="center" style="padding:40px; color:#888;">Iniciando conexão...</td></tr>';
  btnSinc.disabled = true;
  progContainer.style.display = "block";

  const updateProgress = (text, percent) => {
    progLabel.innerText = text.toUpperCase();
    progBar.style.width = percent + "%";
    progPerc.innerText = percent + "%";
  };

  try {
    updateProgress("Conectando ao Discord...", 20);
    await delay(800);

    updateProgress("Verificando lista de oficiais ausentes...", 50);
    const res = await fetch(`/api/membros-inativos?org=${sessao.org}`);
    const dados = await res.json();
    listaMembrosAtual = dados;
    await delay(600);

    updateProgress("Filtrando férias e licenças...", 80);
    await delay(800);

    updateProgress("Finalizando auditoria...", 100);
    await delay(500);

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
                  statusExonerar ? "#ff4d4d" : "var(--gold)"
                }">${dias} Dias</strong></td>
                <td align="center"><span class="${
                  statusExonerar ? "badge-danger" : "badge-success"
                }">${statusExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
            `;
      corpo.appendChild(tr);
    });

    mostrarAviso("Sincronização concluída!");
  } catch (err) {
    mostrarAviso("Erro na sincronização.", "error");
    corpo.innerHTML =
      '<tr><td colspan="5" align="center" style="color:red;">Falha ao obter dados do servidor.</td></tr>';
  } finally {
    btnSinc.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

// =========================================================
// 5. RELATÓRIOS E FÉRIAS
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
    return mostrarAviso(
      "Nenhum oficial identificado para exoneração.",
      "success"
    );

  const formatador = (membros) => {
    let texto = "";
    membros.forEach((m) => {
      let idRP = m.fullNickname?.split("|")[1]?.trim() || "---";
      texto += `QRA: <@${m.id}>\nNOME NA CIDADE: ${
        m.rpName || m.name
      }\nID: ${idRP}\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────\n`;
    });
    return texto;
  };

  let cabecalho = `📋 **RELATÓRIO DE EXONERAÇÃO - ${sessao.org}** 📋\n📅 **DATA:** ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  let relatorio = cabecalho + formatador(exonerados);

  if (relatorio.length <= 1900) {
    navigator.clipboard
      .writeText(relatorio)
      .then(() => mostrarAviso("Relatório copiado!"));
  } else {
    abrirModalDivisor(exonerados, dataHoje, cabecalho, formatador);
  }
};

// Demais funções (Divisor de Modal, Alertas, Férias) permanecem para garantir o funcionamento do HTML fornecido
function abrirModalDivisor(membros, data, header, formatador) {
  const container = document.getElementById("container-botoes-partes");
  container.innerHTML = "";
  const limit = 8;
  for (let i = 0; i < membros.length; i += limit) {
    const bloco = membros.slice(i, i + limit);
    const parte = Math.floor(i / limit) + 1;
    const btn = document.createElement("button");
    btn.className = "btn-parte";
    btn.innerHTML = `<i class="fa-solid fa-copy"></i> PARTE ${parte}`;
    btn.onclick = () => {
      navigator.clipboard.writeText(
        header + `(PARTE ${parte})\n\n` + formatador(bloco)
      );
      mostrarAviso(`Parte ${parte} copiada!`);
    };
    container.appendChild(btn);
  }
  document.getElementById("modal-relatorio").style.display = "flex";
}

window.fecharModalRelatorio = () =>
  (document.getElementById("modal-relatorio").style.display = "none");

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

// Inclusão das chamadas de metas externas (Caso os scripts metas/script-xxx.js dependam delas)
window.carregarMetaCore =
  window.carregarMetaCore ||
  (() => console.log("Função Core carregada do script externo"));
window.carregarMetaGRR =
  window.carregarMetaGRR ||
  (() => console.log("Função GRR carregada do script externo"));
window.carregarMetaBOPE =
  window.carregarMetaBOPE ||
  (() => console.log("Função BOPE carregada do script externo"));
