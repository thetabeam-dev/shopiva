import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { UserRouter } from "./routes/user.js";
import bodyParser from "body-parser";
import BusinessRouter from "./routes/business/shop.js";
import BuyerRouter from "./routes/buyer.js";
import StorefrontRouter from "./routes/storefront.js";
import { swaggerSpec } from "./config/swagger.js";
import { PaystackWebhookController } from "./controllers/webhooks/paystack.js";
import passport from "passport";
import { configurePassport } from "./config/passport.js";
import { OAuthRouter } from "./routes/oauth.js";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "./middleware/auth.js";
import handleSocketConnection from "./services/socket.js";
import { attachSocketServer } from "./services/socketBroadcast.js";
import { Server, type Socket } from "socket.io";
import { db } from "./config/database.js";
import { escrow } from "./services/escrow.js";
import nodeCron from "node-cron";
import { paystack } from "./services/paystack.js";
import { error } from "console";
import { sendFcmForActivities } from "./services/firebaseConfig.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from node project root so it matches Next (same secret regardless of cwd)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

let io;

configurePassport();

const { json, urlencoded } = bodyParser;
const app = express();

// Paystack webhooks require the raw body for HMAC verification (must be before express.json())
// app.post("/webhooks/paystack", express.raw({ type: "application/json" }), PaystackWebhookController);
app.post(
  "/webhooks/paystack",
  express.raw({ type: "application/json" }),
  PaystackWebhookController,
);

// Middleware (must come BEFORE routes)
// Allow frontend origin from env (e.g. CORS_ORIGIN=https://192.168.1.5:3000 or http://localhost:3000)
// const corsOrigins = process.env.CORS_ORIGIN
//   ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
//   : ["http://localhost:3000", "http://127.0.0.1:3000", "http://10.170.100.239:3456"];

// {
//     "type": "skirt",
//     "gender": "female",
//     "variants": [{"id": "variant-0", "stock": 10, "details": [{"label": "Color", "value": "Black"}, {"label": "Size", "value": "M"}]}],
//     "delivery_methods": {"pickup": true, "delivery": true}
// }

// Mobile / RN has no browser Origin; reflect request origin when present. Set CORS_ORIGIN for a strict allowlist.
const corsAllowlist = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : null;
app.use(
  cors({
    origin: corsAllowlist && corsAllowlist.length > 0 ? corsAllowlist : true,
    credentials: true,
  }),
);
app.use(morgan("dev"));
/** Disputes may include several image data URLs (up to ~5MB each client-side). */
app.use(json({ limit: "22mb" }));
app.use(express.urlencoded({ extended: true, limit: "22mb" }));
app.use(passport.initialize());

/** Quick check that the RN app can reach this host (same base URL as API + OAuth). */
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "deedyte-api" });
});

app.get("/config/app-version", (req, res) => {
  const { _v, _os } = req.query;
  console.log(req.query);

  if (_os === "ios") {
    let latestVersion = process.env.IOS_LATEST_VERSION;
    let storeUrl = process.env.IOS_STORE_URL;

    console.log("latestVersion: ", latestVersion === _v);

    if (_v === latestVersion) {
      res.json({
        isLatest: true,
        storeUrl: "",
        os: _os,
      });
    } else {
      res.json({
        isLatest: false,
        storeUrl: storeUrl,
        os: _os,
      });
    }
  } else if (_os === "android") {
    let latestVersion = process.env.ANDROID_LATEST_VERSION;
    let storeUrl = process.env.ANDROID_STORE_URL;

    if (_v?.toString() === latestVersion?.toString()) {
      res.json({
        isLatest: true,
        storeUrl: "",
        os: _os,
      });
    } else {
      res.json({
        isLatest: false,
        storeUrl: storeUrl,
        os: _os,
      });
    }
  }

  // res.json({
  //     ios: {
  //         latestVersion: process.env.IOS_LATEST_VERSION,
  //         minimumVersion: process.env.IOS_MINIMUM_VERSION,
  //         storeUrl: process.env.IOS_STORE_URL,
  //     },
  //     android: {
  //         latestVersion: process.env.ANDROID_LATEST_VERSION,
  //         minimumVersion: process.env.ANDROID_MINIMUM_VERSION,
  //         storeUrl: process.env.ANDROID_STORE_URL,
  //     },
  // });
});

app.get("/categories", async (req, res) => {
  const pool = await db();

  const { rows } = await pool.query(
    // `SELECT * FROM categories WHERE existing_product_count > 0 ORDER BY category ASC`
    `SELECT * FROM categories`,
  );
  res.json(rows);
  console.log("categories: ", rows);
});

// app.get("/logistics-providers", async (req, res) => {
//   const pool = await db();
//   const { rows } = await pool.query(
//     `SELECT id, name, logo_url FROM logistics_providers WHERE is_active = TRUE ORDER BY name ASC`,
//   );
//   res.json(rows);
// });

// Swagger Documentation
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Deedyte API Documentation",
  }),
);

// Swagger JSON endpoint
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});
app.get("/return/:orderId", async (req, res) => {
  const { orderId } = req.params;

  const pool = await db();

  const { rows } = await pool.query(
    "SELECT id FROM returns WHERE order_id = $1",
    [orderId],
  );
  console.log("id:", rows[0]);

  res.json({ ok: true, id: rows[0] });
});

app.post("/update-fcm", async (req, res) => {
  console.log(req.body);

  const { fcm, u_id: user_id } = req.body;
  const pool = await db();
  try {
    const result = await pool.query(
      `UPDATE users SET devicetoken = $1 WHERE id = $2
       RETURNING *`,
      [fcm, user_id],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error inserting notification:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// Routes
app.use("/api/oauth", OAuthRouter);
app.use(UserRouter);
app.use(BusinessRouter);
app.use(BuyerRouter);
app.use(StorefrontRouter);

const server = app.listen(process.env.PORT, () => {
  console.log(`listening to port ${process.env.PORT}`);
  console.log(`Swagger docs at http://localhost:${process.env.PORT}/api-docs`);
  const secretLen = (process.env.JWT_SECRET ?? "")
    .trim()
    .replace(/^"|"$/g, "").length;
  console.log(`JWT_SECRET loaded: ${secretLen > 0 ? "yes" : "NO - fix .env"}`);

  nodeCron.schedule("*/5 * * * * *", async () => {
    const pool = await db();

    const { rows: payouts } = await pool.query(
      `SELECT * FROM shop_payouts WHERE status = $1`,
      ["pending"],
    );

    for (const payout of payouts) {
      try {
        let sid = payout.shop_id;
        let ref = paystack.generateRefId();
        const {
          rows: [shop_payout_accounts],
        } = await pool.query(
          `SELECT * FROM shop_payout_accounts WHERE shop_id = $1`,
          [sid],
        );

        await escrow.update({
          status: "processing",
          id: payout.order_id
        });

        const {status, message} = await (await paystack.initiateTransfer({
          amount: Number((payout.net_amount)),
          recipient: shop_payout_accounts.provider_recipient_id,
          reason: `Deedyte Payout for Order #${payout.order_id}`,
          reference: ref,
        })) as any;

        console.log(status, message);

        if (status && message === "Transfer has been queued") {
          await escrow.finalize({
            status: "queued",
            transfer_reference: ref,
            id: payout.order_id,
          });
        }
      } catch (error) {
        console.log(error);
        await escrow.update({
          status: "failed",
          id: payout.order_id,
        });
      }
    }
  });
});

app.post("/notify", async (req, res) => {
  // const { token, title, body, media, price, product_id } = req.body;
  const { token, data } = req.body;
  const { title, body, media, meta } = data;

  let result = await sendFcmForActivities(token, title, body, media, meta);
  if (result.success) {
    res.send({ status: "Notification sent!", success: true });
  } else {
    console.log(result);
    res.status(500).send({ err: result.error });
  }
});

io = new Server(server, {
  cors: {
    origin: "*", // or your client URL
    methods: ["GET", "POST"],
  },
});
attachSocketServer(io);

type SocketPayload = {
  mssg?: unknown;
  roomId?: unknown;
  date?: unknown;
  senderId?: unknown;
  recipientId?: unknown;
};

type SocketClaims = { id: number; email?: string };

function extractSocketToken(client: any): string | null {
  const authToken = client.handshake?.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim().replace(/^Bearer\s+/i, "");
  }
  const header = client.handshake?.headers?.authorization;
  if (typeof header === "string" && header.trim()) {
    return header.trim().replace(/^Bearer\s+/i, "");
  }
  const queryToken = client.handshake?.query?.token;
  if (typeof queryToken === "string" && queryToken.trim()) {
    return queryToken.trim().replace(/^Bearer\s+/i, "");
  }
  return null;
}

function parseClaims(client: any): SocketClaims | null {
  const token = extractSocketToken(client);
  const secret = getJwtSecret();
  if (!token || !secret) return null;
  try {
    const decoded = jwt.verify(token, secret) as SocketClaims;
    const userId = Number(decoded?.id);
    if (!Number.isFinite(userId)) return null;
    if (typeof decoded?.email === "string" && decoded.email.trim()) {
      return { id: userId, email: decoded.email };
    }
    return { id: userId };
  } catch {
    return null;
  }
}

io.use((client: any, next: (err?: Error) => void) => {
  const claims = parseClaims(client);
  if (!claims) {
    next(new Error("Unauthorized: invalid or missing token"));
    return;
  }
  client.data = client.data ?? {};
  client.data.userId = claims.id;
  client.data.email = claims.email ?? null;
  next();
});

io.on("connection", (client: any) => {
  const authedUserId = Number(client.data?.userId);
  if (!Number.isFinite(authedUserId)) {
    client.disconnect(true);
    return;
  }

  handleSocketConnection(client as Socket & { user: { id: string } });
});

export const getIo = () => {
  if (!io) throw error("Socket is not available now");
  return io;
};
