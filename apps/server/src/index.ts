import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";

// Servidor-ponte (Camada 2, Espec. §3). Único componente autorizado a
// guardar o token da API Loy e a falar com ela em nome da interface.
const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", apiRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Servidor-ponte ouvindo em http://localhost:${env.PORT}`);
});
