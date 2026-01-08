// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS (VERSÃO VERCEL)
// =========================================================

const API_BASE = ""; // Vercel usa caminho relativo
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

// --- CONFIGURAÇÃO DE ORGS E UNIDADES ---
const getOrgLabel = (org) => {
  const labels = {
    PCERJ: {
      unidade: "CORE",
      nome: "PCERJ",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_Rio_de_Janeiro.png",
    },
    PMERJ: {
      unidade: "BOPE",
      nome: "PMERJ",
      logo: "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    },
    PRF: { unidade: "GRR", nome: "PRF", logo: "Imagens/PRF_new.png" },
    PF: {
      unidade: "COT",
      nome: "POLÍCIA FEDERAL",
      logo: "Imagens/Policia-federal-logo.png",
    },
  };
  return labels[org] || labels["PCERJ"];
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

// --- SISTEMA DE NOTIFICAÇÃO ---
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
          <button id="btn-cancelar-modal" style="padding: 10px 20px; background: transparent; border: 1px solid #555; color: #ccc; border-radius: 6px; cursor: pointer;">Cancelar</button>
          <button id="btn-confirmar-modal" style="padding: 10px 20px; background: #d32f2f; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">CONFIRMAR AÇÃO</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML("beforeend", modalHtml);
  document.getElementById("btn-cancelar-modal").onclick = () =>
    document.getElementById("custom-modal-confirm").remove();
  document.getElementById("btn-confirmar-modal").onclick = () => {
    onConfirmar();
    document.getElementById("custom-modal-confirm").remove();
  };
}

// =========================================================
// 2. INICIALIZAÇÃO E PERMISSÕES
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
  sessao.tema = {
    PCERJ: "tema-pcerj",
    PRF: "tema-prf",
    PMERJ: "tema-pmerj",
    PF: "tema-pf",
  }[orgEscolhida];
  localStorage.setItem("pc_session", JSON.stringify(sessao));
  window.location.reload();
};

window.abrirSelecaoPainel = () => {
  const modal = document.getElementById("modal-selecao-comando");
  if (modal) modal.style.display = "flex";
};

function aplicarRestricoes() {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;
  atualizarIdentidadeVisual(sessao.org);
  const sidebarTitulo = document.querySelector(".sidebar-header h2");
  if (sidebarTitulo) {
    const titulos = {
      PCERJ: "POLÍCIA CIVIL",
      PMERJ: "POLÍCIA MILITAR",
      PRF: "POLÍCIA RODOVIÁRIA",
      PF: "POLÍCIA FEDERAL",
    };
    sidebarTitulo.innerText = titulos[sessao.org] || "AUDITORIA";
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
      ],
      esconder: ["nav-grr", "nav-bope", "nav-cot"],
    },
    PRF: {
      mostrar: ["nav-grr", "nav-ferias", "nav-inatividade", "nav-ensino"],
      esconder: ["nav-core", "nav-bope", "nav-cot", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope", "nav-ferias", "nav-inatividade", "nav-ensino"],
      esconder: ["nav-core", "nav-grr", "nav-cot", "nav-porte", "nav-admin"],
    },
    PF: {
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
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-meta-cot",
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
// 4. LÓGICA DE INATIVIDADE E EXONERAÇÃO
// =========================================================
window.carregarInatividade = async function () {
  const sessao = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");
  const barra = progContainer?.querySelector(".progress-bar");

  if (!corpo) return;
  corpo.innerHTML =
    '<tr><td colspan="6" align="center">🤖 Conectando ao Sistema...</td></tr>';
  if (progContainer) progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(
      `${API_BASE}/api/membros-inativos.js?org=${sessao.org}`
    );
    const dados = await res.json();
    if (barra) barra.style.width = "100%";

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">✅ Nenhum membro inativo encontrado.</td></tr>';
      mostrarBotaoExonerar(0);
    } else {
      dadosInatividadeGlobal = dados;
      corpo.innerHTML = "";
      dados.forEach((m) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><div class="user-cell"><img src="${
            m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
          }" class="avatar-img">
          <div><strong>${m.name}</strong><br><small style="color: #bbb;">${
          m.cargo || "Oficial"
        }</small></div></div></td>
          <td><code class="discord-id-cell">${m.id}</code></td>
          <td>${
            m.joined_at
              ? new Date(m.joined_at).toLocaleDateString("pt-BR")
              : "---"
          }</td>
          <td><strong style="color: #ff4d4d">${m.dias || 0} Dias</strong></td>
          <td align="center"><div style="display: flex; gap: 8px; justify-content: center;">
          <span class="badge-danger">⚠️ INATIVO</span>
          <button onclick="window.prepararExoneracao('${m.id}', '${m.name}', '${
          m.cargo
        }', '${
          m.passaporte || "---"
        }')" class="btn-exonerar"><i class="fa-solid fa-user-slash"></i></button>
          </div></td>`;
        corpo.appendChild(tr);
      });
      mostrarAviso(`${dados.length} inativos carregados.`);
      mostrarBotaoExonerar(dados.length);
    }
  } catch (err) {
    corpo.innerHTML =
      '<tr><td colspan="6" align="center" style="color:#ff4d4d">❌ Erro na conexão.</td></tr>';
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1500);
  }
};

function mostrarBotaoExonerar(quantidade) {
  const btn = document.getElementById("btn-exonerar-todos");
  if (btn) btn.style.display = quantidade > 0 ? "inline-flex" : "none";
}

window.exonerarTodosInativos = async function () {
  const linhas = document.querySelectorAll("#corpo-inatividade tr");
  const inativos = [];

  linhas.forEach((linha) => {
    const btnExonerar = linha.querySelector(".btn-exonerar");
    if (btnExonerar) {
      const colunas = linha.querySelectorAll("td");
      inativos.push({
        discordUser: colunas[1].innerText.trim(),
        nomeCidade: colunas[0].querySelector("strong").innerText.trim(),
        idPassaporte: "---",
        cargo: colunas[0].querySelector("small").innerText.trim(),
        action: "kick",
      });
    }
  });

  if (inativos.length === 0) return alert("Nenhum oficial para exonerar.");

  exibirModalConfirmacao(
    "EXONERAÇÃO EM MASSA",
    `Você está prestes a exonerar <b>${inativos.length} oficiais</b>. Confirmar?`,
    async () => {
      const btnTodos = document.getElementById("btn-exonerar-todos");
      btnTodos.disabled = true;
      btnTodos.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> PROCESSANDO...';

      try {
        const res = await fetch(`${API_BASE}/api/exonerar.js`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ users: inativos, action: "kick" }),
        });
        if (res.ok) {
          mostrarAviso("Exoneração em massa concluída!");
          window.carregarInatividade();
        } else {
          throw new Error();
        }
      } catch (e) {
        mostrarAviso("Erro ao processar massa.", "error");
      } finally {
        btnTodos.disabled = false;
        btnTodos.innerHTML =
          '<i class="fa-solid fa-user-slash"></i> EXONERAR TODOS';
      }
    }
  );
};

window.prepararExoneracao = function (discordId, rpName, cargo, passaporte) {
  const nomeLimpo = rpName.replace(/[\d|]/g, "").trim();
  const htmlMsg = `👤 <b>Oficial:</b> ${nomeLimpo}<br>🆔 <b>ID:</b> ${passaporte}<br>💼 <b>Cargo:</b> ${cargo}`;
  exibirModalConfirmacao("CONFIRMAR EXONERAÇÃO", htmlMsg, () => {
    executarExoneracaoBot(
      discordId,
      nomeLimpo,
      passaporte,
      cargo,
      "Inatividade (Audit)"
    );
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
  mostrarAviso("Processando...", "info");
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
      mostrarAviso("Sucesso!");
      window.carregarInatividade();
    } else {
      mostrarAviso("Erro na API", "error");
    }
  } catch (e) {
    mostrarAviso("Erro de conexão.", "error");
  }
}

// =========================================================
// 5. GESTÃO DE FÉRIAS E METAS
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
      infoBox.innerHTML = "Ninguém em férias.";
    }
  } catch (e) {
    infoBox.innerHTML = "❌ Erro.";
  }
};

window.executarAntecipacao = async function () {
  const userId = document.getElementById("select-oficiais-ferias").value;
  if (!userId || !confirm("Deseja retornar este oficial?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/verificar-ferias.js`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userId }),
    });
    if (res.ok) {
      mostrarAviso("Sucesso!");
      window.atualizarListaFerias();
    }
  } catch (e) {
    mostrarAviso("Erro.", "error");
  }
};

const abrirMetaGen = (idSecao, idBotoes, idNav, titulo, orgReq) => {
  const sessao = obterSessao();
  if (sessao.org !== orgReq)
    return mostrarAviso(`Acesso exclusivo ${orgReq}`, "error");
  resetarTelas();
  const el = document.getElementById(idSecao);
  if (el) {
    el.style.display = "block";
    el.style.visibility = "visible";
  }
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
