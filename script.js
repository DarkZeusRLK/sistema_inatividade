// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];
const DATA_BASE_AUDITORIA = new Date("2025-12-08T00:00:00").getTime();

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");

  if (!sessionStr) {
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
    return null;
  }

  const sessao = JSON.parse(sessionStr);

  if (sessao.expira && Date.now() > sessao.expira) {
    localStorage.removeItem("pc_session");
    window.location.href = "login.html";
    return null;
  }

  return sessao;
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
  return (
    labels[org] || {
      unidade: "---",
      nome: "SISTEMA",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    }
  );
};

/**
 * Atualiza a Logo da Sidebar e o Favicon da aba do navegador
 */
function atualizarIdentidadeVisual(org) {
  const config = getOrgLabel(org);
  const logoUrl = config.logo;

  // Muda a logo da barra lateral
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = logoUrl;

  // Muda o favicon (ícone da aba)
  let favicon = document.querySelector("link[rel~='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.getElementsByTagName("head")[0].appendChild(favicon);
  }
  favicon.href = logoUrl;
}

// =========================================================
// 2. FUNÇÕES DO COMANDO GERAL
// =========================================================

window.setPainelComando = function (orgEscolhida) {
  const sessao = obterSessao();
  if (!sessao) return;

  const temas = {
    PCERJ: "tema-pcerj",
    PRF: "tema-prf",
    PMERJ: "tema-pmerj",
  };

  sessao.org = orgEscolhida;
  sessao.tema = temas[orgEscolhida];

  localStorage.setItem("pc_session", JSON.stringify(sessao));
  window.location.reload();
};

window.abrirSelecaoPainel = function () {
  const modal = document.getElementById("modal-selecao-comando");
  if (modal) modal.style.display = "flex";
};

// =========================================================
// 3. INICIALIZAÇÃO E PERMISSÕES
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const sessao = obterSessao();
  if (!sessao) return;

  if (sessao.tema) document.body.classList.add(sessao.tema);

  if (sessao.isComando) {
    const btnTrocar = document.getElementById("wrapper-comando");
    if (btnTrocar) btnTrocar.style.display = "block";

    if (!sessao.org) {
      window.abrirSelecaoPainel();
      return;
    }
  }

  aplicarRestricoes();
  window.abrirInatividade();
});

function aplicarRestricoes() {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;

  const { org } = sessao;
  const configOrg = getOrgLabel(org);

  // 1. Atualiza Identidade Visual (Logo, Favicon e Títulos)
  atualizarIdentidadeVisual(org);

  const sidebarTitulo = document.querySelector(".sidebar-header h2");
  if (sidebarTitulo) {
    const titulos = { PCERJ: "CIVIL", PMERJ: "MILITAR", PRF: "RODOVIÁRIA" };
    sidebarTitulo.innerText = `POLÍCIA ${titulos[org] || "SISTEMA"}`;
  }

  // 2. Filtra Itens de Navegação
  const permissoes = {
    PCERJ: {
      mostrar: [
        "nav-core",
        "nav-porte",
        "nav-admin",
        "nav-ferias",
        "nav-inatividade",
        "nav-ensino",
      ],
      esconder: ["nav-grr", "nav-bope"],
    },
    PRF: {
      mostrar: ["nav-grr", "nav-ferias", "nav-inatividade", "nav-ensino"],
      esconder: ["nav-core", "nav-bope", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope", "nav-ferias", "nav-inatividade", "nav-ensino"],
      esconder: ["nav-core", "nav-grr", "nav-porte", "nav-admin"],
    },
  };

  const config = permissoes[org];
  if (config) {
    config.esconder.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    config.mostrar.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "flex";
    });
  }
}

// =========================================================
// 4. GERENCIAMENTO DE TELAS
// =========================================================

function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
    "secao-ensino",
  ];

  const gruposBotoes = [
    "botoes-inatividade",
    "botoes-core",
    "botoes-grr",
    "botoes-bope",
    "botoes-ferias",
    "botoes-ensino",
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
  if (!sessao || !sessao.org) return;
  const label = getOrgLabel(sessao.org);

  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `AUDITORIA - ${label.nome}`;
  document.getElementById(
    "subtitulo-pagina"
  ).innerText = `Controle de Presença - Unidade ${label.unidade}`;
};

window.abrirEnsino = function () {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;
  const label = getOrgLabel(sessao.org);

  resetarTelas();
  document.getElementById("secao-ensino").style.display = "block";
  document.getElementById("secao-ensino").style.visibility = "visible";
  document.getElementById("botoes-ensino").style.display = "block";
  document.getElementById("nav-ensino").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `DIVISÃO DE ENSINO - ${label.nome}`;
  document.getElementById(
    "subtitulo-pagina"
  ).innerText = `Relatório Automático de Metas e Instrutoria`;
};

// =========================================================
// 5. LÓGICA DE AUDITORIA E RELATÓRIO
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

    dadosInatividadeGlobal = dados.map((m) => {
      const agora = Date.now();
      let dataRef =
        m.lastMsg > 0
          ? m.lastMsg
          : Math.max(m.joinedAt || 0, DATA_BASE_AUDITORIA);
      let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
      if (dias < 0) dias = 0;

      return {
        ...m,
        diasInatividade: dias,
        precisaExonerar: dias >= 7,
        discordNick: m.name || "Sem Nome",
        discordId: m.id,
      };
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
        }" class="avatar-img"><strong>${m.discordNick}</strong></div></td>
        <td><code>${m.discordId}</code></td>
        <td>${
          m.lastMsg > 0
            ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
            : '<span style="color: #ffb400; font-weight: bold;">⚠️ SEM REGISTROS</span>'
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

window.copiarRelatorioDiscord = function () {
  const { org } = obterSessao();
  const label = getOrgLabel(org);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    mostrarAviso("Sincronize os dados primeiro.", "warning");
    return;
  }

  const exonerados = dadosInatividadeGlobal.filter((m) => m.precisaExonerar);
  const partes = [];
  let textoAtual = `📋 **RELATÓRIO DE EXONERAÇÃO - ${label.nome}** 📋\n📅 DATA: ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  exonerados.forEach((m) => {
    const item = `QRA: <@${m.discordId}>\nID: ${m.cidadeId}\nNome na cidade: ${m.rpName}\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────\n`;
    if ((textoAtual + item).length > 1900) {
      partes.push(textoAtual);
      textoAtual =
        `📋 **RELATÓRIO DE EXONERAÇÃO - ${label.nome} (Cont.)** 📋\n\n` + item;
    } else {
      textoAtual += item;
    }
  });
  partes.push(textoAtual);
  abrirModalRelatorioDividido(partes);
};

// =========================================================
// 6. MODAIS E UTILITÁRIOS
// =========================================================

function abrirModalRelatorioDividido(partes) {
  const modal = document.getElementById("modal-relatorio");
  const container = document.getElementById("container-botoes-partes");
  if (!modal || !container) return;

  container.innerHTML = "";
  partes.forEach((texto, index) => {
    const btn = document.createElement("button");
    btn.innerHTML = `<i class="fa-solid fa-copy"></i> COPIAR PARTE ${
      index + 1
    }`;
    btn.className = "btn-gold";
    btn.style.width = "100%";
    btn.onclick = () => {
      navigator.clipboard.writeText(texto).then(() => {
        mostrarAviso(`Parte ${index + 1} copiada!`);
      });
    };
    container.appendChild(btn);
  });
  modal.style.display = "flex";
}

window.fecharModalRelatorio = () => {
  document.getElementById("modal-relatorio").style.display = "none";
};

// =========================================================
// 7. GESTÃO DE FÉRIAS E METAS
// =========================================================

window.abrirGestaoFerias = function () {
  const { org } = obterSessao();
  const label = getOrgLabel(org);
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `GESTÃO DE FÉRIAS - ${label.nome}`;
  window.atualizarListaFerias();
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
