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
