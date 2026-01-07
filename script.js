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

// Data base para cálculo (se nunca falou)
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
  if (!aviso) {
    console.log(msg); // Fallback se não houver elemento
    return;
  }

  // Ícones baseados no tipo
  const icon = tipo === "success" ? "✅ " : tipo === "error" ? "❌ " : "⚠️ ";

  aviso.innerHTML = `<strong>${icon}</strong> ${msg}`;
  aviso.className = `aviso-toast ${tipo}`; // Define a cor via CSS
  aviso.style.display = "block";

  // Auto-hide após 4 segundos
  setTimeout(() => {
    aviso.style.display = "none";
  }, 4000);
};

// --- SISTEMA DE MODAL (SUBSTITUI CONFIRM/PROMPT) ---
function exibirModalConfirmacao(titulo, htmlMensagem, onConfirmar) {
  // Remove modal anterior se existir
  const antigo = document.getElementById("custom-modal-confirm");
  if (antigo) antigo.remove();

  const modalHtml = `
    <div id="custom-modal-confirm" style="position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index: 9999;">
      <div style="background: #1e1e24; padding: 25px; border-radius: 8px; width: 90%; max-width: 400px; border: 1px solid #444; color: #fff; text-align: center; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
        <h3 style="margin-top:0; color: #ff4d4d; border-bottom: 1px solid #333; padding-bottom: 10px;">${titulo}</h3>
        <div style="margin: 20px 0; font-size: 1.1em; line-height: 1.5;">${htmlMensagem}</div>
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 25px;">
          <button id="btn-cancelar-modal" style="padding: 10px 20px; background: #444; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
          <button id="btn-confirmar-modal" style="padding: 10px 20px; background: #d32f2f; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">CONFIRMAR</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  document.getElementById("btn-cancelar-modal").onclick = () => {
    document.getElementById("custom-modal-confirm").remove();
  };

  document.getElementById("btn-confirmar-modal").onclick = () => {
    onConfirmar();
    document.getElementById("custom-modal-confirm").remove();
  };
}

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
// 5. LÓGICA DE INATIVIDADE (COM BARRA ANIMADA)
// =========================================================
window.carregarInatividade = async function () {
  const sessao = obterSessao();
  if (!sessao) return;
  const { org } = sessao;

  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");
  const barra = progContainer
    ? progContainer.querySelector(".progress-bar")
    : null;

  if (!corpo) return;

  corpo.innerHTML =
    '<tr><td colspan="6" align="center">🔍 Consultando banco de dados do Discord...</td></tr>';
  if (progContainer) progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  if (barra) barra.style.width = "0%";
  let width = 0;
  // Animação falsa para feedback visual
  const fakeProgress = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 15;
      if (barra) barra.style.width = Math.min(width, 90) + "%";
    }
  }, 250);

  try {
    const res = await fetch(`/api/membros-inativos?org=${org}`);

    // Verifica status HTTP antes de processar
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const dados = await res.json();

    clearInterval(fakeProgress);
    if (barra) barra.style.width = "100%";

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
        return diasInatividade >= 7 && !CARGOS_PROTEGIDOS.includes(m.cargo);
      });

      dadosInatividadeGlobal.sort((a, b) => (b.dias || 0) - (a.dias || 0));
      corpo.innerHTML = "";

      if (dadosInatividadeGlobal.length === 0) {
        corpo.innerHTML =
          '<tr><td colspan="6" align="center">Todos os oficiais estão ativos! ✅</td></tr>';
      } else {
        dadosInatividadeGlobal.forEach((m) => {
          // --- LÓGICA DE EXTRAÇÃO DE PASSAPORTE ---
          // 1. Tenta pegar direto do objeto (se o banco da admissão enviou)
          // 2. Tenta Regex " | 123"
          // 3. Tenta Regex "123" no final
          let passaporte = m.passaporte;
          if (!passaporte) {
            const matchPipe = (m.rpName || "").match(/\|\s*(\d+)/);
            if (matchPipe) passaporte = matchPipe[1];
            else {
              const matchEnd = (m.rpName || "").match(/(\d+)$/);
              passaporte = matchEnd ? matchEnd[1] : "---";
            }
          }

          m.idPassaporteFinal = passaporte; // Salva para uso no botão

          const tr = document.createElement("tr");
          const dataStr =
            m.lastMsg > 0
              ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
              : "Nunca interagiu";

          tr.innerHTML = `
            <td>
              <div class="user-cell">
                <img src="${
                  m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
                }" class="avatar-img">
                <div><strong>${m.name}</strong><br><small>${
            m.cargo || "Oficial"
          }</small></div>
              </div>
            </td>
            <td><code>${m.id}</code></td>
            <td>${dataStr}</td>
            <td><strong style="color: #ff4d4d">${m.dias || 0} Dias</strong></td>
            <td align="center">
              <div style="display: flex; gap: 8px; justify-content: center;">
                <span class="badge-danger">⚠️ INATIVO</span>
                <button onclick="window.prepararExoneracao('${m.id}', '${
            m.rpName || m.name
          }', '${
            m.cargo
          }', '${passaporte}')" class="btn-exonerar" title="Exonerar">
                  <i class="fa-solid fa-user-slash"></i>
                </button>
              </div>
            </td>`;
          corpo.appendChild(tr);
        });
        mostrarAviso(`${dadosInatividadeGlobal.length} inativos encontrados.`);
      }
    }
  } catch (err) {
    clearInterval(fakeProgress);
    console.error(err);
    corpo.innerHTML =
      '<tr><td colspan="6" align="center" style="color: #ff4d4d; font-weight: bold;">❌ Erro de conexão com o Bot. Verifique o console.</td></tr>';
    mostrarAviso(
      "Erro de conexão. Verifique se o Bot está online e as variáveis .env configuradas.",
      "error"
    );
  } finally {
    if (btn) btn.disabled = false;
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1500);
  }
};

// Nova função intermediária para chamar o modal
window.prepararExoneracao = function (discordId, rpName, cargo, passaporte) {
  const nomeLimpo = rpName.split(/[|/]/)[0].trim();
  const motivoFixo = "Inatividade superior a 7 dias";

  const msgHtml = `
      <p>Você está prestes a exonerar:</p>
      <ul style="text-align: left; background: #333; padding: 10px; border-radius: 4px; list-style: none;">
         <li>👤 <strong>Nome:</strong> ${nomeLimpo}</li>
         <li>🆔 <strong>Passaporte:</strong> ${passaporte}</li>
         <li>💼 <strong>Cargo:</strong> ${cargo}</li>
         <li>📜 <strong>Motivo:</strong> ${motivoFixo}</li>
      </ul>
      <p style="font-size: 0.9em; color: #ccc;">Essa ação enviará um relatório para o Discord e removerá o usuário do sistema.</p>
    `;

  exibirModalConfirmacao("CONFIRMAR EXONERAÇÃO", msgHtml, () => {
    executarExoneracao(discordId, nomeLimpo, passaporte, cargo, motivoFixo);
  });
};

async function executarExoneracao(
  discordId,
  nomeLimpo,
  passaporte,
  cargo,
  motivo
) {
  try {
    mostrarAviso("Enviando solicitação...", "info");

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
      mostrarAviso("✅ Exoneração realizada com sucesso!");
      window.carregarInatividade(); // Recarrega a tabela
    } else {
      const erro = await res.json();
      mostrarAviso(`Erro: ${erro.error || "Falha no servidor"}`, "error");
    }
  } catch (e) {
    mostrarAviso("Erro fatal: Não foi possível conectar ao servidor.", "error");
  }
}

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

    if (!response.ok) throw new Error("Falha na API");

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
    infoBox.innerHTML = `<span style="color: #ff4444;">❌ Erro de conexão: Verifique o Bot.</span>`;
  }
};

// Função Genérica para Abrir Metas
const abrirMetaGen = (idSecao, idBotoes, idNav, titulo, orgReq) => {
  const sessao = obterSessao();
  if (!sessao || sessao.org !== orgReq) {
    mostrarAviso(`Acesso negado. Painel exclusivo da ${orgReq}.`, "error");
    return;
  }
  resetarTelas();
  document.getElementById(idSecao).style.display = "block";
  document.getElementById(idSecao).style.visibility = "visible";
  document.getElementById(idBotoes).style.display = "block";
  document.getElementById(idNav).classList.add("active");
  document.getElementById("titulo-pagina").innerText = titulo;
};

// Wrappers Específicos
window.abrirMetaCore = () =>
  abrirMetaGen(
    "secao-meta-core",
    "botoes-core",
    "nav-core",
    "METAS CORE (PCERJ)",
    "PCERJ"
  );
window.abrirMetaGRR = () =>
  abrirMetaGen(
    "secao-meta-grr",
    "botoes-grr",
    "nav-grr",
    "METAS GRR (PRF)",
    "PRF"
  );
window.abrirMetaBOPE = () =>
  abrirMetaGen(
    "secao-meta-bope",
    "botoes-bope",
    "nav-bope",
    "METAS BOPE (PMERJ)",
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
