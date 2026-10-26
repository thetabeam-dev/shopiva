import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { UserRouter } from "./routes/user.js";
import { AdminEmailAutomationRouter } from "./routes/adminEmailAutomation.js";
import bodyParser from "body-parser";
import BusinessRouter from "./routes/business/shop.js";
import BuyerRouter from "./routes/buyer.js";
import StorefrontRouter from "./routes/storefront.js";
import { swaggerSpec } from "./config/swagger.js";
import { PaystackWebhookController } from "./controllers/webhooks/paystack.js";
import { WhatsAppWebhookController, WhatsAppWebhookVerificationController } from "./controllers/webhooks/whatsapp.js";
import passport from "passport";
import { configurePassport } from "./config/passport.js";
import { OAuthRouter } from "./routes/oauth.js";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "./middleware/auth.js";
import handleSocketConnection from "./services/socket.js";
import { attachSocketServer } from "./services/socketBroadcast.js";
import { Server, type Socket } from "socket.io";
import { db } from "./config/database.js";
import nodeCron from "node-cron";
import { paystack } from "./services/paystack.js";
import { error } from "console";
import { sendFcmForActivities } from "./services/firebaseConfig.js";
import { createAndEmitNotification } from "./services/notifications.js";
import { GetShopOwnerByShopIdService } from "./services/business/shop.js";
import { sendNotificationEmail } from "./services/email.js";
import paystackTools from "./utils/paystack.js";
import { creditOrderPayoutToWallet, storePaystackVirtualAccount } from "./models/wallet.js";
import { expireUnacceptedOrders, remindVendorsOfUnacceptedOrders } from "./socket/order.js";
import { calculateEscrowFee, policy } from "./utils/escrow.js";
import { recordEscrowRelease } from "./models/escrow.js";
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


app.get("/webhooks/whatsapp", WhatsAppWebhookVerificationController);
app.post(
  "/webhooks/whatsapp",
  express.raw({ type: "application/json" }),
  WhatsAppWebhookController,
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

app.get("/config/shipping-tutorial", (_req, res) => {
  const videoUrl = String(process.env.SHIPPING_TUTORIAL_VIDEO_URL ?? "").trim().replace(/^["']|["']$/g, "");
  res.status(200).json({ videoUrl });
});

app.get("/config/customer-access", (_req, res) => {
  const enabled = String(process.env.CUSTOMER_ACCESS_ENABLED ?? "true").trim().toLowerCase() !== "false";
  const unquote = (value: string | undefined) =>
    String(value ?? "").trim().replace(/^["']|["']$/g, "");
  res.status(200).json({
    enabled,
    title: unquote(process.env.CUSTOMER_ACCESS_TITLE) || "Shopping Is Coming Soon!",
    message: unquote(process.env.CUSTOMER_ACCESS_MESSAGE),
  });
});

app.get("/config/app-version", (req, res) => {
  const { _v, _os } = req.query;
  console.log(req.query);
  if (_os === "ios") {
    let latestVersion = process.env.IOS_LATEST_VERSION;
    let storeUrl = process.env.IOS_STORE_URL;
    let isIosUpdating = process.env.IS_IOS_UPDATING;
    console.log("latestVersion: ", latestVersion === _v);

    if (_v === latestVersion) {
      res.json({
        isLatest: true,
        storeUrl: "",
        os: _os,
        isUpdating: isIosUpdating
      });
    } else {
      res.json({
        isLatest: false,
        storeUrl: storeUrl,
        os: _os,
        isUpdating: isIosUpdating
      });
    }
  } else if (_os === "android") {
    let latestVersion = process.env.ANDROID_LATEST_VERSION;
    let storeUrl = process.env.ANDROID_STORE_URL;
    let isAndroidUpdating = process.env.IS_ANDROID_UPDATING;

    if (_v?.toString() === latestVersion?.toString()) {
      res.json({
        isLatest: true,
        storeUrl: "",
        os: _os,
        isUpdating: isAndroidUpdating
      });
    } else {
      res.json({
        isLatest: false,
        storeUrl: storeUrl,
        os: _os,
        isUpdating: isAndroidUpdating
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

app.get("/escrow-fee", async (req, res) => {
  let {
    subtotal
  } = req.query;

  let escrow_fee = calculateEscrowFee(Number(subtotal) as number, policy);
  res.status(201).send({
    escrow_fee: escrow_fee
  });
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

app.post("/pay", async (_req, res) => {
  const {
    fname,
    lname,
    email,
    phone,
    userId
  } = _req.body;
  console.log(
    fname,
    lname,
    email,
    phone,
    userId
  )
  try {
    const pool = await db();
    const account = await paystackTools.createDVAOnce({
      firstName: fname,
      lastName: lname?.trim() ? lname : fname[0],
      email: email,
      phone: `+234${phone}`,
    });
    await storePaystackVirtualAccount({
      userId: (userId),
      phone: phone,
      customerCode: account.customerCode,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
    });

    // const missing = await pool.query<{
    //   id: number;
    //   fname: string;
    //   lname: string | any;
    //   email: string;
    //   phone: string;
    // }>(
    //   `SELECT u.id, u.fname, u.lname, u.email, u.phone
    //    FROM users u
    //    WHERE u.phone IS NOT NULL
    //      AND btrim(u.phone) <> ''
    //      AND NOT EXISTS (
    //        SELECT 1 FROM wallets w WHERE w.user_id = u.id
    //      )`
    // );

    // const created: number[] = [];
    // const failed: { userId: number; error: string }[] = [];

    // for (const user of missing.rows) {
    //   try {
    //     const account = await paystackTools.createDVAOnce({
    //       firstName: user.fname,
    //       lastName: user.lname?.trim() ? user.lname : user.fname[0],
    //       email: user.email,
    //       phone: `+234${user.phone}`,
    //     });
    //     await storePaystackVirtualAccount({
    //       userId: user.id,
    //       phone: user.phone,
    //       customerCode: account.customerCode,
    //       accountNumber: account.accountNumber,
    //       accountName: account.accountName,
    //       bankName: account.bankName,
    //     });
    //     created.push(user.id);
    //   } catch (error: any) {
    //     const message = error?.response?.data?.message
    //       ?? (error instanceof Error ? error.message : String(error));
    //     console.log(error?.response?.data ?? error);
    //     failed.push({ userId: user.id, error: message });
    //   }
    // }

    // res.json({ created: created.length, userIds: created, failed });
  } catch (error: any) {
    console.log(error?.response?.data ?? error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Routes
app.use("/api/oauth", OAuthRouter);
app.use(UserRouter);
app.use(AdminEmailAutomationRouter);
app.use(BusinessRouter);
app.use(BuyerRouter);
app.use(StorefrontRouter);

function formatNaira(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}



async function notifyShopOfPayout(payout: {
  shop_id: unknown;
  order_id: unknown;
  net_amount: unknown;
}): Promise<void> {
  try {
    const owner = await GetShopOwnerByShopIdService(Number(payout.shop_id));
    const vendorId = Number(owner?.id);
    const orderId = Number(payout.order_id);
    if (!Number.isFinite(vendorId) || vendorId <= 0 || !Number.isFinite(orderId) || orderId <= 0) return;

    const amount = formatNaira(Number(payout.net_amount));
    const title = "Payout Sent";
    const message = `A payout of ${amount} for order #${orderId} has been added to your wallet.`;

    await createAndEmitNotification({
      recipientId: vendorId,
      title,
      message,
      sourceType: "order",
      sourceId: orderId,
      role: "vendor",
    });

    const pool = await db();
    const { rows } = await pool.query<{ devicetoken: string | null; email: string | null; fname: string | null }>(
      `SELECT devicetoken, email, fname FROM users WHERE id = $1`,
      [vendorId],
    );
    const token = String(rows[0]?.devicetoken ?? "").trim();
    if (token) {
      await sendFcmForActivities(token, title, message, null, {
        type: "order",
        order_id: orderId,
        role: "vendor",
      });
    }

    const email = String(rows[0]?.email ?? owner.email ?? "").trim();
    if (email) {
      await sendNotificationEmail(email, {
        fname: String(rows[0]?.fname ?? owner.fname ?? "there"),
        title,
        message,
      });
    }
  } catch (err) {
    console.error("notifyShopOfPayout failed", err);
  }
}

const server = app.listen(process.env.PORT, async () => {
  console.log(`listening to port ${process.env.PORT}`);
  console.log(`Swagger docs at http://localhost:${process.env.PORT}/api-docs`);
  const secretLen = (process.env.JWT_SECRET ?? "")
    .trim()
    .replace(/^"|"$/g, "").length;
  console.log(`JWT_SECRET loaded: ${secretLen > 0 ? "yes" : "NO - fix .env"}`);

  nodeCron.schedule("0 */5 * * * *", async () => {
    const pool = await db();
    const { rows: orders } = await pool.query<{
      id: string;
      shop_id: string;
      total_paid: string;
    }>(
      `SELECT o.id, o.shop_id, o.total_paid
       FROM orders o
       WHERE o.updated_at <= NOW() - INTERVAL '48 hours'
         AND o.fulfillment_status IN ('order_confirmed', 'order_completed')
         AND NOT EXISTS (
           SELECT 1 FROM wallet_transactions t
           WHERE t.reference = 'order:' || o.id::text || ':payout'
         )`,
    );

    for (const order of orders) {
      try {
        const gross = Number(order.total_paid);
        const commission = Number((gross * 0.03).toFixed(2)) + 200;
        const net = Number((gross - commission).toFixed(2));
        const credited = await creditOrderPayoutToWallet({
          shopId: order.shop_id,
          orderId: order.id,
          grossNaira: gross,
          commissionNaira: commission,
          netNaira: net,
        });
        if (credited.credited) {
          await recordEscrowRelease(Number(order.id), Math.round(gross * 100)).catch((err) =>
            console.error("escrow release record failed", err),
          );
        }
        if (credited.credited && credited.userId) {
          getIo().to(`user:${credited.userId}`).emit("wallet_credited", {
            balance_kobo: credited.balance_kobo,
            transactions: credited.transactions,
          });
          await notifyShopOfPayout({
            shop_id: order.shop_id,
            order_id: order.id,
            net_amount: net,
          });
        }
      } catch (error) {
        console.log(error);
      }
    }
  });

  nodeCron.schedule("0 * * * * *", async () => {
    try {
      await remindVendorsOfUnacceptedOrders();
      await expireUnacceptedOrders();
    } catch (error) {
      console.log(error);
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
