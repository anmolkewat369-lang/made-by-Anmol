import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/response.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function createResponse() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function request(answer, address = '203.0.113.1') {
  return {
    method: 'POST',
    headers: {
      host: 'proposal.example',
      origin: 'https://proposal.example',
      'content-type': 'application/json',
      'x-forwarded-for': address
    },
    body: { answer }
  };
}

function configureStorage() {
  process.env.KV_REST_API_URL = 'https://redis.example';
  process.env.KV_REST_API_TOKEN = 'test-token';
  process.env.RATE_LIMIT_SECRET = 'test-rate-limit-secret';
}

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

describe('POST /api/response', () => {
  it('rejects answers outside yes and later', async () => {
    const response = createResponse();
    await handler(request('no'), response);
    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.body, { error: 'Invalid request' });
  });

  it('stores a YES response and sends configured email, SMS, and WhatsApp messages', async () => {
    configureStorage();
    Object.assign(process.env, {
      RESEND_API_KEY: 'resend-test',
      RESEND_FROM_EMAIL: 'Proposal <noreply@example.com>',
      NOTIFICATION_EMAIL: 'owner@example.com',
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'twilio-test',
      TWILIO_PHONE_NUMBER: '+10000000000',
      NOTIFICATION_PHONE: '+919630194023',
      WHATSAPP_PROVIDER: 'meta-cloud-api',
      WHATSAPP_ACCESS_TOKEN: 'whatsapp-test',
      WHATSAPP_PHONE_NUMBER_ID: '123456',
      WHATSAPP_TO: '+919630194023',
      WHATSAPP_YES_TEMPLATE: 'proposal_yes',
      WHATSAPP_LATER_TEMPLATE: 'proposal_later'
    });

    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url === 'https://redis.example') {
        const command = JSON.parse(options.body);
        return Response.json({ result: command[0] === 'SET' ? 'OK' : 1 });
      }
      return Response.json({ id: 'provider-message' });
    };

    const response = createResponse();
    await handler(request('yes'), response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.match(response.body.id, /^[0-9a-f-]{36}$/);
    const storeCommand = JSON.parse(calls.find(call => call.url === 'https://redis.example' && JSON.parse(call.options.body)[0] === 'LPUSH').options.body);
    const record = JSON.parse(storeCommand[2]);
    assert.deepEqual(Object.keys(record).sort(), ['answer', 'id', 'source', 'timestamp']);
    assert.equal(record.answer, 'yes');
    assert.equal(record.source, 'proposal-website');
    assert.equal(record.timestamp, response.body.timestamp);

    const email = calls.find(call => call.url === 'https://api.resend.com/emails');
    const emailBody = JSON.parse(email.options.body);
    assert.equal(emailBody.subject, '💌 Shraddha responded to your proposal — YES ❤️');
    assert.match(emailBody.text, /Response: YES/);
    assert.match(emailBody.text, new RegExp(response.body.id));
    assert.match(calls.find(call => call.url.includes('twilio.com')).options.body.toString(), /YES/);
    const whatsapp = calls.find(call => call.url.includes('graph.facebook.com'));
    assert.equal(JSON.parse(whatsapp.options.body).template.name, 'proposal_yes');
  });

  it('records LATER, rejects repeated requests during the cooldown, and skips absent optional providers', async () => {
    configureStorage();
    let storedRecord;
    let cooldownClaimed = false;
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      const command = JSON.parse(options.body);
      if (command[0] === 'SET') {
        if (cooldownClaimed) return Response.json({ result: null });
        cooldownClaimed = true;
        return Response.json({ result: 'OK' });
      }
      if (command[0] === 'LPUSH') storedRecord = JSON.parse(command[2]);
      return Response.json({ result: 1 });
    };

    const first = createResponse();
    await handler(request('later', '203.0.113.2'), first);
    assert.equal(first.statusCode, 200);
    assert.equal(storedRecord.answer, 'later');
    assert.equal(calls.filter(call => call.url === 'https://redis.example').length, 2);

    const duplicate = createResponse();
    await handler(request('later', '203.0.113.2'), duplicate);
    assert.deepEqual(duplicate.body, { success: true, duplicate: true });
    assert.equal(calls.filter(call => call.url === 'https://redis.example').length, 3);
  });

  it('does not store user-agent data and keeps storage failures private', async () => {
    configureStorage();
    globalThis.fetch = async () => Response.json({ error: 'private redis details' }, { status: 500 });
    const response = createResponse();
    await handler({ ...request('yes'), headers: { ...request('yes').headers, 'user-agent': 'test-agent' } }, response);
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, { error: 'Response could not be recorded' });
    assert.equal(response.headers['Cache-Control'], 'no-store');
  });
});
