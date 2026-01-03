// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];

// DATA BASE: 08/12/2025 (Passado recente em relação a 2026 -> Cálculo Positivo)
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
    PRF: { unidade: "GRR", nome: "PRF", logo: "Imagens/PRF_new.png" },
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

// --- IDENTIDADE VISUAL ---
function atualizarIdentidadeVisual(org) {
  const logos = {
    PRF: "Imagens/PRF_new.png",
    PMERJ:
      "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    PCERJ: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    POLICE: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
  };

  const logoUrl = logos[org] || logos["PCERJ"];
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = logoUrl;

  let favicon = document.querySelector("link[rel~='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.getElementsByTagName("head")[0].appendChild(favicon);
  }
  favicon.href = logoUrl;
}

window.mostrarAviso = function (msg, tipo = "success") {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) {
    console.log(`[${tipo}] ${msg}`);
    alert(msg);
    return;
  }
  aviso.innerText = msg;
  aviso.className = `aviso-toast ${tipo}`;
  aviso.style.display = "block";
  setTimeout(() => {
    aviso.style.display = "none";
  }, 4000);
};

// =========================================================
// 2. FUNÇÕES DO COMANDO GERAL
// =========================================================

window.setPainelComando = function (orgEscolhida) {
  const sessao = obterSessao();
  if (!sessao) return;
  const temas = { PCERJ: "tema-pcerj", PRF: "tema-prf", PMERJ: "tema-pmerj" };
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
  atualizarIdentidadeVisual(org);

  const sidebarTitulo = document.querySelector(".sidebar-header h2");
  if (sidebarTitulo)
    sidebarTitulo.innerText = `POLÍCIA ${
      org === "PCERJ" ? "CIVIL" : org === "PMERJ" ? "MILITAR" : "RODOVIÁRIA"
    }`;

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
      mostrar: ["nav-grr", "nav-ferias", "nav-inatividade"],
      esconder: ["nav-core", "nav-bope", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope", "nav-ferias", "nav-inatividade"],
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

// =========================================================
// 5. LÓGICA DE AUDITORIA
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
  if (btnCopiar) btnCopiar.style.display = "none";

  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "LENDO LOGS E CHATS...";
  btn.disabled = true;

  let width = 0;
  const interval = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 2;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";
    }
  }, 300);

  try {
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    if (!res.ok) throw new Error("Erro na API");
    const dados = await res.json();

    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "DADOS PROCESSADOS!";

    if (!Array.isArray(dados) || dados.length === 0) {
      mostrarAviso(
        "Todos os oficiais estão ativos (Ninguém > 7 dias off).",
        "success"
      );
      return;
    }

    dadosInatividadeGlobal = dados.map((m) => {
      const agora = Date.now();
      let dataReferencia = m.lastMsg > 0 ? m.lastMsg : DATA_BASE_AUDITORIA;

      let dias = Math.floor((agora - dataReferencia) / (1000 * 60 * 60 * 24));
      if (dias < 0) dias = 0;

      // GARANTIA DE DADOS:
      // m.id -> Vem da API como o ID REAL DO DISCORD (Snowflake)
      // m.cidadeId -> Vem da API como o Passaporte (ou extraído do nick)

      return {
        ...m,
        diasInatividade: dias,
        precisaExonerar: dias >= 7,
        discordNick: m.name,
        discordId: m.id, // ID PARA MENÇÃO <@...>
        cidadeId: m.cidadeId, // ID PARA TEXTO (PASSAPORTE)
        rpName: m.rpName,
        lastMsg: m.lastMsg,
      };
    });

    // Filtra apenas inativos > 7 dias
    const listaFiltrada = dadosInatividadeGlobal.filter(
      (m) => m.diasInatividade >= 7
    );

    if (listaFiltrada.length > 0 && btnCopiar) {
      btnCopiar.style.display = "inline-block";
    }

    listaFiltrada.sort((a, b) => b.diasInatividade - a.diasInatividade);

    listaFiltrada.forEach((m) => {
      const tr = document.createElement("tr");

      const dataStr =
        m.lastMsg > 0
          ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
          : '<span style="color:#ff4d4d; font-size:10px;">SEM LOGS</span>';

      tr.innerHTML = `
        <td>
           <div class="user-cell">
             <img src="${
               m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
             }" class="avatar-img">
             <div>
               <strong>${m.discordNick}</strong>
               <div style="font-size:11px; color:#aaa;">${m.rpName}</div>
             </div>
           </div>
        </td>
        <td><code>${m.cidadeId}</code></td>
        <td>${dataStr}</td>
        <td><strong style="color: #ff4d4d">${
          m.diasInatividade
        } Dias</strong></td>
        <td align="center"><span class="badge-danger">⚠️ INATIVO</span></td>
      `;
      corpo.appendChild(tr);
    });

    mostrarAviso(`${listaFiltrada.length} oficiais inativos encontrados.`);
  } catch (err) {
    clearInterval(interval);
    console.error(err);
    progBar.style.backgroundColor = "red";
    progLabel.innerText = "ERRO AO PROCESSAR";
    mostrarAviso("Erro ao buscar dados.", "error");
  } finally {
    btn.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
      progBar.style.backgroundColor = "var(--gold-primary)";
    }, 3000);
  }
};

// =========================================================
// 6. RELATÓRIO E CÓPIA
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
    mostrarAviso("Ninguém atingiu o limite de inatividade!", "success");
    return;
  }

  const partes = [];
  let textoAtual = `📋 **RELATÓRIO DE INATIVIDADE - ${label.nome}** 📋\n📅 DATA: ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  exonerados.forEach((m) => {
    let item = "";

    // AQUI ESTA A CORREÇÃO:
    // <@${m.discordId}> -> ID Grande (Azul)
    // ${m.cidadeId} -> Passaporte (Texto)

    if (org === "PMERJ") {
      item = `\`QRA:\` <@${m.discordId}>\n\`ID:\` ${m.cidadeId}\n\`Nome:\` ${m.rpName}\n\`Tempo Off:\` ${m.diasInatividade} dias\n\`Situação:\` INATIVIDADE\n────────────────────────────────\n`;
    } else {
      item = `**OFICIAL:** <@${m.discordId}>\n**PASSAPORTE:** ${m.cidadeId}\n**NOME:** ${m.rpName}\n**DIAS INATIVO:** ${m.diasInatividade}\n────────────────────────────────\n`;
    }

    if ((textoAtual + item).length > 1900) {
      partes.push(textoAtual);
      textoAtual = `📋 **CONTINUAÇÃO RELATÓRIO...**\n\n` + item;
    } else {
      textoAtual += item;
    }
  });

  partes.push(textoAtual);
  abrirModalRelatorioDividido(partes);
};

function abrirModalRelatorioDividido(partes) {
  let modal = document.getElementById("modal-relatorio");
  if (!modal) {
    navigator.clipboard.writeText(partes[0]);
    mostrarAviso("Relatório copiado (Parte 1).");
    return;
  }

  const container = document.getElementById("container-botoes-partes");
  if (container) {
    container.innerHTML = "";
    partes.forEach((texto, index) => {
      const btnCopiar = document.createElement("button");
      btnCopiar.innerHTML = `<i class="fa-solid fa-copy"></i> COPIAR PARTE ${
        index + 1
      }`;
      btnCopiar.className = "btn-gold";
      btnCopiar.style.width = "100%";
      btnCopiar.style.marginBottom = "10px";
      btnCopiar.onclick = () => {
        navigator.clipboard.writeText(texto).then(() => {
          mostrarAviso(`Parte ${index + 1} copiada!`);
        });
      };
      container.appendChild(btnCopiar);
    });
  }
  modal.style.display = "flex";
}

window.fecharModalRelatorio = () => {
  const modal = document.getElementById("modal-relatorio");
  if (modal) modal.style.display = "none";
};

// =========================================================
// 7. PLACEHOLDERS DE OUTRAS FUNÇÕES
// =========================================================

window.abrirGestaoFerias = function () {
  const { org } = obterSessao();
  const label = getOrgLabel(org);
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `GESTÃO DE FÉRIAS - ${label.nome}`;
  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "AUDITORIA - METAS CORE";
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "AUDITORIA - METAS GRR";
};

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "AUDITORIA - METAS BOPE";
};

window.abrirEnsino = function () {
  resetarTelas();
  document.getElementById("secao-ensino").style.display = "block";
  document.getElementById("nav-ensino").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "SISTEMA DE ENSINO";
};
