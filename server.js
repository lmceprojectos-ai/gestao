// Servidor de arranque compatível com o "Setup Node.js App" do cPanel (Phusion Passenger).
// O Passenger define a porta em process.env.PORT e espera que este ficheiro
// arranque um servidor HTTP nela — por isso não usamos "next start" diretamente.
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  require("http")
    .createServer((req, res) => handle(req, res))
    .listen(port, () => {
      console.log(`CriaConsensos Gestão a correr na porta ${port}`);
    });
});
