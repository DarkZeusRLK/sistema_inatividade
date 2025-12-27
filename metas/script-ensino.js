window.carregarRelatorioEnsino = async function () {
  const sessao =
    typeof obterSessao === "function"
      ? obterSessao()
      : JSON.parse(localStorage.getItem("pc_session") || "{}");
  const org = sessao.org;

  const dataIn = document.getElementById("data-inicio-ensino")?.value;
  const dataFi = document.getElementById("data-fim-ensino")?.value;
  const corpo = document.getElementById("corpo-ensino");
  const prog = document.getElementById("progress-container-ensino");
  const btn = document.getElementById("btn-sincronizar-ensino");

  if (!corpo) return console.error("Elemento corpo-ensino não encontrado!");

  corpo.innerHTML = "";
  if (prog) prog.style.display = "block";
  if (btn) btn.disabled = true;

  try {
    // Se a data estiver vazia, passamos string vazia para a API tratar
    const url = `/api/relatorio-ensino?org=${org}&dataInicio=${
      dataIn || ""
    }&dataFim=${dataFi || ""}`;
    const res = await fetch(url);
    const dados = await res.json();

    if (res.status !== 200) throw new Error(dados.error || "Erro na API");

    if (dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="5" align="center" style="padding:20px;">Nenhum instrutor encontrado para esta organização.</td></tr>';
      return;
    }

    dados.sort((a, b) => b.total - a.total);

    dados.forEach((inst) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding: 10px; border-bottom: 1px solid #222;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${
              inst.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
            }" style="width:30px; border-radius:50%;">
            <strong>${inst.name}</strong>
          </div>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #222;"><code>${
          inst.id
        }</code></td>
        <td align="center" style="padding: 10px; border-bottom: 1px solid #222;">${
          inst.cursos
        }</td>
        <td align="center" style="padding: 10px; border-bottom: 1px solid #222;">${
          inst.recs
        }</td>
        <td align="center" style="padding: 10px; border-bottom: 1px solid #222;"><strong>${
          inst.total
        }</strong></td>
      `;
      corpo.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro Ensino:", err);
    corpo.innerHTML = `<tr><td colspan="5" align="center" style="color:red; padding:20px;">${err.message}</td></tr>`;
  } finally {
    if (prog) prog.style.display = "none";
    if (btn) btn.disabled = false;
  }
};
