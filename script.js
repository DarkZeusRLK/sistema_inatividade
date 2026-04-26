// =========================================================
// 1. CONFIGURACOES GLOBAIS (VERSAO VERCEL)
// =========================================================

const API_BASE = "";

let dadosInatividadeGlobal = [];

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
    PMERJ: {
      unidade: "BOPE",
      nome: "PMERJ",
      logo: "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    },
    PRF: {
      unidade: "GRR",
      nome: "PRF",
      logo: "Imagens/PRF_new.png",
    },
    PF: {
      unidade: "COT",
      nome: "POLICIA FEDERAL",
      logo: "Imagens/Policia-federal-logo.png",
    },
  };
  return labels[org] || labels.PCERJ;
};

function atualizarIdentidadeVisual(org) {
  const info = getOrgLabel(org);
  const logoSidebar = document.getElementById("logo-sidebar");

  if (logoSidebar) {
    logoSidebar.src = info.logo;
    logoSidebar.onerror = () => {
      logoSidebar.src = "Imagens/PRF_new.png";
    };
  }

  let favicon =
    document.querySelector("link[rel~='icon']") ||
    document.createElement("link");
  favicon.rel = "icon";
  favicon.href = info.logo;
  document.getElementsByTagName("head")[0].appendChild(favicon);
}

function formatarDataHora(valor) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function formatarData(valor) {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function obterDadosEmissor(sessao) {
  return {
    nome: sessao?.nome || "Nao identificado",
    id: sessao?.userId || null,
  };
}

window.mostrarAviso = function (msg, tipo = "success") {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) return console.log(`[${tipo}] ${msg}`);

  aviso.className = "";
  aviso.style.display = "none";

  setTimeout(() => {
    const icons = {
      success: "✓",
      error: "✕",
      info: "ℹ",
    };

    aviso.innerHTML = `<strong>${icons[tipo] || icons.success}</strong><span>${msg}</span>`;
    aviso.className = `aviso-toast ${tipo}`;
    aviso.style.display = "flex";
    aviso.style.animation = "slideInRight 0.4s ease-out";

    setTimeout(() => {
      aviso.style.animation = "fadeOut 0.3s ease-in";
      setTimeout(() => {
        aviso.style.display = "none";
      }, 300);
    }, 5000);
  }, 50);
};

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
          <button id="btn-confirmar-modal" style="padding: 10px 20px; background: #d32f2f; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;">CONFIRMAR ACAO</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  document.getElementById("btn-cancelar-modal").onclick = () =>
    document.getElementById("custom-modal-confirm").remove();
  document.getElementById("btn-confirmar-modal").onclick = () => {
    onConfirmar();
    document.getElementById("custom-modal-confirm").remove();
  };
}

// =========================================================
// 2. INICIALIZACAO
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  const sessao = obterSessao();
  if (!sessao) return;
  if (sessao.tema) document.body.classList.add(sessao.tema);

  const overlay = document.getElementById("logs-overlay");
  if (overlay) {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        window.fecharDetalhesLog();
      }
    });
  }

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
  sessao.tema = {
    PCERJ: "tema-pcerj",
    PRF: "tema-prf",
    PMERJ: "tema-pmerj",
    PF: "tema-pf",
  }[orgEscolhida];
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

  if (sidebarTitulo) {
    if (sessao.org === "PCERJ") sidebarTitulo.innerText = "POLICIA CIVIL";
    else if (sessao.org === "PMERJ") sidebarTitulo.innerText = "POLICIA MILITAR";
    else if (sessao.org === "PRF") sidebarTitulo.innerText = "POLICIA RODOVIARIA";
    else if (sessao.org === "PF") sidebarTitulo.innerText = "POLICIA FEDERAL";
  }

  const permissoes = {
    PCERJ: {
      mostrar: [
        "nav-core",
        "nav-porte",
        "nav-admin",
        "nav-ferias",
        "nav-inatividade",
        "nav-ensino",
        "nav-logs",
      ],
      esconder: ["nav-grr", "nav-bope", "nav-cot"],
    },
    PRF: {
      mostrar: [
        "nav-grr",
        "nav-ferias",
        "nav-inatividade",
        "nav-ensino",
        "nav-logs",
      ],
      esconder: ["nav-core", "nav-bope", "nav-cot", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: [
        "nav-bope",
        "nav-ferias",
        "nav-inatividade",
        "nav-ensino",
        "nav-logs",
      ],
      esconder: ["nav-core", "nav-grr", "nav-cot", "nav-porte", "nav-admin"],
    },
    PF: {
      mostrar: [
        "nav-cot",
        "nav-ferias",
        "nav-inatividade",
        "nav-ensino",
        "nav-logs",
      ],
      esconder: ["nav-core", "nav-grr", "nav-bope", "nav-porte", "nav-admin"],
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
    "secao-meta-cot",
    "secao-gestao-ferias",
    "secao-ensino",
    "secao-logs",
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

  const btnMassa = document.getElementById("btn-exonerar-todos");
  if (btnMassa) btnMassa.style.display = "none";
  const btnSelecionados = document.getElementById("btn-exonerar-selecionados");
  if (btnSelecionados) btnSelecionados.style.display = "none";

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

window.abrirLogs = function () {
  resetarTelas();
  const secao = document.getElementById("secao-logs");
  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  document.getElementById("nav-logs").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "LOGS DO SISTEMA";
  window.carregarLogs();
};

window.fecharDetalhesLog = function () {
  const overlay = document.getElementById("logs-overlay");
  if (overlay) overlay.style.display = "none";
};

window.abrirDetalhesLog = function (entryId) {
  const conteudo = document.getElementById("logs-overlay-content");
  const overlay = document.getElementById("logs-overlay");
  const tbody = document.getElementById("corpo-logs");
  if (!conteudo || !overlay || !tbody) return;

  const linhas = Array.from(tbody.querySelectorAll("tr[data-log-id]"));
  const linha = linhas.find((tr) => tr.dataset.logId === entryId);
  if (!linha) return;

  const raw = linha.dataset.exonerados || "[]";
  let exonerados = [];
  try {
    exonerados = JSON.parse(raw);
  } catch (_) {}

  if (!Array.isArray(exonerados) || exonerados.length === 0) {
    conteudo.innerHTML =
      '<p style="color:#aaa; margin:0;">Nenhum oficial exonerado registrado neste relatorio.</p>';
  } else {
    conteudo.innerHTML = `
      <div class="overlay-lista-exonerados">
        ${exonerados
          .map(
            (item) => `
              <div class="overlay-exonerado-item">
                <strong>${escaparHtml(item.nomeCidade || "Nao identificado")}</strong>
                <span>ID Discord: ${escaparHtml(item.discordUser || "-")}</span>
                <span>Passaporte: ${escaparHtml(item.idPassaporte || "-")}</span>
                <span>Cargo: ${escaparHtml(item.cargo || "Oficial")}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  overlay.style.display = "flex";
};

window.carregarLogs = async function () {
  const sessao = obterSessao();
  const corpo = document.getElementById("corpo-logs");
  const filtro = document.getElementById("filtro-tipo-log");
  const cabecalho = document.getElementById("cabecalho-logs");
  if (!sessao || !corpo || !filtro || !cabecalho) return;

  const tipoSelecionado =
    filtro.value === "exoneracao" ? "exoneracao" : "ferias";

  if (tipoSelecionado === "ferias") {
    cabecalho.innerHTML = `
      <tr>
        <th>Solicitante</th>
        <th>Data Início</th>
        <th>Data Fim</th>
        <th>Período Total</th>
        <th>Status</th>
        <th>Registrado Em</th>
      </tr>
    `;
    corpo.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:30px; color:#888;">Carregando logs de férias...</td></tr>';
  } else {
    cabecalho.innerHTML = `
      <tr>
        <th>Emissor</th>
        <th>ID Discord</th>
        <th>Data da Emissão</th>
        <th>Horário</th>
        <th>Exonerados</th>
        <th>Ação</th>
      </tr>
    `;
    corpo.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:30px; color:#888;">Carregando logs de exonerações...</td></tr>';
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/logs.js?org=${encodeURIComponent(
        sessao.org
      )}&type=${encodeURIComponent(tipoSelecionado)}`
    );
    if (!res.ok) throw new Error(`Erro ao carregar logs: ${res.status}`);
    const data = await res.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];

    if (entries.length === 0) {
      corpo.innerHTML =
        `<tr><td colspan="6" style="text-align:center; padding:30px; color:#888;">Nenhum log de ${
          tipoSelecionado === "ferias" ? "férias" : "exonerações"
        } encontrado.</td></tr>`;
      return;
    }

    corpo.innerHTML = "";

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.dataset.logId = entry.id;

      if (tipoSelecionado === "ferias") {
        tr.innerHTML = `
          <td>${escaparHtml(entry.solicitante?.nome || "-")}</td>
          <td>${formatarData(entry.dataInicio)}</td>
          <td>${formatarData(entry.dataFim)}</td>
          <td>${escaparHtml(entry.periodoTotalDias || 0)} dia(s)</td>
          <td><span class="${
            entry.status === "aprovado" ? "badge-success" : "badge-danger"
          }">${escaparHtml((entry.status || "-").toUpperCase())}</span></td>
          <td>${formatarDataHora(entry.createdAt)}</td>
        `;
      } else {
        tr.dataset.exonerados = JSON.stringify(entry.exonerados || []);
        tr.innerHTML = `
          <td>${escaparHtml(entry.emissor?.nome || "-")}</td>
          <td>${escaparHtml(entry.emissor?.id || "-")}</td>
          <td>${formatarData(entry.createdAt)}</td>
          <td>${new Date(entry.createdAt).toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}</td>
          <td>${escaparHtml(entry.quantidadeExonerados || 0)}</td>
          <td><button class="btn-outline-gold btn-log-detalhes" onclick="abrirDetalhesLog('${escaparHtml(
            entry.id
          )}')">VER MAIS</button></td>
        `;
      }

      corpo.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    corpo.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:30px; color:#ff4d4d;">Falha ao carregar os logs.</td></tr>';
  }
};

window.carregarLogs = async function () {
  const sessao = obterSessao();
  const corpo = document.getElementById("corpo-logs");
  const filtro = document.getElementById("filtro-tipo-log");
  const cabecalho = document.getElementById("cabecalho-logs");
  if (!sessao || !corpo || !filtro || !cabecalho) return;

  const tipoSelecionado =
    filtro.value === "exoneracao" ? "exoneracao" : "ferias";

  if (tipoSelecionado === "ferias") {
    cabecalho.innerHTML = `
      <tr>
        <th>Solicitante</th>
        <th>ID do Solicitante</th>
        <th>Data Inicio</th>
        <th>Data Fim</th>
        <th>Motivo</th>
      </tr>
    `;
    corpo.innerHTML =
      '<tr><td colspan="5" style="text-align:center; padding:30px; color:#888;">Carregando logs de ferias...</td></tr>';
  } else {
    cabecalho.innerHTML = `
      <tr>
        <th>Emissor</th>
        <th>ID Discord</th>
        <th>Data da Emissao</th>
        <th>Horario</th>
        <th>Exonerados</th>
        <th>Acao</th>
      </tr>
    `;
    corpo.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:30px; color:#888;">Carregando logs de exoneracoes...</td></tr>';
  }

  try {
    const res = await fetch(
      `${API_BASE}/api/logs.js?org=${encodeURIComponent(
        sessao.org
      )}&type=${encodeURIComponent(tipoSelecionado)}`
    );
    if (!res.ok) throw new Error(`Erro ao carregar logs: ${res.status}`);
    const data = await res.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];

    if (entries.length === 0) {
      corpo.innerHTML =
        `<tr><td colspan="${tipoSelecionado === "ferias" ? "5" : "6"}" style="text-align:center; padding:30px; color:#888;">Nenhum log de ${
          tipoSelecionado === "ferias" ? "ferias" : "exoneracoes"
        } encontrado.</td></tr>`;
      return;
    }

    corpo.innerHTML = "";

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.dataset.logId = entry.id;

      if (tipoSelecionado === "ferias") {
        tr.innerHTML = `
          <td>${escaparHtml(entry.solicitante?.nome || "-")}</td>
          <td>${escaparHtml(entry.solicitante?.id || "-")}</td>
          <td>${formatarData(entry.dataInicio)}</td>
          <td>${formatarData(entry.dataFim)}</td>
          <td>${escaparHtml(entry.motivoSolicitacao || "-")}</td>
        `;
      } else {
        tr.dataset.exonerados = JSON.stringify(entry.exonerados || []);
        tr.innerHTML = `
          <td>${escaparHtml(entry.emissor?.nome || "-")}</td>
          <td>${escaparHtml(entry.emissor?.id || "-")}</td>
          <td>${formatarData(entry.createdAt)}</td>
          <td>${new Date(entry.createdAt).toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}</td>
          <td>${escaparHtml(entry.quantidadeExonerados || 0)}</td>
          <td><button class="btn-outline-gold btn-log-detalhes" onclick="abrirDetalhesLog('${escaparHtml(
            entry.id
          )}')">VER MAIS</button></td>
        `;
      }

      corpo.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    corpo.innerHTML =
      `<tr><td colspan="${tipoSelecionado === "ferias" ? "5" : "6"}" style="text-align:center; padding:30px; color:#ff4d4d;">Falha ao carregar os logs.</td></tr>`;
  }
};

// =========================================================
// 4. LOGICA DE INATIVIDADE
// =========================================================
window.carregarInatividade = async function () {
  const sessao = obterSessao();
  if (!sessao) return;

  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");
  const percentLabel = document.getElementById("progress-percent");
  const statusLabel = document.getElementById("progress-status");

  if (!corpo) return;

  corpo.innerHTML =
    '<tr><td colspan="5" align="center">Conectando ao sistema de auditoria...</td></tr>';
  if (progContainer) progContainer.style.display = "flex";
  if (percentLabel) percentLabel.textContent = "0%";
  if (statusLabel) statusLabel.textContent = "Por favor aguarde.";
  if (btn) btn.disabled = true;

  try {
    let dados = [];
    let cursor = null;
    let finalizou = false;

    for (let lote = 1; lote <= 80; lote++) {
      const res = await fetch(`${API_BASE}/api/membros-inativos.js`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org: sessao.org,
          cursor,
          maxExecMs: 6500,
          maxPagesPerBatch: 16,
        }),
      });
      if (!res.ok) throw new Error(`Erro API: ${res.status}`);

      const payload = await res.json();
      if (Array.isArray(payload)) {
        dados = payload;
        finalizou = true;
        break;
      }

      if (!payload || typeof payload !== "object") {
        throw new Error("Resposta invalida da auditoria.");
      }

      const progresso = payload.progresso || {};
      const totalCanais = Number(progresso.totalCanais || 0);
      const canaisConcluidos = Number(progresso.canaisConcluidos || 0);
      const percentual =
        totalCanais > 0
          ? Math.floor((canaisConcluidos / totalCanais) * 100)
          : Number(progresso.percentualConclusao || 0);

      if (percentLabel) percentLabel.textContent = `${percentual}%`;
      if (statusLabel) {
        statusLabel.textContent = `Por favor aguarde. ${canaisConcluidos}/${totalCanais} canais analisados.`;
      }
      corpo.innerHTML = `<tr><td colspan="5" align="center">Sincronizando registros (${canaisConcluidos}/${totalCanais} canais, lote ${lote})...</td></tr>`;

      if (!payload.partial) {
        dados = Array.isArray(payload.data) ? payload.data : [];
        finalizou = true;
        break;
      }

      cursor = payload.cursor || null;
      if (!cursor) {
        throw new Error("Cursor ausente durante sincronizacao em lotes.");
      }
    }

    if (!finalizou) {
      throw new Error("A sincronizacao excedeu o numero maximo de lotes.");
    }

    if (percentLabel) percentLabel.textContent = "100%";
    if (statusLabel) statusLabel.textContent = "Por favor aguarde.";

    if (!Array.isArray(dados) || dados.length === 0) {
      dadosInatividadeGlobal = [];
      corpo.innerHTML =
        '<tr><td colspan="5" align="center">Auditoria concluida: nenhum oficial identificado como inativo no periodo analisado.</td></tr>';
    } else {
      dadosInatividadeGlobal = dados;
      corpo.innerHTML = "";

      dadosInatividadeGlobal.forEach((m) => {
        const passaporte = m.passaporte;
        const cargoExibicao = m.cargo || "Oficial";
        const tr = document.createElement("tr");
        tr.className = "row-selectable";
        tr.dataset.userId = m.id;
        tr.style.cursor = "pointer";
        tr.innerHTML = `
          <td>
            <div class="user-cell">
              <img src="${
                m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
              }" class="avatar-img">
              <div>
                <strong>${m.name}</strong>
                <br><small style="color: var(--gold); font-size: 0.85rem; font-weight: 500;">${cargoExibicao}</small>
              </div>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <code style="font-size: 0.85rem; user-select: all; cursor: text;" onclick="event.stopPropagation();">${
                m.id
              }</code>
              <button onclick="event.stopPropagation(); copiarIdDiscord('${
                m.id
              }')" class="btn-copiar-id" title="Copiar ID do Discord" style="background: transparent; border: 1px solid #444; color: #d4af37; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; transition: 0.2s;">
                <i class="fa-solid fa-copy"></i>
              </button>
            </div>
          </td>
          <td style="color: #aaa; font-size: 0.9rem;">${
            m.dataUltimaMsg ||
            (m.joined_at
              ? new Date(m.joined_at).toLocaleDateString("pt-BR")
              : "Sem registro")
          }</td>
          <td><strong style="color: #ff4d4d; font-size: 0.95rem;">${
            m.dias || 0
          }</strong></td>
          <td align="center">
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
              <span class="badge-danger">INATIVO</span>
              <button onclick="event.stopPropagation(); window.prepararExoneracao('${
                m.id
              }', '${
          m.rpName
        }', '${cargoExibicao}', '${passaporte}')" class="btn-exonerar" title="Exonerar e Remover">
                <i class="fa-solid fa-user-slash"></i>
              </button>
            </div>
          </td>`;

        tr.addEventListener("click", function (e) {
          if (e.target.closest(".btn-exonerar")) return;
          if (e.target.closest(".btn-copiar-id")) return;
          if (e.target.closest("code")) return;
          tr.classList.toggle("row-selected");
          atualizarContadorSelecionados();
        });

        corpo.appendChild(tr);
      });

      mostrarAviso(
        `Auditoria concluida: ${dadosInatividadeGlobal.length} oficial(is) identificado(s) como inativo(s). Selecione os registros desejados clicando nas respectivas linhas da tabela.`,
        "info"
      );

      const btnMassa = document.getElementById("btn-exonerar-todos");
      if (btnMassa) {
        btnMassa.style.display =
          dadosInatividadeGlobal.length > 0 ? "inline-flex" : "none";
      }
      const btnSelecionados = document.getElementById(
        "btn-exonerar-selecionados"
      );
      if (btnSelecionados) {
        btnSelecionados.style.display =
          dadosInatividadeGlobal.length > 0 ? "inline-flex" : "none";
      }
      atualizarContadorSelecionados();
    }
  } catch (err) {
    console.error(err);
    corpo.innerHTML =
      '<tr><td colspan="5" align="center" style="color:#ff4d4d">Falha na comunicacao com o servidor. Por favor, tente novamente.</td></tr>';
    mostrarAviso(
      "Falha na comunicacao com o servidor. Verifique sua conexao e tente novamente.",
      "error"
    );
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1200);
  }
};

window.prepararExoneracao = function (discordId, rpName, cargo, passaporte) {
  const nomeLimpo = rpName.replace(/[\d|]/g, "").trim();
  const motivoFixo =
    "Inatividade superior a 7 (sete) dias consecutivos - Sistema de Auditoria Automatica";

  const htmlMsg = `
    <ul style="list-style: none; padding: 0; margin: 0; text-align: left;">
      <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
        <strong>Oficial:</strong> <span style="color: #fff">${nomeLimpo}</span>
      </li>
      <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
        <strong>Passaporte:</strong> <span style="color: #4db8ff">${passaporte}</span>
      </li>
      <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
        <strong>ID Discord:</strong> <span style="color: #aaa">${discordId}</span>
      </li>
      <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
        <strong>Cargo:</strong> <span style="color: #ffd700">${cargo}</span>
      </li>
      <li style="color: #ff4d4d;">
        <strong>Motivo:</strong> ${motivoFixo}
      </li>
    </ul>
    <p style="margin-top: 15px; font-size: 0.9em; color: #ff9999;">
      <strong>ATENCAO:</strong> Esta acao ira registrar o processo de exoneracao no sistema e procedera com a remocao automatica do usuario da plataforma Discord. Esta operacao e irreversivel.
    </p>
  `;

  exibirModalConfirmacao(
    "CONFIRMACAO DE EXONERACAO ADMINISTRATIVA",
    htmlMsg,
    async () => {
      mostrarAviso("Processando exoneracao, por favor aguarde.", "info");
      const sessao = obterSessao();
      try {
        const resFerias = await fetch(
          `${API_BASE}/api/ferias.js?org=${sessao.org}`
        );
        if (resFerias.ok) {
          const dataFerias = await resFerias.json();
          const idsEmFerias = new Set(
            (dataFerias.oficiais || []).map((o) => o.id)
          );

          if (idsEmFerias.has(discordId)) {
            return mostrarAviso(
              "Operacao nao autorizada: o oficial encontra-se em periodo de ferias registrado no sistema.",
              "error"
            );
          }

          const estaEmFerias = await verificarPeriodoFerias(discordId, sessao.org);
          if (estaEmFerias) {
            return mostrarAviso(
              "Operacao nao autorizada: o oficial encontra-se em periodo de ferias.",
              "error"
            );
          }
        }
      } catch (e) {
        console.error("Erro ao verificar ferias:", e);
      }

      executarExoneracaoBot(discordId, nomeLimpo, passaporte, cargo, motivoFixo);
    }
  );
};

async function executarExoneracaoBot(
  discordId,
  nome,
  passaporte,
  cargo,
  motivo
) {
  const sessao = obterSessao();
  mostrarAviso("Processando exoneracao, por favor aguarde.", "info");

  try {
    const res = await fetch(`${API_BASE}/api/exonerar.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org: sessao.org,
        emissor: obterDadosEmissor(sessao),
        discordUser: discordId,
        nomeCidade: nome,
        idPassaporte: passaporte,
        cargo,
        motivo,
        action: "kick",
      }),
    });

    if (res.ok) {
      mostrarAviso("Exoneracao realizada com sucesso!", "success");
      window.carregarInatividade();
    } else {
      const erro = await res.json();
      mostrarAviso(
        `Falha no processamento: ${
          erro.error || "Erro nao identificado. Por favor, tente novamente."
        }`,
        "error"
      );
    }
  } catch (e) {
    mostrarAviso(
      "Falha na comunicacao com o servidor. Verifique sua conexao e tente novamente.",
      "error"
    );
  }
}

function copiarIdDiscord(id) {
  navigator.clipboard
    .writeText(id)
    .then(() => {
      mostrarAviso(
        `ID do Discord copiado com sucesso: <code style="background: rgba(212, 175, 55, 0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--gold);">${id}</code>`,
        "success"
      );
    })
    .catch(() => {
      const textArea = document.createElement("textarea");
      textArea.value = id;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        mostrarAviso(
          `ID do Discord copiado com sucesso: <code style="background: rgba(212, 175, 55, 0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--gold);">${id}</code>`,
          "success"
        );
      } catch (_) {
        mostrarAviso(
          "Falha ao copiar ID. Por favor, selecione e copie manualmente.",
          "error"
        );
      }
      document.body.removeChild(textArea);
    });
}

function atualizarContadorSelecionados() {
  const selecionados = document.querySelectorAll(".row-selected");
  const btnSelecionados = document.getElementById("btn-exonerar-selecionados");
  if (!btnSelecionados) return;
  if (selecionados.length > 0) {
    btnSelecionados.innerHTML = `<i class="fa-solid fa-user-check"></i> EXONERAR SELECIONADOS (${selecionados.length})`;
    btnSelecionados.style.display = "inline-flex";
  } else {
    btnSelecionados.innerHTML = `<i class="fa-solid fa-user-check"></i> EXONERAR SELECIONADOS`;
  }
}

window.exonerarSelecionados = async function () {
  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    return mostrarAviso(
      "Nenhum registro de oficial inativo disponivel para processamento de exoneracao.",
      "error"
    );
  }

  const linhasSelecionadas = document.querySelectorAll(".row-selected");
  if (linhasSelecionadas.length === 0) {
    return mostrarAviso(
      "Selecione ao menos um oficial antes de prosseguir.",
      "error"
    );
  }

  const idsSelecionados = Array.from(linhasSelecionadas).map(
    (tr) => tr.dataset.userId
  );
  const inativosSelecionados = dadosInatividadeGlobal.filter((m) =>
    idsSelecionados.includes(m.id)
  );

  const sessao = obterSessao();
  let usuariosComFerias = [];

  try {
    const resFerias = await fetch(
      `${API_BASE}/api/ferias.js?org=${sessao.org}`
    );
    if (resFerias.ok) {
      const dataFerias = await resFerias.json();
      const idsEmFerias = new Set((dataFerias.oficiais || []).map((o) => o.id));

      for (const usuario of inativosSelecionados) {
        if (idsEmFerias.has(usuario.id)) {
          usuariosComFerias.push(usuario.name);
        } else {
          const estaEmFerias = await verificarPeriodoFerias(
            usuario.id,
            sessao.org
          );
          if (estaEmFerias) usuariosComFerias.push(usuario.name);
        }
      }
    }
  } catch (e) {
    console.error("Erro ao verificar ferias:", e);
  }

  if (usuariosComFerias.length > 0) {
    return mostrarAviso(
      `Nao e possivel exonerar os seguintes oficiais pois estao em ferias: ${usuariosComFerias.join(
        ", "
      )}`,
      "error"
    );
  }

  const inativosParaProcessar = inativosSelecionados.map((m) => ({
    discordUser: m.id,
    nomeCidade: (m.rpName || m.name || "").replace(/[\d|]/g, "").trim(),
    idPassaporte: m.passaporte || "---",
    cargo: m.cargo || "Oficial",
    action: "kick",
  }));

  const msgConfirm = `Voce esta prestes a processar a exoneracao administrativa de <b>${inativosParaProcessar.length} oficial(is) selecionado(s)</b> por inatividade superior a 7 dias consecutivos.<br><br>Deseja prosseguir com esta operacao?`;

  exibirModalConfirmacao(
    "CONFIRMACAO DE EXONERACAO SELETIVA",
    msgConfirm,
    async () => {
      const btnSelecionados = document.getElementById(
        "btn-exonerar-selecionados"
      );
      if (btnSelecionados) btnSelecionados.disabled = true;
      mostrarAviso("Processando exoneracao, por favor aguarde.", "info");

      try {
        const resultado = await processarExoneracoesEmLotes(
          inativosParaProcessar,
          sessao
        );

        if (resultado.sucessos > 0) {
          const msgSucesso =
            resultado.erros > 0
              ? `Exoneracao realizada com sucesso! ${resultado.erros} registro(s) apresentaram falha no processamento.`
              : "Exoneracao realizada com sucesso!";
          mostrarAviso(msgSucesso, resultado.erros > 0 ? "error" : "success");
          window.carregarInatividade();
          if (document.getElementById("secao-logs")?.style.display === "block") {
            window.carregarLogs();
          }
        } else {
          mostrarAviso(
            "Nenhum oficial foi processado com sucesso. Verifique os registros e tente novamente.",
            "error"
          );
        }
      } catch (e) {
        mostrarAviso(
          "Falha no processamento das exoneracoes. Por favor, tente novamente.",
          "error"
        );
        console.error(e);
      } finally {
        if (btnSelecionados) btnSelecionados.disabled = false;
      }
    }
  );
};

async function processarExoneracoesEmLotes(usuarios, sessao) {
  const BATCH_SIZE = 10;
  const total = usuarios.length;
  let processados = 0;
  let sucessos = 0;
  let erros = 0;

  mostrarAviso(
    `Processando ${total} registro(s) em lotes de ${BATCH_SIZE} unidade(s)...`,
    "info"
  );

  for (let i = 0; i < usuarios.length; i += BATCH_SIZE) {
    const lote = usuarios.slice(i, i + BATCH_SIZE);
    processados += lote.length;

    try {
      const res = await fetch(`${API_BASE}/api/exonerar.js`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org: sessao.org,
          emissor: obterDadosEmissor(sessao),
          users: lote.map((u) => ({
            discordUser: u.discordUser,
            nomeCidade: u.nomeCidade,
            idPassaporte: u.idPassaporte,
            cargo: u.cargo,
            action: "kick",
          })),
          action: "kick",
        }),
      });

      if (res.ok) {
        sucessos += lote.length;
        mostrarAviso(
          `Processamento em andamento: ${processados}/${total} registro(s) processado(s).`,
          "info"
        );
      } else {
        erros += lote.length;
        const erro = await res
          .json()
          .catch(() => ({ error: "Erro desconhecido" }));
        console.error(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, erro);
      }

      if (i + BATCH_SIZE < usuarios.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (e) {
      erros += lote.length;
      console.error(`Erro de conexao no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, e);
    }
  }

  return { sucessos, erros, total };
}

async function verificarPeriodoFerias(userId, org) {
  try {
    const res = await fetch(
      `${API_BASE}/api/ferias.js?action=periodo&userId=${userId}&org=${org}`
    );
    if (res.ok) {
      const data = await res.json();
      return data.estaEmFerias || false;
    }
  } catch (e) {
    console.error("Erro ao verificar periodo de ferias:", e);
  }
  return false;
}

window.exonerarTodosInativos = async function () {
  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    return mostrarAviso(
      "Nenhum registro de oficial inativo disponivel para processamento de exoneracao em massa.",
      "error"
    );
  }

  const sessao = obterSessao();
  let usuariosComFerias = [];

  try {
    const resFerias = await fetch(
      `${API_BASE}/api/ferias.js?org=${sessao.org}`
    );
    if (resFerias.ok) {
      const dataFerias = await resFerias.json();
      const idsEmFerias = new Set((dataFerias.oficiais || []).map((o) => o.id));

      for (const usuario of dadosInatividadeGlobal) {
        if (idsEmFerias.has(usuario.id)) {
          usuariosComFerias.push(usuario.name);
        } else {
          const estaEmFerias = await verificarPeriodoFerias(
            usuario.id,
            sessao.org
          );
          if (estaEmFerias) usuariosComFerias.push(usuario.name);
        }
      }
    }
  } catch (e) {
    console.error("Erro ao verificar ferias:", e);
  }

  if (usuariosComFerias.length > 0) {
    return mostrarAviso(
      `Operacao nao autorizada: os seguintes oficiais encontram-se em periodo de ferias e nao podem ser exonerados: ${usuariosComFerias.join(
        ", "
      )}`,
      "error"
    );
  }

  const inativosParaProcessar = dadosInatividadeGlobal.map((m) => ({
    discordUser: m.id,
    nomeCidade: (m.rpName || m.name || "").replace(/[\d|]/g, "").trim(),
    idPassaporte: m.passaporte || "---",
    cargo: m.cargo || "Oficial",
    action: "kick",
  }));

  const msgConfirm = `Voce esta prestes a processar a exoneracao administrativa em massa de <b>${inativosParaProcessar.length} oficial(is)</b> por inatividade superior a 7 dias consecutivos.<br><br>Esta operacao processara todos os registros listados. Deseja prosseguir?`;

  exibirModalConfirmacao(
    "CONFIRMACAO DE EXONERACAO EM MASSA",
    msgConfirm,
    async () => {
      const btnMassa = document.getElementById("btn-exonerar-todos");
      if (btnMassa) btnMassa.disabled = true;
      mostrarAviso("Processando exoneracao, por favor aguarde.", "info");

      try {
        const res = await fetch(`${API_BASE}/api/exonerar.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            org: sessao.org,
            emissor: obterDadosEmissor(sessao),
            users: inativosParaProcessar,
            action: "kick",
          }),
        });

        if (res.ok) {
          mostrarAviso("Exoneracao realizada com sucesso!", "success");
          window.carregarInatividade();
          if (document.getElementById("secao-logs")?.style.display === "block") {
            window.carregarLogs();
          }
        } else {
          mostrarAviso(
            "Falha no processamento da lista em massa. Por favor, tente novamente.",
            "error"
          );
        }
      } catch (e) {
        mostrarAviso(
          "Falha na comunicacao com o servidor. Verifique sua conexao e tente novamente.",
          "error"
        );
      } finally {
        if (btnMassa) btnMassa.disabled = false;
      }
    }
  );
};

// =========================================================
// 5. OUTRAS TELAS
// =========================================================
window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "GESTAO DE FERIAS";
  document.getElementById("botoes-ferias").style.display = "block";
  window.atualizarListaFerias();
};

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const infoBox = document.getElementById("status-ferias-info");
  const sessao = obterSessao();
  if (!select || !infoBox || !sessao) return;

  select.innerHTML = "<option>Carregando...</option>";
  infoBox.innerHTML = "Sincronizando solicitacoes de ferias...";
  try {
    const syncRes = await fetch(`${API_BASE}/api/ferias.js`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sincronizar",
        org: sessao.org,
        _ts: Date.now(),
      }),
    });

    if (!syncRes.ok) {
      throw new Error(`Falha ao sincronizar ferias: ${syncRes.status}`);
    }

    const res = await fetch(
      `${API_BASE}/api/ferias.js?org=${sessao.org}&_ts=${Date.now()}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      throw new Error(`Falha ao carregar lista de ferias: ${res.status}`);
    }
    const data = await res.json();
    select.innerHTML = '<option value="">Selecione...</option>';

    if (data.oficiais && data.oficiais.length > 0) {
      data.oficiais.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = `${o.nome} (Retorno: ${o.dataRetorno})`;
        select.appendChild(opt);
      });
      infoBox.innerHTML = `✅ ${data.oficiais.length} oficiais em ferias.`;
    } else {
      select.innerHTML = '<option value="">Ninguem em ferias</option>';
      infoBox.innerHTML = "Nenhum oficial de ferias no momento.";
    }
  } catch (_) {
    select.innerHTML = "<option>Erro ao carregar</option>";
    infoBox.innerHTML = "Falha na conexao.";
  }
};

const abrirMetaGen = (idSecao, idBotoes, idNav, titulo, orgReq) => {
  const sessao = obterSessao();
  if (sessao.org !== orgReq) {
    return mostrarAviso(
      `Acesso restrito: esta funcionalidade e exclusiva para a organizacao ${orgReq}.`,
      "error"
    );
  }
  resetarTelas();
  document.getElementById(idSecao).style.display = "block";
  document.getElementById(idSecao).style.visibility = "visible";
  document.getElementById(idBotoes).style.display = "block";
  document.getElementById(idNav).classList.add("active");
  document.getElementById("titulo-pagina").innerText = titulo;
};

window.abrirMetaCore = () =>
  abrirMetaGen("secao-meta-core", "botoes-core", "nav-core", "METAS CORE", "PCERJ");
window.abrirMetaGRR = () =>
  abrirMetaGen("secao-meta-grr", "botoes-grr", "nav-grr", "METAS GRR", "PRF");
window.abrirMetaBOPE = () =>
  abrirMetaGen("secao-meta-bope", "botoes-bope", "nav-bope", "METAS BOPE", "PMERJ");
window.abrirMetaCOT = () =>
  abrirMetaGen("secao-meta-cot", "botoes-cot", "nav-cot", "METAS COT", "PF");

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

window.executarAntecipacao = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const userId = select.value;
  if (!userId) {
    return mostrarAviso(
      "Selecione um oficial da lista antes de prosseguir.",
      "error"
    );
  }

  const confirmacao = confirm(
    "Deseja realmente remover o registro de ferias deste oficial e proceder com o retorno imediato ao servico ativo?"
  );
  if (!confirmacao) return;

  mostrarAviso("Processando solicitacao de retorno ao servico ativo...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/ferias.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remover", userId }),
    });

    if (res.ok) {
      mostrarAviso(
        "Retorno processado com sucesso: a tag de ferias foi removida.",
        "success"
      );
      setTimeout(() => {
        window.atualizarListaFerias();
        if (document.getElementById("secao-logs")?.style.display === "block") {
          window.carregarLogs();
        }
      }, 1000);
    } else {
      mostrarAviso(
        "Falha no processamento da solicitacao. Por favor, tente novamente.",
        "error"
      );
    }
  } catch (e) {
    console.error(e);
    mostrarAviso(
      "Falha na comunicacao com o servidor. Verifique sua conexao e tente novamente.",
      "error"
    );
  }
};
