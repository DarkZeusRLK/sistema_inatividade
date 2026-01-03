// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];
// Define a data base (ex: data do último "limpa" geral ou início da gestão)
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

  // Muda a logo da barra lateral
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = logoUrl;

  // Muda o favicon
  let favicon = document.querySelector("link[rel~='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.getElementsByTagName("head")[0].appendChild(favicon);
  }
  favicon.href = logoUrl;
}

/**
 * Função de Notificação
 */
window.mostrarAviso = function (msg, tipo = "success") {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) {
    console.log(`[${tipo}] ${msg}`);
    // Fallback caso o elemento não exista no HTML
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
  window.abrirInatividade(); // Abre por padrão na tela de auditoria
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
// 5. LÓGICA DE AUDITORIA (CORRIGIDA E BLINDADA)
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

  // Reset Visual
  corpo.innerHTML = "";
  if (btnCopiar) btnCopiar.style.display = "none";
  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "INICIANDO VARREDURA...";
  btn.disabled = true;

  // Barra Fake inicial para dar feedback visual imediato
  let width = 0;
  const interval = setInterval(() => {
    if (width < 85) {
      width += Math.random() * 3;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";
    }
  }, 200);

  try {
    console.log("📡 Solicitando dados da API...");
    const res = await fetch(`/api/membros-inativos?org=${org}`);

    // VERIFICAÇÃO DE ERRO HTTP (ex: 500, 404)
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro Servidor (${res.status}): ${errText}`);
    }

    const dados = await res.json();

    // VERIFICAÇÃO SE VEIO UM ERRO JSON OU FORMATO INVÁLIDO
    if (!Array.isArray(dados)) {
      if (dados.error) throw new Error(dados.error);
      throw new Error("Formato inválido recebido da API.");
    }

    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "PROCESSANDO DADOS...";

    if (dados.length === 0) {
      mostrarAviso("Nenhum membro encontrado ou erro na leitura.", "warning");
      return;
    }

    // Processamento dos dados
    dadosInatividadeGlobal = dados.map((m) => {
      const agora = Date.now();

      // Se lastMsg for 0, usa a data de entrada (joinedAt). Se joinedAt for antigo, usa a DATA_BASE.
      let dataRef =
        m.lastMsg > 0
          ? m.lastMsg
          : Math.max(m.joinedAt || 0, DATA_BASE_AUDITORIA);

      // Cálculo de dias
      let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
      if (dias < 0) dias = 0; // Evita dias negativos se data for hoje

      return {
        ...m,
        diasInatividade: dias,
        precisaExonerar: dias >= 3, // Regra de 3 dias (ajuste conforme necessidade)
        discordNick: m.name || "Sem Nome",
        discordId: m.id,
        rpName: m.rpName || "Não identificado",
        cidadeId: m.cidadeId || "---",
        lastMsg: m.lastMsg,
      };
    });

    // Botão de copiar aparece se tiver dados
    if (dadosInatividadeGlobal.length > 0 && btnCopiar) {
      btnCopiar.style.display = "inline-block";
    }

    // Ordena: Quem tem mais dias inativo aparece primeiro
    dadosInatividadeGlobal.sort(
      (a, b) => b.diasInatividade - a.diasInatividade
    );

    // Renderiza na Tabela
    dadosInatividadeGlobal.forEach((m) => {
      const tr = document.createElement("tr");

      const dataFormatada =
        m.lastMsg > 0
          ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
          : '<span style="color: #ffb400; font-size: 0.85em;">SEM REGISTRO</span>';

      tr.innerHTML = `
        <td>
            <div class="user-cell">
                <img src="${
                  m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
                }" class="avatar-img" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <div>
                    <strong>${m.discordNick}</strong>
                    <div style="font-size: 11px; color: #aaa;">${m.rpName}</div>
                </div>
            </div>
        </td>
        <td><code>${m.cidadeId}</code></td>
        <td>${dataFormatada}</td>
        <td>
            <strong style="color: ${m.precisaExonerar ? "#ff4d4d" : "#d4af37"}">
                ${m.diasInatividade} Dias
            </strong>
        </td>
        <td align="center">
            <span class="${
              m.precisaExonerar ? "badge-danger" : "badge-success"
            }">
                ${m.precisaExonerar ? "⚠️ REVISAR" : "✅ ATIVO"}
            </span>
        </td>
      `;
      corpo.appendChild(tr);
    });

    mostrarAviso(
      `Sincronização concluída! ${dados.length} oficiais analisados.`
    );
  } catch (err) {
    clearInterval(interval);
    console.error("Erro no Frontend:", err);
    progBar.style.backgroundColor = "#ff4d4d";
    progLabel.innerText = "FALHA NA CONEXÃO";
    mostrarAviso(err.message || "Erro ao conectar com a API.", "error");
  } finally {
    btn.disabled = false;
    setTimeout(() => {
      // Esconde a barra apenas se deu certo ou passou muito tempo
      progContainer.style.display = "none";
      // Reseta cor da barra
      progBar.style.backgroundColor = "var(--gold-primary)";
    }, 4000);
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

  // Filtra apenas quem está marcado para exonerar/revisar
  const exonerados = dadosInatividadeGlobal.filter((m) => m.precisaExonerar);

  if (exonerados.length === 0) {
    mostrarAviso("Ninguém atingiu o limite de inatividade!", "success");
    return;
  }

  const partes = [];
  let textoAtual = `📋 **RELATÓRIO DE INATIVIDADE - ${label.nome}** 📋\n📅 DATA: ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  exonerados.forEach((m) => {
    let item = "";

    // MODELO PMERJ
    if (org === "PMERJ") {
      item = `\`QRA:\` <@${m.discordId}>\n\`ID:\` ${m.cidadeId}\n\`Nome:\` ${m.rpName}\n\`Tempo Off:\` ${m.diasInatividade} dias\n\`Situação:\` INATIVIDADE\n────────────────────────────────\n`;
    }
    // MODELO PRF / PCERJ (PADRÃO)
    else {
      item = `**OFICIAL:** <@${m.discordId}>\n**PASSAPORTE:** ${m.cidadeId}\n**NOME:** ${m.rpName}\n**DIAS INATIVO:** ${m.diasInatividade}\n────────────────────────────────\n`;
    }

    // Divide se passar de 1900 caracteres (limite seguro do Discord)
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
  // Se o modal não existe no HTML, cria um alerta simples
  if (!modal) {
    // Tenta copiar a primeira parte direto
    navigator.clipboard.writeText(partes[0]);
    mostrarAviso("Relatório copiado (Parte 1). Verifique se há mais partes.");
    return;
  }

  const container = document.getElementById("container-botoes-partes"); // Precisa existir no HTML
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
// 7. GESTÃO DE FÉRIAS (PLACEHOLDER)
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

  // Se tiver função de carregar férias, chama aqui
  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

// =========================================================
// 8. METAS E ENSINO
// =========================================================

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

window.abrirEnsino = function () {
  resetarTelas();
  document.getElementById("secao-ensino").style.display = "block";
  document.getElementById("botoes-ensino").style.display = "block";
  document.getElementById("nav-ensino").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "SISTEMA DE ENSINO";
};
