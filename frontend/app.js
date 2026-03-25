const API = "https://balancetefaroldeitapua.onrender.com";

async function enviar() {
    const file = document.getElementById("file").files[0];

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(API + "/upload", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    const r = data.resultado;

    document.getElementById("score").innerText = r.score;
    document.getElementById("status").innerText = r.status;
    document.getElementById("compras").innerText = r.comprasAltas.length;
    document.getElementById("inconsistencias").innerText = r.inconsistencias.length;

    document.getElementById("detalhes").innerText =
        JSON.stringify(r, null, 2);
}
