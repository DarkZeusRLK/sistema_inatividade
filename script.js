window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");

  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO (VASCULHANDO 200 MSGS)...';
  btn.disabled = true;

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    if (!Array.isArray(dados)) throw new Error("Resposta inválida");

    corpo.innerHTML = "";
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00"); // Sua data de início
    const msPorDia = 1000 * 60 * 60 * 24;

    dados.sort((a, b) => a.lastMsg - b.lastMsg);

    dados.forEach((membro) => {
      let dataReferencia;
      let nota = "";

      // Se o bot não achou mensagem nas 200 últimas de cada canal
      if (membro.lastMsg === 0) {
        dataReferencia = dataBaseAuditoria;
        nota =
          '<br><small style="color:#ce9178">Inativo desde o início (08/12)</small>';
      } else {
        dataReferencia = new Date(membro.lastMsg);
      }

      const diffMs = agora - dataReferencia;
      const diasInativo = Math.floor(diffMs / msPorDia);
      const statusExonerar = diasInativo >= 7;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${
                          membro.avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }" class="avatar-img">
                        <div>
                            <strong>${membro.name}</strong>
                            ${nota}
                        </div>
                    </div>
                </td>
                <td><code style="color:#888">${membro.id}</code></td>
                <td>${
                  membro.lastMsg === 0
                    ? "SEM MENSAGENS RECENTES"
                    : dataReferencia.toLocaleDateString("pt-BR")
                }</td>
                <td>
                    <strong style="color: ${
                      statusExonerar ? "#ff4d4d" : "#d4af37"
                    }">
                        ${diasInativo} Dias
                    </strong>
                </td>
                <td align="center">
                    <span class="${
                      statusExonerar ? "badge-danger" : "badge-success"
                    }">
                        ${statusExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}
                    </span>
                </td>
            `;
      corpo.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("Erro ao sincronizar. Tente novamente em alguns segundos.");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
  }
};
document.addEventListener("DOMContentLoaded", function () {
  const sessionStr = localStorage.getItem("pc_session");
  if (sessionStr) {
    const session = JSON.parse(sessionStr);
    // Procure o elemento do nome no seu HTML e atualize
    const nomeElemento = document.getElementById("user-name");
    const avatarElemento = document.getElementById("user-avatar");

    if (nomeElemento) nomeElemento.textContent = session.nome;
    if (avatarElemento) avatarElemento.src = session.avatar;
  }
});
