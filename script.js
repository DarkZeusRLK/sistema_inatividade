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
    '<tr><td colspan="6" align="center">🤖 Conectando ao Sistema (Vercel)...</td></tr>';
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
    const res = await fetch(
      `${API_BASE}/api/membros-inativos.js?org=${sessao.org}`
    );
    if (!res.ok) throw new Error(`Erro API: ${res.status}`);

    const dados = await res.json();
    clearInterval(fakeProgress);
    if (barra) barra.style.width = "100%";

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">✅ Nenhum membro inativo encontrado.</td></tr>';
    } else {
      dadosInatividadeGlobal = dados;
      corpo.innerHTML = "";

      if (dadosInatividadeGlobal.length === 0) {
        corpo.innerHTML =
          '<tr><td colspan="6" align="center">Todos os oficiais estão ativos! ✅</td></tr>';
      } else {
        dadosInatividadeGlobal.forEach((m) => {
          let passaporte = m.passaporte;
          const cargoExibicao = m.cargo || "Oficial";

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>
              <div class="user-cell">
                <img src="${
                  m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
                }" class="avatar-img">
                <div>
                   <strong>${m.name}</strong> 
                   <br><small style="color: #bbb;">${cargoExibicao}</small>
                </div>
              </div>
            </td>
            <td><code>${m.id}</code></td> 
            <td>${
              m.joined_at
                ? new Date(m.joined_at).toLocaleDateString("pt-BR")
                : "---"
            }</td>
            <td><strong style="color: #ff4d4d">${m.dias || 0} Dias</strong></td>
            <td align="center">
               <div style="display: flex; gap: 8px; justify-content: center;">
                 <span class="badge-danger">⚠️ INATIVO</span>
                 <button onclick="window.prepararExoneracao('${m.id}', '${
            m.rpName
          }', '${cargoExibicao}', '${passaporte}')" class="btn-exonerar" title="Exonerar e Remover">
                    <i class="fa-solid fa-user-slash"></i>
                 </button>
               </div>
            </td>`;
          corpo.appendChild(tr);
        });
        mostrarAviso(`${dadosInatividadeGlobal.length} inativos carregados.`);
        const btnMassa = document.getElementById("btn-exonerar-todos");
        if (btnMassa) {
          btnMassa.style.display =
            dadosInatividadeGlobal.length > 0 ? "inline-flex" : "none";
        }
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

// --- PREPARAR E EXECUTAR EXONERAÇÃO ---
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
      mostrarAviso("Sucesso! Oficial exonerado com sucesso.", "success");
      window.carregarInatividade();
    } else {
      const erro = await res.json();
      mostrarAviso(`Erro: ${erro.error || "Falha desconhecida"}`, "error");
    }
  } catch (e) {
    mostrarAviso("Erro de conexão.", "error");
  }
}
window.exonerarTodosInativos = async function () {
  if (!dadosInatividadeGlobal || dadosInatividadeGlobal.length === 0) {
    return mostrarAviso("Nenhum oficial para exonerar.", "error");
  }

  const inativosParaProcessar = dadosInatividadeGlobal.map((m) => ({
    discordUser: m.id,
    nomeCidade: m.name.replace(/[\d|]/g, "").trim(),
    idPassaporte: m.passaporte || "---",
    cargo: m.cargo || "Oficial",
    action: "kick",
  }));

  const msgConfirm = `Você está prestes a exonerar <b>${inativosParaProcessar.length} oficiais</b> por inatividade.<br><br>Deseja continuar?`;

  exibirModalConfirmacao("CONFIRMAR LIMPEZA EM MASSA", msgConfirm, async () => {
    const btnMassa = document.getElementById("btn-exonerar-todos");
    if (btnMassa) btnMassa.disabled = true;
    mostrarAviso("Iniciando processamento em massa...", "info");

    try {
      const res = await fetch(`${API_BASE}/api/exonerar.js`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: inativosParaProcessar, action: "kick" }),
      });

      if (res.ok) {
        mostrarAviso(
          `Sucesso! ${inativosParaProcessar.length} oficiais processados.`,
          "success"
        );
        window.carregarInatividade(); // Recarrega a lista
      } else {
        mostrarAviso("Erro ao processar lista em massa.", "error");
      }
    } catch (e) {
      mostrarAviso("Erro de conexão.", "error");
    } finally {
      if (btnMassa) btnMassa.disabled = false;
    }
  });
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
    return mostrarAviso(`Acesso exclusivo ${orgReq}`, "error");
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
  if (!userId) return mostrarAviso("Selecione um oficial primeiro.", "error");

  const confirmacao = confirm(
    "Tem certeza que deseja remover as férias deste oficial e trazê-lo de volta?"
  );
  if (!confirmacao) return;

  mostrarAviso("Processando retorno...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/verificar-ferias.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId }),
    });

    if (res.ok) {
      mostrarAviso("✅ Oficial retornado com sucesso!");
      setTimeout(() => window.atualizarListaFerias(), 1000);
    } else {
      mostrarAviso("Erro ao processar.", "error");
    }
  } catch (e) {
    console.error(e);
    mostrarAviso("Erro de conexão.", "error");
  }
};
