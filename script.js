window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");

  // Inicia carregamento
  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO...';
  btn.disabled = true;

  try {
    // Puxa os dados da sua API do Vercel
    const res = await fetch("/api/membros-inativos");
    if (!res.ok) throw new Error("Erro na API");
    const membros = await res.json();

    corpo.innerHTML = ""; // Limpa a tabela

    const agora = Date.now();
    const seteDiasMs = 7 * 24 * 60 * 60 * 1000;

    // Ordena para mostrar os mais inativos primeiro
    membros.sort((a, b) => a.lastMsg - b.lastMsg);

    membros.forEach((membro) => {
      const inativoMs = agora - membro.lastMsg;
      const dias = Math.floor(inativoMs / (1000 * 60 * 60 * 24));

      // Lógica: Se nunca mandou mensagem (lastMsg: 0) ou se passou de 7 dias
      const statusExonerar = dias >= 7 || membro.lastMsg === 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${
                          membro.avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }" class="avatar-img">
                        <strong>${membro.name}</strong>
                    </div>
                </td>
                <td><code style="color:var(--gray)">${membro.id}</code></td>
                <td>${
                  membro.lastMsg === 0
                    ? "NUNCA REGISTRADO"
                    : new Date(membro.lastMsg).toLocaleDateString("pt-BR")
                }</td>
                <td><span style="color: ${
                  statusExonerar ? "var(--danger)" : "var(--white)"
                }">${dias} DIAS</span></td>
                <td align="center">
                    <span class="${
                      statusExonerar ? "badge-danger" : "badge-success"
                    }">
                        ${statusExonerar ? "⚠️ EXONERAR" : "✅ ATIVO"}
                    </span>
                </td>
            `;
      corpo.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    corpo.innerHTML = `<tr><td colspan="5" align="center" style="color:var(--danger)">Erro ao carregar dados do Discord. Verifique o .env e o Bot.</td></tr>`;
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
  }
};
