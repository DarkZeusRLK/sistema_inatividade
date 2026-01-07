// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];

const CARGOS_PROTEGIDOS = [
  "Delegado PCERJ",
  "Delegado Adj. PCERJ",
  "Comando CGPC",
  "Comando SAER",
  "Comando GEM",
  "Comando CORE",
  "Coordenador Civil",
];

const DATA_BASE_AUDITORIA = new Date("2024-12-08T00:00:00").getTime();

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

function atualizarIdentidadeVisual(org) {
  const logos = {
    PRF: "Imagens/PRF_new.png",
    PMERJ:
      "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    PCERJ: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
  };
  const logoUrl = logos[org] || logos["PCERJ"];
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = logoUrl;
  let favicon =
    document.querySelector("link[rel~='icon']") ||
    document.createElement("link");
  favicon.rel = "icon";
  favicon.href = logoUrl;
  document.getElementsByTagName("head")[0].appendChild(favicon);
}

window.mostrarAviso = function (msg, tipo = "success") {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) {
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
// 3. INICIALIZAÇÃO
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
      esconder: [
        "nav-core",
        "nav-bope",
        "nav-porte",
        "nav-admin",
        "nav-ensino",
      ],
    },
    PMERJ: {
      mostrar: ["nav-bope", "nav-ferias", "nav-inatividade"],
      esconder: ["nav-core", "nav-grr", "nav-porte", "nav-admin", "nav-ensino"],
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
  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });
  document
    .querySelectorAll('[id^="botoes-"]')
    .forEach((el) => (el.style.display = "none"));
  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
}

window.abrirInatividade = function () {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;
  const label = getOrgLabel(sessao.org);
  resetarTelas();
  const secao = document.getElementById("secao-inatividade");
  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  const botoes = document.getElementById("botoes-inatividade");
  if (botoes) botoes.style.display = "block";
  const nav = document.getElementById("nav-inatividade");
  if (nav) nav.classList.add("active");
  const titulo = document.getElementById("titulo-pagina");
  if (titulo) titulo.innerText = `AUDITORIA - ${label.nome}`;
};

// =========================================================
// 5. LÓGICA DE INATIVIDADE (BARRA DE PROGRESSO CORRIGIDA)
// =========================================================
window.carregarInatividade = async function () {
  const sessao = obterSessao();
  if (!sessao) return;
  const { org } = sessao;

  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");

  if (!corpo) return;

  // Ativa Interface de Carregamento
  corpo.innerHTML =
    '<tr><td colspan="6" align="center">🔍 Consultando banco de dados do Discord...</td></tr>';
  if (progContainer) {
    progContainer.style.display = "block";
    const barra = progContainer.querySelector(".progress-bar");
    if (barra) barra.style.width = "100%"; // Garante animação se houver
  }
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    const dados = await res.json();

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">Nenhum inativo encontrado.</td></tr>';
    } else {
      dadosInatividadeGlobal = dados.filter((m) => {
        const diasInatividade =
          m.dias ||
          Math.floor(
            (Date.now() - (m.lastMsg || DATA_BASE_AUDITORIA)) /
              (1000 * 60 * 60 * 24)
          );
        const inativoSuficiente = diasInatividade >= 7;
        const eCargoProtegido = CARGOS_PROTEGIDOS.includes(m.cargo);
        return inativoSuficiente && !eCargoProtegido;
      });

      dadosInatividadeGlobal.sort((a, b) => (b.dias || 0) - (a.dias || 0));
      corpo.innerHTML = "";

      if (dadosInatividadeGlobal.length === 0) {
        corpo.innerHTML =
          '<tr><td colspan="6" align="center">Nenhum oficial fora do comando está inativo.</td></tr>';
      } else {
        dadosInatividadeGlobal.forEach((m) => {
          const tr = document.createElement("tr");
          const dataStr =
            m.lastMsg > 0
              ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
              : "Nunca interagiu";
          tr.innerHTML = `
            <td><div class="user-cell"><img src="${
              m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
            }" class="avatar-img">
            <div><strong>${m.name}</strong><br><small>${
            m.cargo || "Oficial"
          }</small></div></div></td>
            <td><code>${m.id}</code></td><td>${dataStr}</td>
            <td><strong style="color: #ff4d4d">${m.dias || 0} Dias</strong></td>
            <td align="center"><div style="display: flex; gap: 8px; justify-content: center;">
            <span class="badge-danger">⚠️ INATIVO</span>
            <button onclick="window.exonerarMembro('${m.id}', '${
            m.rpName || m.name
          }', '${
            m.cargo
          }')" class="btn-exonerar"><i class="fa-solid fa-user-slash"></i></button>
            </div></td>`;
          corpo.appendChild(tr);
        });
        mostrarAviso(`${dadosInatividadeGlobal.length} inativos listados.`);
      }
    }
  } catch (err) {
    console.error(err);
    corpo.innerHTML =
      '<tr><td colspan="6" align="center" style="color:red">Erro ao conectar com a API.</td></tr>';
    mostrarAviso("Erro ao carregar inativos.", "error");
  } finally {
    // SEMPRE desativa o carregamento
    if (btn) btn.disabled = false;
    if (progContainer) progContainer.style.display = "none";
  }
};

window.exonerarMembro = async function (discordId, rpName, cargo) {
  const idMatch = rpName.match(/(\d+)$/);
  const passaporte = idMatch ? idMatch[1] : "---";
  const nomeLimpo = rpName.split(/[|/]/)[0].trim();

  const motivo = prompt(
    `Motivo da exoneração de ${nomeLimpo}:`,
    "Inatividade superior a 7 dias"
  );
  if (!motivo) return;

  if (
    !confirm(
      `Confirmar envio de relatório de exoneração de ${nomeLimpo} para o Discord?`
    )
  )
    return;

  try {
    const res = await fetch("/api/exonerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discordUser: discordId,
        nomeCidade: nomeLimpo,
        idPassaporte: passaporte,
        cargo: cargo || "Oficial",
        motivo: motivo,
      }),
    });

    if (res.ok) {
      mostrarAviso("Relatório de exoneração enviado!");
      window.carregarInatividade();
    } else {
      const erro = await res.json();
      alert(
        `Falha ao enviar relatório: ${erro.error || "Erro no servidor Discord"}`
      );
    }
  } catch (e) {
    alert("Erro na conexão com a API de exoneração.");
  }
};

// =========================================================
// 6. GESTÃO DE FÉRIAS E METAS
// =========================================================
window.abrirGestaoFerias = function () {
  resetarTelas();
  const secao = document.getElementById("secao-gestao-ferias");
  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  const nav = document.getElementById("nav-ferias");
  if (nav) nav.classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS E LICENÇAS";
  document.getElementById("botoes-ferias").style.display = "block";
  window.atualizarListaFerias();
};

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const infoBox = document.getElementById("status-ferias-info");
  const sessao = obterSessao();
  const org = sessao?.org || "PCERJ";

  if (!select || !infoBox) return;
  select.innerHTML = '<option value="">🔄 Sincronizando...</option>';

  try {
    const response = await fetch(`/api/verificar-ferias?org=${org}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    select.innerHTML = '<option value="">Selecione um oficial...</option>';
    if (!data.oficiais || data.oficiais.length === 0) {
      select.innerHTML = '<option value="">Nenhum oficial em férias</option>';
      infoBox.innerHTML =
        "✅ Sincronização concluída: Nenhum oficial em férias.";
      return;
    }
    data.oficiais.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = `${o.nome} (Retorno: ${o.dataRetorno})`;
      select.appendChild(opt);
    });
    infoBox.innerHTML = `✅ ${data.oficiais.length} oficiais em férias encontrados.`;
  } catch (error) {
    select.innerHTML = '<option value="">Erro ao sincronizar</option>';
    infoBox.innerHTML = `<span style="color: #ff4444;">❌ Erro: ${error.message}</span>`;
  }
};

// Funções de Metas (Simplificadas)
const abrirMetaGen = (idSecao, idBotoes, idNav, titulo, orgReq) => {
  const sessao = obterSessao();
  if (!sessao || sessao.org !== orgReq) {
    mostrarAviso(`Acesso negado ao painel da ${orgReq}.`, "error");
    return;
  }
  resetarTelas();
  document.getElementById(idSecao).style.display = "block";
  document.getElementById(idSecao).style.visibility = "visible";
  document.getElementById(idBotoes).style.display = "block";
  document.getElementById(idNav).classList.add("active");
  document.getElementById("titulo-pagina").innerText = titulo;
};

window.abrirMetaCore = () =>
  abrirMetaGen(
    "secao-meta-core",
    "botoes-core",
    "nav-core",
    "AUDITORIA - METAS CORE (PCERJ)",
    "PCERJ"
  );
window.abrirMetaGRR = () =>
  abrirMetaGen(
    "secao-meta-grr",
    "botoes-grr",
    "nav-grr",
    "AUDITORIA - METAS GRR (PRF)",
    "PRF"
  );
window.abrirMetaBOPE = () =>
  abrirMetaGen(
    "secao-meta-bope",
    "botoes-bope",
    "nav-bope",
    "AUDITORIA - METAS BOPE (PMERJ)",
    "PMERJ"
  );

window.abrirEnsino = function () {
  resetarTelas();
  const secao = document.getElementById("secao-ensino");
  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  document.getElementById("botoes-ensino").style.display = "block";
  document.getElementById("nav-ensino")?.classList.add("active");
  document.getElementById("titulo-pagina").innerText = "SISTEMA DE ENSINO";
};
