import net from "node:net";

const port = Number(process.env.E2E_PORT ?? 8081);
net.createServer((client) => {
  const upstream = net.connect(port, "host.docker.internal");
  client.pipe(upstream).pipe(client);
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
  client.on("close", () => upstream.destroy());
}).listen(port, "127.0.0.1");
