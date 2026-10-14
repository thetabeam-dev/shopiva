import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  getWhatsAppConfig,
  isWhatsAppConfigured,
  normalizeWhatsAppPhone,
  sendWhatsAppTemplate,
} from '../dist/services/whatsapp.js';
import {
  isWhatsAppOptOutReply,
  verifyWhatsAppWebhookSignature,
} from '../dist/controllers/webhooks/whatsapp.js';

const config = {
  accessToken: 'test-token',
  phoneNumberId: '123456789',
  templateName: 'vendor_product_nudge',
  templateLanguage: 'en',
  apiVersion: 'v23.0',
};

test('normalizes Nigerian subscriber numbers to WhatsApp E.164 format', () => {
  assert.equal(normalizeWhatsAppPhone('803 123 4567'), '2348031234567');
  assert.equal(normalizeWhatsAppPhone('08031234567'), '2348031234567');
  assert.equal(normalizeWhatsAppPhone('+2348031234567'), '2348031234567');
  assert.equal(normalizeWhatsAppPhone('1234'), null);
  assert.equal(normalizeWhatsAppPhone(null), null);
});

test('requires all server-side Meta settings and a valid API version', () => {
  assert.equal(isWhatsAppConfigured(config), true);
  assert.equal(isWhatsAppConfigured({ ...config, accessToken: undefined }), false);
  assert.equal(isWhatsAppConfigured({ ...config, apiVersion: 'https://bad' }), false);
  assert.deepEqual(getWhatsAppConfig({}), {
    accessToken: undefined,
    phoneNumberId: undefined,
    templateName: undefined,
    templateLanguage: 'en',
    apiVersion: 'v23.0',
  });
});

test('sends an approved template request and returns the provider message id', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid.test' }] }) };
  };
  const messageId = await sendWhatsAppTemplate('08031234567', config, fetchImpl, 'Ngozi');
  assert.equal(messageId, 'wamid.test');
  assert.match(request.url, /graph\.facebook\.com\/v23\.0\/123456789\/messages$/);
  assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(JSON.parse(request.options.body), {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '2348031234567',
    type: 'template',
    template: {
      name: 'vendor_product_nudge',
      language: { code: 'en' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: 'Ngozi' }] }],
    },
  });
});

test('does not send invalid phone numbers and surfaces provider rejection', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: false, status: 400 };
  };
  await assert.rejects(() => sendWhatsAppTemplate('1234', config, fetchImpl), /valid Nigerian mobile number/);
  assert.equal(called, false);
  await assert.rejects(() => sendWhatsAppTemplate('08031234567', config, fetchImpl), /HTTP 400/);
});

test('verifies Meta webhook signatures and recognizes opt-out replies', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const appSecret = 'test-app-secret';
  const signature = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`;
  assert.equal(verifyWhatsAppWebhookSignature(body, signature, appSecret), true);
  assert.equal(verifyWhatsAppWebhookSignature(body, signature, 'wrong-secret'), false);
  assert.equal(verifyWhatsAppWebhookSignature(body, undefined, appSecret), false);
  assert.equal(isWhatsAppOptOutReply('STOP'), true);
  assert.equal(isWhatsAppOptOutReply(' unsubscribe '), true);
  assert.equal(isWhatsAppOptOutReply('Hello'), false);
});
