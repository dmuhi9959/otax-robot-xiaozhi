import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const app = express();
app.use(express.json());

const FIREBASE_URL = "https://robot-pintar-7b1a3-default-rtdb.asia-southeast1.firebasedatabase.app/pengetahuan_pribadi.json";

const server = new Server(
  { name: "xiaozhi-personal-brain", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "baca_data_pribadi",
    description: "Gunakan tool ini WAJIB saat user bertanya tentang data pribadi, keluarga, rumah, hewan peliharaan, password, jadwal, atau hal-hal spesifik yang tidak kamu ketahui. Tool ini akan membaca catatan rahasia dari server rumah.",
    inputSchema: {
      type: "object",
      properties: {
        kata_kunci: { type: "string", description: "Kata kunci dari pertanyaan user, misal 'rumah', 'wifi', 'kucing'" }
      },
      required: ["kata_kunci"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "baca_data_pribadi") {
    const keyword = request.params.arguments.kata_kunci.toLowerCase();
    
    try {
      const response = await fetch(FIREBASE_URL);
      const data = await response.json();
      
      let teksUntukXiaozhi = "Berikut adalah data pribadi yang berhasil saya temukan di server:\n\n";
      let ditemukan = false;

      for (let id in data) {
        let item = data[id];
        let gabungan = (item.topik + " " + item.isi).toLowerCase();
        if (gabungan.includes(keyword) || keyword === "semua") {
          teksUntukXiaozhi += `- Topik: ${item.topik}\n  Isi: ${item.isi}\n\n`;
          ditemukan = true;
        }
      }

      if (!ditemukan) {
        teksUntukXiaozhi = "Tidak ada yang cocok persis, tapi ini semua catatan pribadi di server:\n\n";
        for (let id in data) {
           teksUntukXiaozhi += `- ${data[id].topik}: ${data[id].isi}\n`;
        }
      }

      return { content: [{ type: "text", text: teksUntukXiaozhi }] };
    } catch (e) {
      return { content: [{ type: "text", text: "Gagal terhubung ke server rumah." }] };
    }
  }
});

const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => { delete transports[transport.sessionId]; });
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("Session tidak ditemukan");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server MCP Pribadi berjalan di port ${PORT}`);
});
