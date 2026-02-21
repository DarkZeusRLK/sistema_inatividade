// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS (VERSÃO VERCEL)
// =========================================================

const API_BASE = ""; // Vercel usa caminho relativo

let dadosInatividadeGlobal = [];

// Lista de cargos que o sistema ignora visualmente na tabela (Backup do frontend)
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

// --- CONFIGURAÇÃO DE ORGS E UNIDADES ---
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
      nome: "POLÍCIA FEDERAL",
      logo: "Imagens/Policia-federal-logo.png", // Certifique-se de que a imagem existe
    },
  };
  return labels[org] || labels["PCERJ"];
};

function atualizarIdentidadeVisual(org) {
  const info = getOrgLabel(org);
  const logoSidebar = document.getElementById("logo-sidebar");

  if (logoSidebar) {
    logoSidebar.src = info.logo;
    // Fallback se a imagem da PF não existir
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

// --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---
window.mostrarAviso = function (msg, tipo = "success") {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) return console.log(`[${tipo}] ${msg}`);

  // Remover qualquer aviso anterior
  aviso.className = "";
  aviso.style.display = "none";

  // Pequeno delay para garantir que a animação funcione
  setTimeout(() => {
    // Ícones melhorados
    const icons = {
      success: "✓",
      error: "✕",
      info: "ℹ",
    };

    const icon = icons[tipo] || icons.success;

    // Renderizar HTML corretamente
    aviso.innerHTML = `<strong>${icon}</strong><span>${msg}</span>`;
    aviso.className = `aviso-toast ${tipo}`;
    aviso.style.display = "flex";
    aviso.style.animation = "slideInRight 0.4s ease-out";

    // Auto-remover após 5 segundos com animação
    setTimeout(() => {
      aviso.style.animation = "fadeOut 0.3s ease-in";
      setTimeout(() => {
        aviso.style.display = "none";
      }, 300);
    }, 5000);
  }, 50);
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
  const btnCancel = document.getElementById("btn-cancelar-modal");
  const btnConfirm = document.getElementById("btn-confirmar-modal");

  btnCancel.onclick = () =>
    document.getElementById("custom-modal-confirm").remove();
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

  // Definição de Temas (Incluindo PF)
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

// --- CONTROLE DE PERMISSÕES POR ORG ---
function aplicarRestricoes() {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;

  atualizarIdentidadeVisual(sessao.org);
  const sidebarTitulo = document.querySelector(".sidebar-header h2");

  // Ajuste do título da Sidebar
  if (sidebarTitulo) {
    if (sessao.org === "PCERJ") sidebarTitulo.innerText = "POLÍCIA CIVIL";
    else if (sessao.org === "PMERJ")
      sidebarTitulo.innerText = "POLÍCIA MILITAR";
    else if (sessao.org === "PRF")
      sidebarTitulo.innerText = "POLÍCIA RODOVIÁRIA";
    else if (sessao.org === "PF") sidebarTitulo.innerText = "POLÍCIA FEDERAL";
  }

  // --- REGRAS DE VISIBILIDADE ---
  const permissoes = {
    PCERJ: {
      // Vê: CORE, Porte, Admin, Férias, Inatividade, Ensino
      mostrar: [
        "nav-core",
        "nav-porte",
        "nav-admin",
        "nav-ferias",
        "nav-inatividade",
        "nav-ensino",
      ],
      esconder: ["nav-grr", "nav-bope", "nav-cot"],
    },
    PRF: {
      // Vê: GRR, Férias, Inatividade, Ensino
      mostrar: ["nav-grr", "nav-ferias", "nav-inatividade", "nav-ensino"],
      esconder: ["nav-core", "nav-bope", "nav-cot", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      // Vê: BOPE, Férias, Inatividade, Ensino
      mostrar: ["nav-bope", "nav-ferias", "nav-inatividade", "nav-ensino"],
      esconder: ["nav-core", "nav-grr", "nav-cot", "nav-porte", "nav-admin"],
    },
    PF: {
      // Vê: COT, Férias, Inatividade, Ensino
      mostrar: ["nav-cot", "nav-ferias", "nav-inatividade", "nav-ensino"],
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
    "secao-meta-core", // PCERJ
    "secao-meta-grr", // PRF
    "secao-meta-bope", // PMERJ
    "secao-meta-cot", // PF
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

// =========================================================
// 4. LÓGICA DE INATIVIDADE
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
    '<tr><td colspan="5" align="center">🔄 Conectando ao sistema de auditoria...</td></tr>';
  if (progContainer) progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  if (barra) barra.style.width = "5%";
  let width = 5;
  const fakeProgress = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 10;
      if (barra) barra.style.width = width + "%";
    }
  }, 300);

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
      const percentual = Number(progresso.percentualConclusao || 0);

      if (barra) {
        width = Math.max(width, Math.min(95, percentual));
        barra.style.width = `${width}%`;
      }
      corpo.innerHTML = `<tr><td colspan="5" align="center">🔄 Sincronizando registros (${canaisConcluidos}/${totalCanais} canais, lote ${lote})...</td></tr>`;

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

    clearInterval(fakeProgress);
    if (barra) barra.style.width = "100%";

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="5" align="center">✅ Auditoria concluída: Nenhum oficial identificado como inativo no período analisado.</td></tr>';
    } else {
      dadosInatividadeGlobal = dados;
      corpo.innerHTML = "";

      if (dadosInatividadeGlobal.length === 0) {
        corpo.innerHTML =
          '<tr><td colspan="5" align="center">✅ Status: Todos os oficiais encontram-se em situação de atividade regular no sistema.</td></tr>';
      } else {
        dadosInatividadeGlobal.forEach((m) => {
          let passaporte = m.passaporte;
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
                 <span class="badge-danger">⚠️ INATIVO</span>
                 <button onclick="event.stopPropagation(); window.prepararExoneracao('${
                   m.id
                 }', '${
            m.rpName
          }', '${cargoExibicao}', '${passaporte}')" class="btn-exonerar" title="Exonerar e Remover">
                    <i class="fa-solid fa-user-slash"></i>
                 </button>
               </div>
            </td>`;

          // Adicionar evento de clique para selecionar/desselecionar
          tr.addEventListener("click", function (e) {
            // Não selecionar se clicou no botão ou no ID
            if (e.target.closest(".btn-exonerar")) return;
            if (e.target.closest(".btn-copiar-id")) return;
            if (e.target.closest("code")) return;

            tr.classList.toggle("row-selected");
            atualizarContadorSelecionados();
          });

          corpo.appendChild(tr);
        });
        mostrarAviso(
          `Auditoria concluída: ${dadosInatividadeGlobal.length} oficial(is) identificado(s) como inativo(s). Selecione os registros desejados clicando nas respectivas linhas da tabela.`,
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
    }
  } catch (err) {
    clearInterval(fakeProgress);
    console.error(err);
    corpo.innerHTML =
      '<tr><td colspan="5" align="center" style="color:#ff4d4d">❌ Falha na comunicação com o servidor. Por favor, tente novamente.</td></tr>';
    mostrarAviso(
      "Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.",
      "error"
    );
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1500);
  }
};

// --- PREPARAR E EXECUTAR EXONERAÇÃO ---
window.prepararExoneracao = function (discordId, rpName, cargo, passaporte) {
  const nomeLimpo = rpName.replace(/[\d|]/g, "").trim();
  const motivoFixo =
    "Inatividade superior a 7 (sete) dias consecutivos - Sistema de Auditoria Automática";

  const htmlMsg = `
        <ul style="list-style: none; padding: 0; margin: 0; text-align: left;">
            <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                👤 <strong>Oficial:</strong> <span style="color: #fff">${nomeLimpo}</span>
            </li>
            <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                🆔 <strong>Passaporte:</strong> <span style="color: #4db8ff">${passaporte}</span>
            </li>
            <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                🆔 <strong>ID Discord:</strong> <span style="color: #aaa">${discordId}</span>
            </li>
            <li style="margin-bottom: 8px; border-bottom: 1px solid #333; padding-bottom: 5px;">
                💼 <strong>Cargo:</strong> <span style="color: #ffd700">${cargo}</span>
            </li>
            <li style="color: #ff4d4d;">
                📜 <strong>Motivo:</strong> ${motivoFixo}
            </li>
        </ul>
        <p style="margin-top: 15px; font-size: 0.9em; color: #ff9999;">
           🚨 <strong>ATENÇÃO:</strong> Esta ação irá registrar o processo de exoneração no sistema e procederá com a remoção automática do usuário da plataforma Discord. Esta operação é irreversível.
        </p>
    `;

  exibirModalConfirmacao(
    "CONFIRMAÇÃO DE EXONERAÇÃO ADMINISTRATIVA",
    htmlMsg,
    async () => {
      mostrarAviso("Processando exoneração, por favor aguarde.", "info");
      // Verificar se está em férias antes de exonerar
      const sessao = obterSessao();
      try {
        const resFerias = await fetch(
          `${API_BASE}/api/verificar-ferias.js?org=${sessao.org}`
        );
        if (resFerias.ok) {
          const dataFerias = await resFerias.json();
          const idsEmFerias = new Set(
            (dataFerias.oficiais || []).map((o) => o.id)
          );

          if (idsEmFerias.has(discordId)) {
            return mostrarAviso(
              "Operação não autorizada: O oficial encontra-se em período de férias registrado no sistema. A exoneração não pode ser processada neste momento.",
              "error"
            );
          }

          // Verificar se está no período de férias mesmo sem tag
          const estaEmFerias = await verificarPeriodoFerias(
            discordId,
            sessao.org
          );
          if (estaEmFerias) {
            return mostrarAviso(
              "Operação não autorizada: O oficial encontra-se em período de férias. A exoneração não pode ser processada durante este período.",
              "error"
            );
          }
        }
      } catch (e) {
        console.error("Erro ao verificar férias:", e);
      }

      executarExoneracaoBot(
        discordId,
        nomeLimpo,
        passaporte,
        cargo,
        motivoFixo
      );
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
  mostrarAviso("Processando exoneração, por favor aguarde.", "info");

  try {
    const res = await fetch(`${API_BASE}/api/exonerar.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org: sessao.org,
        discordUser: discordId,
        nomeCidade: nome,
        idPassaporte: passaporte,
        cargo: cargo,
        motivo: motivo,
        action: "kick",
      }),
    });

    if (res.ok) {
      mostrarAviso("Exoneração realizada com sucesso!", "success");
      window.carregarInatividade();
    } else {
      const erro = await res.json();
      mostrarAviso(
        `Falha no processamento: ${
          erro.error || "Erro não identificado. Por favor, tente novamente."
        }`,
        "error"
      );
    }
  } catch (e) {
    mostrarAviso(
      "Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.",
      "error"
    );
  }
}
// Função para copiar ID do Discord para a área de transferência
function copiarIdDiscord(id) {
  navigator.clipboard
    .writeText(id)
    .then(() => {
      mostrarAviso(
        `ID do Discord copiado com sucesso: <code style="background: rgba(212, 175, 55, 0.2); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--gold);">${id}</code>`,
        "success"
      );
    })
    .catch((err) => {
      // Fallback para navegadores mais antigos
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
      } catch (e) {
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
  if (btnSelecionados) {
    if (selecionados.length > 0) {
      btnSelecionados.innerHTML = `<i class="fa-solid fa-user-check"></i> EXONERAR SELECIONADOS (${selecionados.length})`;
      btnSelecionados.style.display = "inline-flex";
    } else {
      btnSelecionados.innerHTML = `<i class="fa-solid fa-user-check"></i> EXONERAR SELECIONADOS`;
    }
  }
}

window.exonerarSelecionados = async function () {
  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    return mostrarAviso(
      "Nenhum registro de oficial inativo disponível para processamento de exoneração.",
      "error"
    );
  }

  const linhasSelecionadas = document.querySelectorAll(".row-selected");
  if (linhasSelecionadas.length === 0) {
    return mostrarAviso(
      "Seleção obrigatória: Por favor, selecione ao menos um oficial clicando na respectiva linha da tabela antes de prosseguir.",
      "error"
    );
  }

  const idsSelecionados = Array.from(linhasSelecionadas).map(
    (tr) => tr.dataset.userId
  );
  const inativosSelecionados = dadosInatividadeGlobal.filter((m) =>
    idsSelecionados.includes(m.id)
  );

  // Verificar férias antes de exonerar
  const sessao = obterSessao();
  let usuariosComFerias = [];

  try {
    const resFerias = await fetch(
      `${API_BASE}/api/verificar-ferias.js?org=${sessao.org}`
    );
    if (resFerias.ok) {
      const dataFerias = await resFerias.json();
      const idsEmFerias = new Set((dataFerias.oficiais || []).map((o) => o.id));

      // Verificar também se estão no período de férias (mesmo sem tag)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Buscar informações detalhadas de férias para verificar período
      for (const usuario of inativosSelecionados) {
        if (idsEmFerias.has(usuario.id)) {
          usuariosComFerias.push(usuario.name);
        } else {
          // Verificar se está no período de férias mesmo sem tag
          const estaEmFerias = await verificarPeriodoFerias(
            usuario.id,
            sessao.org
          );
          if (estaEmFerias) {
            usuariosComFerias.push(usuario.name);
          }
        }
      }
    }
  } catch (e) {
    console.error("Erro ao verificar férias:", e);
  }

  if (usuariosComFerias.length > 0) {
    return mostrarAviso(
      `Não é possível exonerar os seguintes oficiais pois estão em férias: ${usuariosComFerias.join(
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

  const msgConfirm = `Você está prestes a processar a exoneração administrativa de <b>${inativosParaProcessar.length} oficial(is) selecionado(s)</b> por inatividade superior a 7 (sete) dias consecutivos.<br><br>Deseja prosseguir com esta operação?`;

  exibirModalConfirmacao(
    "CONFIRMAÇÃO DE EXONERAÇÃO SELETIVA",
    msgConfirm,
    async () => {
      const btnSelecionados = document.getElementById(
        "btn-exonerar-selecionados"
      );
      if (btnSelecionados) btnSelecionados.disabled = true;
      mostrarAviso("Processando exoneração, por favor aguarde.", "info");

      try {
        const resultado = await processarExoneracoesEmLotes(
          inativosParaProcessar,
          sessao
        );

        if (resultado.sucessos > 0) {
          const msgSucesso =
            resultado.erros > 0
              ? `Exoneração realizada com sucesso! ${resultado.erros} registro(s) apresentaram falha no processamento.`
              : "Exoneração realizada com sucesso!";
          mostrarAviso(msgSucesso, resultado.erros > 0 ? "error" : "success");
          window.carregarInatividade(); // Recarrega a lista
        } else {
          mostrarAviso(
            "Nenhum oficial foi processado com sucesso. Verifique os registros e tente novamente.",
            "error"
          );
        }
      } catch (e) {
        mostrarAviso(
          "Falha no processamento das exonerações. Por favor, tente novamente.",
          "error"
        );
        console.error(e);
      } finally {
        if (btnSelecionados) btnSelecionados.disabled = false;
      }
    }
  );
};

// Função para processar exonerações em lotes de 10
async function processarExoneracoesEmLotes(usuarios, sessao) {
  const BATCH_SIZE = 10;
  const total = usuarios.length;
  let processados = 0;
  let sucessos = 0;
  let erros = 0;

  mostrarAviso(
    `Processando ${total} registro(s) em lotes de ${BATCH_SIZE} unidade(s) para otimização do sistema...`,
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
          `Processamento em andamento: ${processados}/${total} registro(s) processado(s) - ${sucessos} sucesso(s) confirmado(s)`,
          "info"
        );
      } else {
        erros += lote.length;
        const erro = await res
          .json()
          .catch(() => ({ error: "Erro desconhecido" }));
        console.error(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, erro);
      }

      // Pequeno delay entre lotes para não sobrecarregar a API
      if (i + BATCH_SIZE < usuarios.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (e) {
      erros += lote.length;
      console.error(
        `Erro de conexão no lote ${Math.floor(i / BATCH_SIZE) + 1}:`,
        e
      );
    }
  }

  return { sucessos, erros, total };
}

async function verificarPeriodoFerias(userId, org) {
  try {
    const res = await fetch(
      `${API_BASE}/api/verificar-ferias-periodo.js?userId=${userId}&org=${org}`
    );
    if (res.ok) {
      const data = await res.json();
      return data.estaEmFerias || false;
    }
  } catch (e) {
    console.error("Erro ao verificar período de férias:", e);
  }
  return false;
}

window.exonerarTodosInativos = async function () {
  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    return mostrarAviso(
      "Nenhum registro de oficial inativo disponível para processamento de exoneração em massa.",
      "error"
    );
  }

  // Verificar férias antes de exonerar
  const sessao = obterSessao();
  let usuariosComFerias = [];

  try {
    const resFerias = await fetch(
      `${API_BASE}/api/verificar-ferias.js?org=${sessao.org}`
    );
    if (resFerias.ok) {
      const dataFerias = await resFerias.json();
      const idsEmFerias = new Set((dataFerias.oficiais || []).map((o) => o.id));

      // Verificar também se estão no período de férias (mesmo sem tag)
      for (const usuario of dadosInatividadeGlobal) {
        if (idsEmFerias.has(usuario.id)) {
          usuariosComFerias.push(usuario.name);
        } else {
          // Verificar se está no período de férias mesmo sem tag
          const estaEmFerias = await verificarPeriodoFerias(
            usuario.id,
            sessao.org
          );
          if (estaEmFerias) {
            usuariosComFerias.push(usuario.name);
          }
        }
      }
    }
  } catch (e) {
    console.error("Erro ao verificar férias:", e);
  }

  if (usuariosComFerias.length > 0) {
    return mostrarAviso(
      `Operação não autorizada: Os seguintes oficiais encontram-se em período de férias e não podem ser exonerados: ${usuariosComFerias.join(
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

  const msgConfirm = `Você está prestes a processar a exoneração administrativa em massa de <b>${inativosParaProcessar.length} oficial(is)</b> por inatividade superior a 7 (sete) dias consecutivos.<br><br>Esta operação processará todos os registros listados. Deseja prosseguir?`;

  exibirModalConfirmacao(
    "CONFIRMAÇÃO DE EXONERAÇÃO EM MASSA",
    msgConfirm,
    async () => {
      const btnMassa = document.getElementById("btn-exonerar-todos");
      if (btnMassa) btnMassa.disabled = true;
      mostrarAviso("Processando exoneração, por favor aguarde.", "info");

      try {
        const res = await fetch(`${API_BASE}/api/exonerar.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            users: inativosParaProcessar,
            action: "kick",
          }),
        });

        if (res.ok) {
          mostrarAviso("Exoneração realizada com sucesso!", "success");
          window.carregarInatividade(); // Recarrega a lista
        } else {
          mostrarAviso(
            "Falha no processamento da lista em massa. Por favor, tente novamente.",
            "error"
          );
        }
      } catch (e) {
        mostrarAviso(
          "Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.",
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
      `${API_BASE}/api/verificar-ferias.js?org=${sessao.org}`
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
    return mostrarAviso(
      `Acesso restrito: Esta funcionalidade é exclusiva para a organização ${orgReq}.`,
      "error"
    );
  resetarTelas();
  document.getElementById(idSecao).style.display = "block";
  document.getElementById(idSecao).style.visibility = "visible";
  document.getElementById(idBotoes).style.display = "block";
  document.getElementById(idNav).classList.add("active");
  document.getElementById("titulo-pagina").innerText = titulo;
};

// --- ROTAS DAS UNIDADES ESPECIAIS ---
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

// ADIÇÃO: Rota do COT para a PF
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
  // O nav-ensino agora fica ativo para todas as orgs
  document.getElementById("nav-ensino")?.classList.add("active");
  document.getElementById("titulo-pagina").innerText = "SISTEMA DE ENSINO";
};

window.executarAntecipacao = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const userId = select.value;
  if (!userId)
    return mostrarAviso(
      "Seleção obrigatória: Por favor, selecione um oficial da lista antes de prosseguir.",
      "error"
    );

  const confirmacao = confirm(
    "Confirmação necessária: Deseja realmente remover o registro de férias deste oficial e proceder com o retorno imediato ao serviço ativo?"
  );
  if (!confirmacao) return;

  mostrarAviso(
    "Processando solicitação de retorno ao serviço ativo...",
    "info"
  );
  try {
    const res = await fetch(`${API_BASE}/api/verificar-ferias.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId }),
    });

    if (res.ok) {
      mostrarAviso(
        "Retorno processado com sucesso: O oficial foi reintegrado ao serviço ativo e a tag de férias foi removida.",
        "success"
      );
      setTimeout(() => window.atualizarListaFerias(), 1000);
    } else {
      mostrarAviso(
        "Falha no processamento da solicitação. Por favor, tente novamente.",
        "error"
      );
    }
  } catch (e) {
    console.error(e);
    mostrarAviso(
      "Falha na comunicação com o servidor. Verifique sua conexão e tente novamente.",
      "error"
    );
  }
};
