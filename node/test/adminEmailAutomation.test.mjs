import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { pgPoolConfigFromEnv } from '../dist/config/database.js';

dotenv.config();
const {
  AdminEmailAutomationRouter,
  CAMPAIGN_RECIPIENTS_SQL,
  ELIGIBLE_SHOPS_SQL,
  buildCampaignRecipientsSql,
  buildEligibleShopsSql,
  deliverCampaignRecipients,
  deliverWhatsAppCampaignRecipients,
} = await import('../dist/routes/adminEmailAutomation.js');

function preferences(marketing = true, whatsappMarketing = false) {
  return JSON.stringify({
    email: { enabled: true, marketing },
    whatsapp: { enabled: true, marketing: whatsappMarketing },
  });
}

test('eligibility SQL returns only empty entrepreneur-owned shops and deduplicates vendor totals', async (t) => {
  const pool = new Pool(pgPoolConfigFromEnv());
  let client;
  try {
    client = await pool.connect();
  } catch {
    await pool.end();
    t.skip('PostgreSQL is not available for integration tests.');
    return;
  }

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE users (
        id INTEGER PRIMARY KEY, role TEXT, email TEXT, fname TEXT, phone TEXT,
        isactive BOOLEAN, accountstatus TEXT, notificationpreferences JSONB
      );
      CREATE TEMP TABLE shops (id INTEGER PRIMARY KEY, ownerid INTEGER, name TEXT);
      CREATE TEMP TABLE products (id INTEGER PRIMARY KEY, shop_id INTEGER);
      CREATE TEMP TABLE admin_email_campaigns (id INTEGER PRIMARY KEY, campaign_type TEXT, channel TEXT, created_at TIMESTAMPTZ);
      CREATE TEMP TABLE admin_email_campaign_recipients (campaign_id INTEGER, user_id INTEGER, status TEXT);
    `);
    await client.query(
      `INSERT INTO users VALUES
       (1001, 'entrepreneur', 'one@example.com', 'One', '+2348031234501', true, 'active', $1),
       (1002, 'entrepreneur', 'two@example.com', 'Two', '08031234502', true, 'active', $1),
       (1003, 'manager', 'manager@example.com', 'Manager', '08031234503', true, 'active', $1),
       (1004, 'entrepreneur', 'noshopexample.com', 'No Shop', '08031234504', true, 'active', $1),
       (1005, 'entrepreneur', 'multi@example.com', 'Multi', '08031234505', true, 'active', $2),
       (1006, 'entrepreneur', 'other@example.com', 'Other', '08031234506', true, 'active', $3)`,
      [preferences(true, true), preferences(false, true), preferences(true, false)],
    );
    await client.query(`
      INSERT INTO shops VALUES
        (101, 1001, 'Empty One'),
        (102, 1001, 'One Product'),
        (103, 1002, 'Five Products'),
        (104, 1003, 'Wrong Role'),
        (105, 1005, 'Multi Empty A'),
        (106, 1005, 'Multi Empty B'),
        (107, 1006, 'Six Products');
      INSERT INTO products VALUES
        (1, 102),
        (2, 103), (3, 103), (4, 103), (5, 103), (6, 103),
        (7, 107), (8, 107), (9, 107), (10, 107), (11, 107), (12, 107);
    `);

    const { rows } = await client.query(
      `WITH eligible AS (${ELIGIBLE_SHOPS_SQL})
       SELECT shop_id, user_id FROM eligible ORDER BY shop_id`,
    );
    assert.deepEqual(rows.map((row) => row.shop_id), [101, 102, 103, 105, 106]);
    assert.equal(new Set(rows.map((row) => row.user_id)).size, 3);

    const { rows: productCountOne } = await client.query(
      `WITH eligible AS (${ELIGIBLE_SHOPS_SQL}) SELECT shop_id FROM eligible WHERE product_count = $1`,
      [1],
    );
    assert.deepEqual(productCountOne.map((row) => row.shop_id), [102]);
    const { rows: productCountFive } = await client.query(
      `WITH eligible AS (${ELIGIBLE_SHOPS_SQL}) SELECT shop_id FROM eligible WHERE product_count = $1`,
      [5],
    );
    assert.deepEqual(productCountFive.map((row) => row.shop_id), [103]);

    const { rows: eligibleRecipients } = await client.query(CAMPAIGN_RECIPIENTS_SQL, [[1001, 1005, 1006]]);
    assert.deepEqual(eligibleRecipients.map((row) => row.id), [1001]);

    const { rows: eligibleWhatsAppRecipients } = await client.query(buildCampaignRecipientsSql('whatsapp'), [[1001, 1002, 1005, 1006]]);
    assert.deepEqual(eligibleWhatsAppRecipients.map((row) => row.id), [1001, 1002, 1005]);
    const { rows: whatsappShops } = await client.query(
      `WITH eligible AS (${buildEligibleShopsSql('whatsapp')})
       SELECT shop_id, user_id, valid_phone, whatsapp_opt_in FROM eligible ORDER BY shop_id`,
    );
    assert.deepEqual(whatsappShops.map((row) => row.shop_id), [101, 102, 103, 105, 106]);
    assert.equal(whatsappShops.find((row) => row.user_id === 1005).whatsapp_opt_in, true);

    await client.query(
      `INSERT INTO admin_email_campaigns VALUES (1, 'vendor_activation_empty_shop', 'email', NOW());
       INSERT INTO admin_email_campaign_recipients VALUES (1, 1002, 'pending');`,
    );
     const { rows: afterPendingCampaign } = await client.query(CAMPAIGN_RECIPIENTS_SQL, [[1001, 1002]]);
     assert.deepEqual(afterPendingCampaign.map((row) => row.id), [1001]);
     const { rows: whatsappAfterEmailCampaign } = await client.query(buildCampaignRecipientsSql('whatsapp'), [[1002]]);
     assert.deepEqual(whatsappAfterEmailCampaign.map((row) => row.id), [1002]);

     await client.query('INSERT INTO products VALUES (13, 103)');
     const { rows: afterProductUpload } = await client.query(CAMPAIGN_RECIPIENTS_SQL, [[1002]]);
    assert.deepEqual(afterProductUpload, []);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});

test('email delivery failures are recorded per recipient', async () => {
  const updates = [];
  const fakePool = {
    query: async (_sql, parameters) => { updates.push(parameters); return { rows: [] }; },
  };
  const recipients = [
    { id: 11, email: 'ok@example.com', fname: 'Vendor' },
    { id: 12, email: 'fail@example.com', fname: '<Vendor>' },
  ];
  const sentTo = [];
  const sender = async (options) => {
    sentTo.push(options);
    if (options.to === 'fail@example.com') throw new Error('smtp unavailable');
    return true;
  };

  const result = await deliverCampaignRecipients(recipients, 3, fakePool, sender);
  assert.deepEqual(result, {
    sent: 1,
    failed: 1,
    results: [
      { userId: 11, status: 'submitted' },
      { userId: 12, status: 'failed' },
    ],
  });
  assert.match(sentTo[1].html, /&lt;Vendor&gt;/);
  assert.deepEqual(updates.map((parameters) => parameters[0]), ['sent', 'failed']);
});

test('WhatsApp delivery failures are recorded per recipient', async () => {
  const updates = [];
  const fakePool = {
    query: async (_sql, parameters) => { updates.push(parameters); return { rows: [] }; },
  };
  const recipients = [
    { id: 21, phone: '08031234567', fname: 'Vendor' },
    { id: 22, phone: '08031234568', fname: 'Other' },
  ];
  const sender = async (phone) => {
    if (phone === '08031234568') throw new Error('Meta rejected recipient');
    return 'wamid.test';
  };

  const result = await deliverWhatsAppCampaignRecipients(recipients, 4, fakePool, sender);
  assert.deepEqual(result, {
    sent: 1,
    failed: 1,
    results: [
      { userId: 21, status: 'submitted' },
      { userId: 22, status: 'failed' },
    ],
  });
  assert.deepEqual(updates.map((parameters) => parameters.slice(0, 2)), [
    ['sent', null],
    ['failed', 'WHATSAPP_DELIVERY_FAILED'],
  ]);
});

test('campaign route no longer requires authentication', async () => {
  const app = express();
  app.use(AdminEmailAutomationRouter);
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/admin/email-automation/shops-without-products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Select 1 to 100 vendors/);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
