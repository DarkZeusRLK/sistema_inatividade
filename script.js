window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");

  // Fallback caso a função mostrarAlerta não esteja acessível
  const dispararAlerta = (titulo, msg, tipo) => {
    if (typeof mostrarAlerta === "function") {
      mostrarAlerta(titulo, msg, tipo);
    } else {
      alert(titulo + ": " + msg);
    }
  };

  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO...';
  btn.disabled = true;

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    if (!Array.isArray(dados)) {
      console.error("Erro na API:", dados);
      dispararAlerta(
        "Atenção",
        dados.error || "A API não retornou uma lista válida.",
        "error"
      );
      return;
    }

    corpo.innerHTML = "";
    const agora = Date.now();

    // Ordena: os mais inativos no topo
    dados.sort((a, b) => a.lastMsg - b.lastMsg);

    dados.forEach((membro) => {
      const inativoMs = agora - membro.lastMsg;
      const dias =
        membro.lastMsg === 0
          ? "∞"
          : Math.floor(inativoMs / (1000 * 60 * 60 * 24));
      const statusExonerar = dias >= 7 || dias === "∞";

      const tr = document.createElement("tr");
      tr.style.borderLeft = statusExonerar
        ? "4px solid #ff4d4d"
        : "4px solid #04d361";

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
                <td><code style="color:#888">${membro.id}</code></td>
                <td>${
                  membro.lastMsg === 0
                    ? "SEM REGISTRO"
                    : new Date(membro.lastMsg).toLocaleDateString("pt-BR")
                }</td>
                <td><span style="color: ${
                  statusExonerar ? "#ff4d4d" : "#fff"
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

    dispararAlerta("Sucesso", "Dados sincronizados com o servidor.", "success");
  } catch (err) {
    console.error(err);
    dispararAlerta("Erro Fatal", "Não foi possível conectar à API.", "error");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
  }
};
