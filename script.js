// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS (VERSÃO VERCEL)
// =========================================================

// ✅ ADAPTAÇÃO VERCEL: Deixamos vazio.
// O navegador buscará automaticamente na pasta /api do próprio site.
const API_BASE = "";

let dadosInatividadeGlobal = [];

// Lista de cargos que o sistema ignora (não cobra inatividade)
const CARGOS_PROTEGIDOS = [
  "Delegado PCERJ",
  "Delegado Adj. PCERJ",
  "Comando CGPC",
  "Comando SAER",
  "Comando GEM",
  "Comando CORE",
  "Coordenador Civil",
  "Comando",
  "Staff",
  "Admin",
  "Suporte",
];

// Data base para cálculo
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
  return labels[org] || labels["PCERJ"];
};

function atualizarIdentidadeVisual(org) {
  const info = getOrgLabel(org);
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = info.logo;

  let favicon =
    document.querySelector("link[rel~='icon']") ||
    document.createElement("link");
  favicon.rel = "icon";
  favicon.href = info.logo;
  document.getElementsByTagName("head")[0].appendChild(favicon);
}

// --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---
window.mostrarAviso = function (msg, tipo = "success") {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) return console.log(`[${tipo}] ${msg}`);

  const icon = tipo === "success" ? "✅ " : tipo === "error" ? "❌ " : "⚠️ ";
  aviso.innerHTML = `<strong>${icon}</strong> ${msg}`;
  aviso.className = `aviso-toast ${tipo}`;
  aviso.style.display = "block";
  setTimeout(() => {
    aviso.style.display = "none";
  }, 4000);
};

// --- SISTEMA DE MODAL ---
function exibirModalConfirmacao(titulo, htmlMensagem, onConfirmar) {
  const antigo = document.getElementById("custom-modal-confirm");
  if (antigo) antigo.remove();

  const modalHtml = `
    <div id="custom-modal-confirm" style="position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index: 9999; backdrop-filter: blur(2px);">
      <div style="background: #1e1e24; padding: 25px; border-radius: 12px; width: 90%; max-width: 450px; border: 1px solid #444; color: #fff; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h3 style="margin-top:0; color: #ff4d4d; border-bottom: 1px solid #333; padding-bottom: 15px;">${titulo}</h3>
        <div style="margin: 20px 0; font-size: 1rem; line-height: 1.6; text-align: left; color: #ddd;">${htmlMensagem}</div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px;">
          <button id="btn-cancelar-modal" style="padding: 10px 20px; background: transparent; border: 1px solid #555; color: #ccc; border-radius: 6px; cursor: pointer; transition: 0.2s;">Cancelar</button>
          <button id="btn-confirmar-modal" style="padding: 10px 20px; background: #d32f2f; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;">CONFIRMAR AÇÃO</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Estilização interativa dos botões
  const btnCancel = document.getElementById("btn-cancelar-modal");
  const btnConfirm = document.getElementById("btn-confirmar-modal");

  btnCancel.onmouseover = () => (btnCancel.style.borderColor = "#fff");
  btnCancel.onmouseout = () => (btnCancel.style.borderColor = "#555");
  btnCancel.onclick = () =>
    document.getElementById("custom-modal-confirm").remove();

  btnConfirm.onmouseover = () => (btnConfirm.style.background = "#b71c1c");
  btnConfirm.onmouseout = () => (btnConfirm.style.background = "#d32f2f");
  btnConfirm.onclick = () => {
    onConfirmar();
    document.getElementById("custom-modal-confirm").remove();
  };
}

// =========================================================
// 2. INICIALIZAÇÃO
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  const sessao = obterSessao();
  if (!sessao) return;
  if (sessao.tema) document.body.classList.add(sessao.tema);

  if (sessao.isComando && !sessao.org) {
    window.abrirSelecaoPainel();
  } else {
    aplicarRestricoes();
    window.abrirInatividade();
  }
});

window.setPainelComando = function (orgEscolhida) {
  const sessao = obterSessao();
  if (!sessao) return;
  sessao.org = orgEscolhida;
  sessao.tema = { PCERJ: "tema-pcerj", PRF: "tema-prf", PMERJ: "tema-pmerj" }[
    orgEscolhida
  ];
  localStorage.setItem("pc_session", JSON.stringify(sessao));
  window.location.reload();
};

window.abrirSelecaoPainel = function () {
  const modal = document.getElementById("modal-selecao-comando");
  if (modal) modal.style.display = "flex";
};

function aplicarRestricoes() {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;

  atualizarIdentidadeVisual(sessao.org);
  const sidebarTitulo = document.querySelector(".sidebar-header h2");
  if (sidebarTitulo)
    sidebarTitulo.innerText = `POLÍCIA ${
      sessao.org === "PCERJ"
        ? "CIVIL"
        : sessao.org === "PMERJ"
        ? "MILITAR"
        : "RODOVIÁRIA"
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

  const config = permissoes[sessao.org];
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
// 3. GERENCIAMENTO DE TELAS
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
  if (!sessao) return;
  resetarTelas();
  const secao = document.getElementById("secao-inatividade");
  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById("titulo-pagina").innerText = `AUDITORIA - ${
    getOrgLabel(sessao.org).nome
  }`;
};

// =========================================================
// 4. LÓGICA DE INATIVIDADE (CONEXÃO COM BACKEND VERCEL)
// =========================================================
window.carregarInatividade = async function () {
  const sessao = obterSessao();
  if (!sessao) return;

  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");
  const barra = progContainer
    ? progContainer.querySelector(".progress-bar")
    : null;

  if (!corpo) return;

  corpo.innerHTML =
    '<tr><td colspan="6" align="center">🤖 Conectando ao Sistema (Vercel)...</td></tr>';
  if (progContainer) progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  // Animação de progresso
  if (barra) barra.style.width = "5%";
  let width = 5;
  const fakeProgress = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 10;
      if (barra) barra.style.width = width + "%";
    }
  }, 300);

  try {
    // Busca direta na API local da Vercel
    const res = await fetch(
      `${API_BASE}/api/membros-inativos?org=${sessao.org}`
    );

    if (!res.ok) throw new Error(`Erro API: ${res.status}`);

    const dados = await res.json();
    clearInterval(fakeProgress);
    if (barra) barra.style.width = "100%";

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">✅ Nenhum membro inativo encontrado.</td></tr>';
    } else {
      dadosInatividadeGlobal = dados
        .filter((m) => {
          // Tratamento de cargo e proteção
          const cargoAtual =
            m.cargo && m.cargo !== "undefined" ? m.cargo : "Oficial";
          const isProtegido = CARGOS_PROTEGIDOS.some((protegido) =>
            cargoAtual.includes(protegido)
          );

          // Cálculo de dias com fallback para a data base
          const diasInatividade =
            m.dias ||
            Math.floor(
              (Date.now() - (m.lastMsg || DATA_BASE_AUDITORIA)) /
                (1000 * 60 * 60 * 24)
            );

          return diasInatividade >= 7 && !isProtegido;
        })
        .sort((a, b) => (b.dias || 0) - (a.dias || 0));

      corpo.innerHTML = "";
      if (dadosInatividadeGlobal.length === 0) {
        corpo.innerHTML =
          '<tr><td colspan="6" align="center">Todos os oficiais estão ativos! ✅</td></tr>';
      } else {
        dadosInatividadeGlobal.forEach((m) => {
          // Extração Inteligente de Passaporte
          let passaporte = "---";
          if (
            m.passaporte &&
            m.passaporte !== "undefined" &&
            m.passaporte !== "null"
          ) {
            passaporte = m.passaporte;
          } else {
            const texto = m.rpName || m.name || "";
            const match = texto.match(/(\d+)/);
            if (match) passaporte = match[0];
          }

          const cargoExibicao =
            m.cargo && m.cargo !== "undefined" ? m.cargo : "Oficial";
          const dataStr =
            m.lastMsg > 0
              ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
              : "Nunca";

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>
              <div class="user-cell">
                <img src="${
                  m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
                }" class="avatar-img">
                <div><strong>${
                  m.rpName || m.name
                }</strong><br><small style="color: #bbb;">${cargoExibicao}</small></div>
              </div>
            </td>
            <td><code>${passaporte}</code></td>
            <td>${dataStr}</td>
            <td><strong style="color: #ff4d4d">${m.dias || 0} Dias</strong></td>
            <td align="center">
               <div style="display: flex; gap: 8px; justify-content: center;">
                 <span class="badge-danger">⚠️ INATIVO</span>
                 <button onclick="window.prepararExoneracao('${m.id}', '${
            m.rpName || m.name
          }', '${cargoExibicao}', '${passaporte}')" class="btn-exonerar" title="Exonerar e Remover">
                    <i class="fa-solid fa-user-slash"></i>
                 </button>
               </div>
            </td>`;
          corpo.appendChild(tr);
        });
        mostrarAviso(`${dadosInatividadeGlobal.length} inativos carregados.`);
      }
    }
  } catch (err) {
    clearInterval(fakeProgress);
    console.error(err);
    corpo.innerHTML =
      '<tr><td colspan="6" align="center" style="color:#ff4d4d">❌ Erro ao conectar com o Servidor.</td></tr>';
    mostrarAviso("Erro de conexão.", "error");
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1500);
  }
};

// --- PREPARAR E EXECUTAR EXONERAÇÃO (BOT VIA VERCEL API) ---
window.prepararExoneracao = function (discordId, rpName, cargo, passaporte) {
  const nomeLimpo = rpName.replace(/[\d|]/g, "").trim();
  const motivoFixo = "Inatividade superior a 7 dias (Audit System)";

  const htmlMsg = `
        <ul style="list-style: none; padding: 0; margin: 0; text-align: left;">
            <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                👤 <strong>Oficial:</strong> <span style="color: #fff">${nomeLimpo}</span>
            </li>
            <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                🆔 <strong>Passaporte:</strong> <span style="color: #4db8ff">${passaporte}</span>
            </li>
            <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                💼 <strong>Cargo:</strong> <span style="color: #ffd700">${cargo}</span>
            </li>
            <li style="color: #ff4d4d;">
                📜 <strong>Motivo:</strong> ${motivoFixo}
            </li>
        </ul>
        <p style="margin-top: 15px; font-size: 0.9em; color: #ff9999;">
           🚨 <strong>ATENÇÃO:</strong> Esta ação enviará o relatório e <strong>removerá (kick)</strong> o usuário do Discord automaticamente.
        </p>
    `;

  exibirModalConfirmacao("CONFIRMAR EXONERAÇÃO", htmlMsg, () => {
    executarExoneracaoBot(discordId, nomeLimpo, passaporte, cargo, motivoFixo);
  });
};

async function executarExoneracaoBot(
  discordId,
  nome,
  passaporte,
  cargo,
  motivo
) {
  const sessao = obterSessao();
  mostrarAviso("Enviando comando...", "info");

  try {
    // Chama a API local (/api/exonerar.js)
    const res = await fetch(`${API_BASE}/api/exonerar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org: sessao.org,
        discordUser: discordId,
        nomeCidade: nome,
        idPassaporte: passaporte,
        cargo: cargo,
        motivo: motivo,
        action: "kick", // Sinaliza pro backend que deve remover
      }),
    });

    if (res.ok) {
      mostrarAviso("✅ Usuário exonerado e removido com sucesso!");
      window.carregarInatividade();
    } else {
      const erro = await res.json();
      mostrarAviso(`Erro: ${erro.error || "Falha desconhecida"}`, "error");
    }
  } catch (e) {
    mostrarAviso("Erro de conexão.", "error");
  }
}

// =========================================================
// 5. OUTRAS TELAS (FÉRIAS / METAS / ENSINO)
// =========================================================
window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "GESTÃO DE FÉRIAS";
  document.getElementById("botoes-ferias").style.display = "block";
  window.atualizarListaFerias();
};

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const infoBox = document.getElementById("status-ferias-info");
  const sessao = obterSessao();
  if (!select || !infoBox) return;

  select.innerHTML = "<option>🔄 Carregando...</option>";
  try {
    const res = await fetch(
      `${API_BASE}/api/verificar-ferias?org=${sessao.org}`
    );
    const data = await res.json();
    select.innerHTML = '<option value="">Selecione...</option>';

    if (data.oficiais && data.oficiais.length > 0) {
      data.oficiais.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = `${o.nome} (Retorno: ${o.dataRetorno})`;
        select.appendChild(opt);
      });
      infoBox.innerHTML = `✅ ${data.oficiais.length} oficiais em férias.`;
    } else {
      select.innerHTML = '<option value="">Ninguém em férias</option>';
      infoBox.innerHTML = "Nenhum oficial de férias no momento.";
    }
  } catch (e) {
    select.innerHTML = "<option>Erro ao carregar</option>";
    infoBox.innerHTML = "❌ Falha na conexão.";
  }
};

const abrirMetaGen = (idSecao, idBotoes, idNav, titulo, orgReq) => {
  const sessao = obterSessao();
  if (sessao.org !== orgReq)
    return mostrarAviso(`Acesso exclusivo ${orgReq}`, "error");
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
    "METAS CORE",
    "PCERJ"
  );
window.abrirMetaGRR = () =>
  abrirMetaGen("secao-meta-grr", "botoes-grr", "nav-grr", "METAS GRR", "PRF");
window.abrirMetaBOPE = () =>
  abrirMetaGen(
    "secao-meta-bope",
    "botoes-bope",
    "nav-bope",
    "METAS BOPE",
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
