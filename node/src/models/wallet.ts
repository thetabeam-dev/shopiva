import crypto from "crypto";
import { db } from "../config/database.js";

export type PaystackVirtualAccount = {
  phone: number | string,
  userId: number;
  customerCode: string;
  accountNumber: string;
  accountName?: string | null;
  bankName?: string | null;
};

/** Creates the user's NGN wallet if needed, then stores the Paystack dedicated account. */
export async function storePaystackVirtualAccount(account: PaystackVirtualAccount) {
  const userId = Number(account.userId);
  const phone = Number(account.phone);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("A valid user id is required to store a virtual account.");
  }
  const customerCode = String(account.customerCode ?? "").trim();
  const accountNumber = String(account.accountNumber ?? "").trim();
  if (!customerCode || !accountNumber) {
    throw new Error("Paystack customer code and account number are required.");
  }

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wallet = await client.query<{ id: string }>(
      `INSERT INTO wallets (user_id, address)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         address = EXCLUDED.address,
         updated_at = NOW()
       RETURNING id`,
      [userId, phone]
    );
    const walletId = wallet.rows[0]?.id;
    if (!walletId) throw new Error("Could not create wallet.");

    const saved = await client.query(
      `INSERT INTO virtual_accounts (
         wallet_id, paystack_customer_code, account_number, account_name, bank_name, provider
       )
       VALUES ($1, $2, $3, $4, $5, 'paystack')
       ON CONFLICT (wallet_id) DO UPDATE SET
         paystack_customer_code = EXCLUDED.paystack_customer_code,
         account_number = EXCLUDED.account_number,
         account_name = EXCLUDED.account_name,
         bank_name = EXCLUDED.bank_name
       RETURNING *`,
      [
        walletId,
        customerCode,
        accountNumber,
        account.accountName ?? null,
        account.bankName ?? null,
      ]
    );
    await client.query("COMMIT");
    return { walletId, virtualAccount: saved.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWalletPinHash(userId: number) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { rows } = await (await db()).query<{ pin: string | null }>(
    `SELECT pin FROM wallets WHERE user_id = $1 LIMIT 1`,
    [id]
  );
  const pin = rows[0]?.pin;
  return pin && String(pin).trim() ? String(pin) : null;
}

export async function setWalletPinHash(userId: number, pinHash: string) {
  const id = Number(userId);
  const hash = String(pinHash ?? "").trim();
  if (!Number.isFinite(id) || id <= 0 || !hash) {
    throw new Error("A wallet and PIN are required.");
  }
  const { rowCount } = await (await db()).query(
    `UPDATE wallets
     SET pin = $2, updated_at = NOW()
     WHERE user_id = $1
       AND (pin IS NULL OR btrim(pin) = '')`,
    [id, hash]
  );
  return Number(rowCount) > 0;
}

export async function replaceWalletPinHash(userId: number, pinHash: string) {
  const id = Number(userId);
  const hash = String(pinHash ?? "").trim();
  if (!Number.isFinite(id) || id <= 0 || !hash) {
    throw new Error("A wallet and PIN are required.");
  }
  const { rowCount } = await (await db()).query(
    `UPDATE wallets
     SET pin = $2, updated_at = NOW()
     WHERE user_id = $1
       AND pin IS NOT NULL
       AND btrim(pin) <> ''`,
    [id, hash]
  );
  return Number(rowCount) > 0;
}

function paystackAccountNumber(data: Record<string, unknown>) {
  const authorization = (data.authorization ?? {}) as Record<string, unknown>;
  const dedicated = (data.dedicated_account ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const recipient = (data.recipient ?? {}) as Record<string, unknown>;
  const details = (recipient.details ?? {}) as Record<string, unknown>;
  const candidates = [
    authorization.receiver_bank_account_number,
    dedicated.account_number,
    metadata.receiver_account_number,
    details.account_number,
  ];
  for (const value of candidates) {
    const next = String(value ?? "").replace(/\D/g, "");
    if (next) return next;
  }
  return "";
}

/** Credits a wallet once for an inbound Paystack transfer, keyed by reference. */
export async function creditWalletFromPaystack(data: Record<string, unknown>) {
  const reference = String(data.reference ?? "").trim();
  const amountKobo = Number(data.amount);
  const accountNumber = paystackAccountNumber(data);
  const customer = (data.customer ?? {}) as Record<string, unknown>;
  const customerCode = String(customer.customer_code ?? "").trim();
  if (!reference || !Number.isFinite(amountKobo) || amountKobo <= 0) {
    return { credited: false };
  }
  if (!accountNumber && !customerCode) return { credited: false };

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wallet = await client.query<{ id: string; user_id: number }>(
      `SELECT w.id, w.user_id
       FROM wallets w
       INNER JOIN virtual_accounts v ON v.wallet_id = w.id
       WHERE ($1 <> '' AND v.account_number = $1)
          OR ($2 <> '' AND v.paystack_customer_code = $2)
       LIMIT 1`,
      [accountNumber, customerCode]
    );
    const walletId = wallet.rows[0]?.id;
    const userId = Number(wallet.rows[0]?.user_id);
    if (!walletId) {
      await client.query("ROLLBACK");
      return { credited: false };
    }
    const inserted = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount_kobo, reference, status, description)
       VALUES ($1, 'topup', $2, $3, 'success', 'Paystack transfer')
       ON CONFLICT (reference) DO NOTHING
       RETURNING id`,
      [walletId, Math.round(amountKobo), reference]
    );
    if (!inserted.rows[0]) {
      await client.query("COMMIT");
      return { credited: false, duplicate: true };
    }
    await client.query(
      `UPDATE wallets SET balance_kobo = balance_kobo + $2, updated_at = NOW() WHERE id = $1`,
      [walletId, Math.round(amountKobo)]
    );
    const balance = await client.query<{ balance_kobo: string }>(
      `SELECT balance_kobo FROM wallets WHERE id = $1`,
      [walletId]
    );
    const transactions = await client.query(
      `SELECT id, type, amount_kobo, reference, status, description, created_at
       FROM wallet_transactions
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [walletId]
    );
    await client.query("COMMIT");
    return {
      credited: true,
      userId,
      balance_kobo: balance.rows[0]?.balance_kobo ?? null,
      transactions: transactions.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function walletSnapshot(client: { query: Function }, walletId: string) {
  const balance = await client.query(
    `SELECT balance_kobo FROM wallets WHERE id = $1`,
    [walletId]
  );
  const transactions = await client.query(
    `SELECT id, type, amount_kobo, reference, status, description, created_at
     FROM wallet_transactions
     WHERE wallet_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [walletId]
  );
  return {
    balance_kobo: balance.rows[0]?.balance_kobo ?? null,
    transactions: transactions.rows,
  };
}

/** Credits an order payout to the shop owner's wallet: gross in, commission out, net added to the balance. */
export async function creditOrderPayoutToWallet(input: {
  shopId: number | string;
  orderId: number | string;
  grossNaira: number;
  commissionNaira: number;
  netNaira: number;
}) {
  const orderId = String(input.orderId ?? "").trim();
  const grossKobo = Math.round(Number(input.grossNaira) * 100);
  const commissionKobo = Math.round(Number(input.commissionNaira) * 100);
  const netKobo = Math.round(Number(input.netNaira) * 100);
  if (!orderId || !Number.isFinite(netKobo) || netKobo <= 0) {
    return { credited: false, duplicate: false, userId: 0, balance_kobo: null, transactions: [] };
  }

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wallet = await client.query<{ id: string; user_id: number }>(
      `SELECT w.id, w.user_id
       FROM wallets w
       INNER JOIN shops s ON s.ownerid = w.user_id
       WHERE s.id::text = $1
       FOR UPDATE OF w`,
      [String(input.shopId)]
    );
    const row = wallet.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { credited: false, duplicate: false, userId: 0, balance_kobo: null, transactions: [] };
    }

    const inserted = await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount_kobo, reference, status, description)
       VALUES ($1, 'receive', $2, $3, 'success', $4)
       ON CONFLICT (reference) DO NOTHING
       RETURNING id`,
      [row.id, Math.max(grossKobo, netKobo), `order:${orderId}:payout`, `Order #${orderId} payout`]
    );
    if (!inserted.rows[0]) {
      const snapshot = await walletSnapshot(client, row.id);
      await client.query("COMMIT");
      return { credited: false, duplicate: true, userId: Number(row.user_id), ...snapshot };
    }
    if (commissionKobo > 0) {
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, type, amount_kobo, reference, status, description)
         VALUES ($1, 'send', $2, $3, 'success', $4)`,
        [row.id, commissionKobo, `order:${orderId}:commission`, `Order #${orderId} commission`]
      );
    }
    await client.query(
      `UPDATE wallets SET balance_kobo = balance_kobo + $2, updated_at = NOW() WHERE id = $1`,
      [row.id, netKobo]
    );
    const snapshot = await walletSnapshot(client, row.id);
    await client.query("COMMIT");
    return { credited: true, duplicate: false, userId: Number(row.user_id), ...snapshot };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Moves naira, in kobo, from the sender to the recipient address. No fee. */
export async function sendWalletToAddress(senderUserId: number, address: string, amountKobo: number, remark: string) {
  const senderId = Number(senderUserId);
  const nextAddress = String(address ?? "").trim();
  const kobo = Math.round(Number(amountKobo));
  if (!Number.isFinite(senderId) || senderId <= 0) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!nextAddress) {
    throw Object.assign(new Error("Enter a wallet address."), { status: 400 });
  }
  if (!Number.isFinite(kobo) || kobo <= 0) {
    throw Object.assign(new Error("Enter an amount greater than 0."), { status: 400 });
  }

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ id: string; user_id: number; balance_kobo: string; address: string }>(
      `SELECT id, user_id, balance_kobo, address::text AS address
       FROM wallets
       WHERE user_id = $1 OR address::text = $2
       ORDER BY id
       FOR UPDATE`,
      [senderId, nextAddress]
    );
    const sender = locked.rows.find(row => Number(row.user_id) === senderId);
    const recipient = locked.rows.find(row => String(row.address) === nextAddress);
    if (!sender) {
      throw Object.assign(new Error("Wallet not found."), { status: 404 });
    }
    if (!recipient) {
      throw Object.assign(new Error("No wallet found for this address."), { status: 404 });
    }
    if (sender.id === recipient.id) {
      throw Object.assign(new Error("You cannot send money to your own wallet."), { status: 400 });
    }
    if (Number(sender.balance_kobo) < kobo) {
      throw Object.assign(new Error("Amount cannot be more than your balance."), { status: 400 });
    }

    await client.query(
      `UPDATE wallets SET balance_kobo = balance_kobo - $2, updated_at = NOW() WHERE id = $1`,
      [sender.id, kobo]
    );
    await client.query(
      `UPDATE wallets SET balance_kobo = balance_kobo + $2, updated_at = NOW() WHERE id = $1`,
      [recipient.id, kobo]
    );

    const reference = crypto.randomUUID();
    const note = remark.trim() || "Wallet transfer";
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount_kobo, reference, status, description)
       VALUES ($1, 'send', $2, $3, 'success', $4), ($5, 'receive', $2, $6, 'success', $4)`,
      [sender.id, kobo, `${reference}:send`, note, recipient.id, `${reference}:receive`]
    );

    const senderSnapshot = await walletSnapshot(client, sender.id);
    const recipientSnapshot = await walletSnapshot(client, recipient.id);
    await client.query("COMMIT");
    return {
      sender: { userId: Number(sender.user_id), ...senderSnapshot },
      recipient: { userId: Number(recipient.user_id), ...recipientSnapshot },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWalletIdByUserId(userId: number) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { rows } = await (await db()).query<{ id: string }>(
    `SELECT id FROM wallets WHERE user_id = $1 LIMIT 1`,
    [id]
  );
  return rows[0]?.id ?? null;
}

export async function getOwnerPayoutAccount(userId: number) {
  const walletId = await getWalletIdByUserId(userId);
  if (!walletId) return null;
  const { rows } = await (await db()).query(
    `SELECT
       provider_recipient_id,
       bank_name,
       account_number,
       account_name
     FROM wallet_payout_accounts
     WHERE wallet_id = $1
       AND provider_recipient_id IS NOT NULL
       AND btrim(provider_recipient_id) <> ''
     ORDER BY is_primary DESC, updated_at DESC NULLS LAST
     LIMIT 1`,
    [walletId]
  );
  return rows[0] ?? null;
}

/** Debits the sender's wallet for a bank withdrawal. No fee. */
export async function withdrawFromWallet(userId: number, amountKobo: number, description: string) {
  const id = Number(userId);
  const kobo = Math.round(Number(amountKobo));
  if (!Number.isFinite(id) || id <= 0) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  if (!Number.isFinite(kobo) || kobo <= 0) {
    throw Object.assign(new Error("Enter an amount greater than 0."), { status: 400 });
  }
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ id: string; user_id: number; balance_kobo: string }>(
      `SELECT id, user_id, balance_kobo FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [id]
    );
    const wallet = locked.rows[0];
    if (!wallet) {
      throw Object.assign(new Error("Wallet not found."), { status: 404 });
    }
    if (Number(wallet.balance_kobo) < kobo) {
      throw Object.assign(new Error("Amount cannot be more than your balance."), { status: 400 });
    }
    await client.query(
      `UPDATE wallets SET balance_kobo = balance_kobo - $2, updated_at = NOW() WHERE id = $1`,
      [wallet.id, kobo]
    );
    const note = description.trim() || "Wallet withdrawal";
    await client.query(
      `INSERT INTO wallet_transactions (wallet_id, type, amount_kobo, reference, status, description)
       VALUES ($1, 'withdraw', $2, $3, 'success', $4)`,
      [wallet.id, kobo, crypto.randomUUID(), note]
    );
    const snapshot = await walletSnapshot(client, wallet.id);
    await client.query("COMMIT");
    return { userId: Number(wallet.user_id), ...snapshot };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listWalletTransactions(userId: number) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return [];
  const { rows } = await (await db()).query(
    `SELECT t.id, t.type, t.amount_kobo, t.reference, t.status, t.description, t.created_at
     FROM wallet_transactions t
     INNER JOIN wallets w ON w.id = t.wallet_id
     WHERE w.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT 30`,
    [id]
  );
  return rows;
}

export async function updateWalletAddressByUserId(userId: number, address: string) {
  const id = Number(userId);
  const next = String(address ?? "").trim();
  if (!Number.isFinite(id) || id <= 0 || !next) return;
  await (await db()).query(
    `UPDATE wallets SET address = $2, updated_at = NOW() WHERE user_id = $1`,
    [id, next]
  );
}

export async function getWalletRecipientByAddress(address: string) {
  const next = String(address ?? "").trim();
  if (!next) return null;
  const { rows } = await (await db()).query(
    `SELECT
       u.id,
       u.fname,
       u.lname,
       u.phone,
       u.photo,
       w.address,
       v.account_number,
       v.account_name,
       v.bank_name
     FROM wallets w
     INNER JOIN users u ON u.id = w.user_id
     LEFT JOIN virtual_accounts v ON v.wallet_id = w.id
     WHERE w.address::text = $1
     LIMIT 1`,
    [next]
  );
  return rows[0] ?? null;
}

export async function getWalletByUserId(userId: number) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const { rows } = await (await db()).query(
    `SELECT
       w.address,
       w.balance_kobo,
       (w.pin IS NOT NULL AND btrim(w.pin) <> '') AS has_pin,
       v.account_number,
       v.account_name,
       v.bank_name
     FROM wallets w
     LEFT JOIN virtual_accounts v ON v.wallet_id = w.id
     WHERE w.user_id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}
