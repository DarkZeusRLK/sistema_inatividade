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
  "Comando",
  "Staff",
  "Admin",
];

// Data base para cálculo de segurança
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
  // Verifica expiração simples
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
      <div style="background: #1e1e24; padding: 25px; border-radius: 8px; width: 90%; max-width: 450px; border: 1px solid #444; color: #fff; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <h3 style="margin-top:0; color: #ff4d4d; border-bottom: 1px solid #333; padding-bottom: 15px;">${titulo}</h3>
        <div style="margin: 20px 0; font-size: 1rem; line-height: 1.6; text-align: left; color: #ddd;">${htmlMensagem}</div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 25px;">
          <button id="btn-cancelar-modal" style="padding: 10px 20px; background: transparent; border: 1px solid #555; color: #ccc; border-radius: 4px; cursor: pointer;">Cancelar</button>
          <button id="btn-confirmar-modal" style="padding: 10px 20px; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">CONFIRMAR AÇÃO</button>
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
// 2. FUNÇÕES DE COMANDO E SELEÇÃO
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
// 3. INICIALIZAÇÃO E RESTRIÇÕES
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

  // Definição de visibilidade das abas
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
// 4. GERENCIAMENTO DE TELAS (NAVEGAÇÃO)
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
// 5. LÓGICA DE INATIVIDADE (CARREGAMENTO E WEBHOOK)
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
    '<tr><td colspan="6" align="center">📡 Conectando ao Banco de Dados...</td></tr>';
  if (progContainer) progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  // Animação fake da barra
  if (barra) barra.style.width = "5%";
  let width = 5;
  const fakeProgress = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 10;
      if (barra) barra.style.width = width + "%";
    }
  }, 300);

  try {
    const res = await fetch(`/api/membros-inativos?org=${sessao.org}`);

    if (!res.ok) throw new Error(`Erro API: ${res.status}`);

    const dados = await res.json();
    clearInterval(fakeProgress);
    if (barra) barra.style.width = "100%";

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">✅ Nenhum membro inativo encontrado.</td></tr>';
    } else {
      dadosInatividadeGlobal = dados.filter((m) => {
        // Fallback e proteção de Cargo
        const cargoAtual =
          m.cargo && m.cargo !== "undefined" ? m.cargo : "Oficial";
        const diasInatividade =
          m.dias ||
          Math.floor(
            (Date.now() - (m.lastMsg || DATA_BASE_AUDITORIA)) /
              (1000 * 60 * 60 * 24)
          );

        // Verifica se é cargo protegido
        const isProtegido = CARGOS_PROTEGIDOS.some((protegido) =>
          cargoAtual.includes(protegido)
        );

        return diasInatividade >= 7 && !isProtegido;
      });

      dadosInatividadeGlobal.sort((a, b) => (b.dias || 0) - (a.dias || 0));
      corpo.innerHTML = "";

      if (dadosInatividadeGlobal.length === 0) {
        corpo.innerHTML =
          '<tr><td colspan="6" align="center">Todos os oficiais estão ativos! ✅</td></tr>';
      } else {
        dadosInatividadeGlobal.forEach((m) => {
          // --- LÓGICA DE PASSAPORTE OTIMIZADA (REGEX) ---
          // Tenta pegar do banco, se não, procura QUALQUER número no nome/apelido
          let passaporte = "---";
          if (m.passaporte && m.passaporte !== "undefined") {
            passaporte = m.passaporte;
          } else {
            const texto = m.rpName || m.name || "";
            const match = texto.match(/(\d+)/); // Pega a primeira sequência de números encontrada
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
                <div>
                    <strong>${m.rpName || m.name}</strong><br>
                    <small style="color: #bbb;">${cargoExibicao}</small>
                </div>
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
          }', '${cargoExibicao}', '${passaporte}')" class="btn-exonerar" title="Exonerar">
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
      '<tr><td colspan="6" align="center" style="color:#ff4d4d">❌ Erro ao conectar com a API.</td></tr>';
    mostrarAviso("Erro de conexão.", "error");
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1500);
  }
};

// --- PREPARAR E EXECUTAR EXONERAÇÃO (VIA WEBHOOK) ---
window.prepararExoneracao = function (discordId, rpName, cargo, passaporte) {
  const nomeLimpo = rpName.replace(/[\d|]/g, "").trim(); // Remove números e pipes para o nome ficar limpo
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
        <p style="margin-top: 15px; font-size: 0.9em; color: #888;">
           Essa ação enviará um relatório via Webhook para o Discord.
        </p>
    `;

  exibirModalConfirmacao("CONFIRMAR EXONERAÇÃO", htmlMsg, () => {
    executarExoneracao(discordId, nomeLimpo, passaporte, cargo, motivoFixo);
  });
};

async function executarExoneracao(discordId, nome, passaporte, cargo, motivo) {
  const sessao = obterSessao();
  mostrarAviso("Enviando Webhook...", "info");

  try {
    // Envia para o backend, que vai disparar o Webhook correspondente à ORG
    const res = await fetch("/api/exonerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org: sessao.org, // Importante para saber qual webhook usar
        discordUser: discordId,
        nomeCidade: nome,
        idPassaporte: passaporte,
        cargo: cargo,
        motivo: motivo,
      }),
    });

    if (res.ok) {
      mostrarAviso("✅ Relatório enviado com sucesso!");
      window.carregarInatividade(); // Atualiza a lista
    } else {
      const erro = await res.json();
      mostrarAviso(
        `Erro no envio: ${erro.error || "Falha desconhecida"}`,
        "error"
      );
    }
  } catch (e) {
    mostrarAviso("Erro de conexão com o servidor.", "error");
  }
}

// =========================================================
// 6. OUTRAS TELAS (FÉRIAS / METAS / ENSINO)
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
    const res = await fetch(`/api/verificar-ferias?org=${sessao.org}`);
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

// Funções de Metas Genéricas
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
