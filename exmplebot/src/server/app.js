import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { webhookCallback } from "grammy";
import { env } from "../config/env.js";
import { FAQ_BRAND, buildFaqCategories } from "../data/faq-content.js";
import { checkHealth } from "../lib/health.js";
import { getSubscriptionPricing } from "../services/subscription-pricing.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../../public");

export function createServer(bot) {
  const app = express();

  app.use(express.json());

  app.get("/health", async (_req, res) => {
    const health = await checkHealth();

    if (!health.ok) {
      res.status(503).json({ status: "degraded", checks: health.checks });
      return;
    }

    res.json({ status: "ok", checks: health.checks });
  });

  app.get("/faq/data.json", async (_req, res) => {
    const pricing = await getSubscriptionPricing();

    res.json({
      brand: FAQ_BRAND,
      categories: buildFaqCategories(pricing),
      supportUrl: "https://t.me/PanelOut_Support",
    });
  });

  app.use("/faq", express.static(path.join(publicDir, "faq")));

  app.get("/faq", (_req, res) => {
    res.sendFile(path.join(publicDir, "faq", "index.html"));
  });

  const handleWebhook = webhookCallback(bot, "express", {
    secretToken: env.webhookSecret,
    timeoutMilliseconds: 60_000,
    onTimeout: "return",
  });

  app.post(env.webhookPath, handleWebhook);
  app.get(env.webhookPath, (_req, res) => {
    res.status(200).type("text").send("Telegram webhook (POST only)");
  });

  return app;
}

