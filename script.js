window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");

  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO...';
  btn.disabled = true;

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    // --- ADICIONE ESTE BLOCO DE VERIFICAÇÃO ---
    if (!Array.isArray(dados)) {
      // Se não for uma lista, é um erro ou o resultado do teste
      console.error("A API não retornou uma lista. Retornou isso:", dados);

      if (dados.error) {
        mostrarAlerta("Erro na API", dados.error, "error");
      } else if (dados.status) {
        mostrarAlerta(
          "Teste Concluído",
          dados.status + " no servidor: " + dados.servidor,
          "success"
        );
      }
      return; // Para o código aqui para não dar erro no .sort()
    }
    // ------------------------------------------

    corpo.innerHTML = "";
    const agora = Date.now();

    // Agora o .sort() só roda se 'dados' for realmente uma lista
    dados.sort((a, b) => a.lastMsg - b.lastMsg);

    dados.forEach((membro) => {
      const inativoMs = agora - membro.lastMsg;
      const dias = Math.floor(inativoMs / (1000 * 60 * 60 * 24));
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
                <td><code>${membro.id}</code></td>
                <td>${
                  membro.lastMsg === 0
                    ? "NUNCA"
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
    console.error("Erro fatal:", err);
    mostrarAlerta("Erro", "Falha crítica ao carregar dados.", "error");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
  }
};
