import { createHmac, randomUUID } from 'node:crypto';

const COOLDOWN_SECONDS = 60;
const RESPONSE_LIST = 'proposal:responses';
const ANSWERS = new Set(['yes', 'later']);

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function logWarning(message, details = {}) {
  console.warn(`[proposal-response] ${message}`, details);
}

function logInfo(message, details = {}) {
  console.info(`[proposal-response] ${message}`, details);
}

async function resendResultDetails(response) {
  const fallback = { status: response.status };
  try {
    const result = await response.json();
    if (response.ok) {
      return typeof result?.id === 'string' ? { ...fallback, emailId: result.id } : fallback;
    }

    // Resend errors are useful for diagnosis, but never log the request payload,
    // credentials, or recipient address.
    const error = typeof result?.message === 'string' ? result.message.slice(0, 300) : undefined;
    return error ? { ...fallback, error } : fallback;
  } catch {
    return fallback;
  }
}

function responseMessage(answer) {
  if (answer === 'yes') {
    return {
      emailSubject: '💌 Shraddha responded to your proposal — YES ❤️',
      emailBody: (timestamp, id) => `Shraddha just selected YES ❤️ on your proposal website.\n\nResponse: YES\nTime: ${timestamp}\nResponse ID: ${id}`,
      smsBody: '💌 Shraddha responded YES ❤️ to your proposal.'
    };
  }
  return {
    emailSubject: '💌 Shraddha responded to your proposal — Give me some time',
    emailBody: (timestamp, id) => `Shraddha selected the 'give me some time' option.\n\nResponse: LATER\nTime: ${timestamp}\nResponse ID: ${id}`,
    smsBody: "💌 Shraddha selected 'give me some time' on your proposal."
  };
}

async function redisCommand(command) {
  const response = await fetch(process.env.KV_REST_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) throw new Error('Redis request failed');
  const result = await response.json();
  if (result.error) throw new Error('Redis command failed');
  return result.result;
}

async function sendEmail(answer, timestamp, id) {
  const { RESEND_API_KEY: apiKey, NOTIFICATION_EMAIL: to, RESEND_FROM_EMAIL: from } = process.env;
  if (!apiKey || !to || !from) {
    logWarning('Email notification is not configured');
    return;
  }

  const message = responseMessage(answer);
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: message.emailSubject,
        text: message.emailBody(timestamp, id)
      }),
      signal: AbortSignal.timeout(8000)
    });
    const details = await resendResultDetails(response);
    if (!response.ok) {
      logWarning('Email delivery failed', details);
      return;
    }
    logInfo('Email accepted by Resend', details);
  } catch (error) {
    logWarning('Email delivery failed', {
      error: error instanceof Error ? error.name : 'UnknownError'
    });
  }
}

async function sendSms(answer) {
  const {
    SMS_PROVIDER: provider,
    TWILIO_ACCOUNT_SID: accountSid,
    TWILIO_AUTH_TOKEN: authToken,
    TWILIO_PHONE_NUMBER: from,
    NOTIFICATION_PHONE: to
  } = process.env;
  if (!provider && !accountSid && !authToken && !from) {
    logWarning('SMS notification is not configured');
    return;
  }
  if (provider !== 'twilio' || !accountSid || !authToken || !from || !to) {
    logWarning('SMS notification configuration is incomplete or unsupported');
    return;
  }

  const body = new URLSearchParams({ To: to, From: from, Body: responseMessage(answer).smsBody });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) logWarning('SMS delivery failed', { status: response.status });
  } catch {
    logWarning('SMS delivery failed');
  }
}

async function sendWhatsApp(answer) {
  const {
    WHATSAPP_PROVIDER: provider,
    WHATSAPP_ACCESS_TOKEN: accessToken,
    WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
    WHATSAPP_TO: to,
    WHATSAPP_YES_TEMPLATE: yesTemplate,
    WHATSAPP_LATER_TEMPLATE: laterTemplate,
    WHATSAPP_TEMPLATE_LANGUAGE: language = 'en',
    WHATSAPP_API_VERSION: version = 'v23.0'
  } = process.env;
  if (!provider && !accessToken && !phoneNumberId && !to && !yesTemplate && !laterTemplate) return;
  if (provider !== 'meta-cloud-api' || !accessToken || !phoneNumberId || !to || !yesTemplate || !laterTemplate) {
    logWarning('WhatsApp notification configuration is incomplete or unsupported');
    return;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: answer === 'yes' ? yesTemplate : laterTemplate,
          language: { code: language }
        }
      }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) logWarning('WhatsApp delivery failed', { status: response.status });
  } catch {
    logWarning('WhatsApp delivery failed');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const contentType = req.headers['content-type'];
  const contentLength = Number(req.headers['content-length'] || 0);
  if ((contentType && !contentType.toLowerCase().startsWith('application/json')) || contentLength > 1024) {
    return json(res, 400, { error: 'Invalid request' });
  }

  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json(res, 403, { error: 'Request rejected' });
    } catch {
      return json(res, 403, { error: 'Request rejected' });
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: 'Invalid request' });
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !ANSWERS.has(body.answer)) {
    return json(res, 400, { error: 'Invalid request' });
  }

  const {
    KV_REST_API_URL: redisUrl,
    KV_REST_API_TOKEN: redisToken,
    RATE_LIMIT_SECRET: rateLimitSecret
  } = process.env;
  if (!redisUrl || !redisToken || !rateLimitSecret) {
    logWarning('Response storage or cooldown is not configured');
    return json(res, 503, { error: 'Response could not be recorded' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientAddress = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : 'unknown';
  const addressHash = createHmac('sha256', rateLimitSecret).update(clientAddress).digest('hex');
  const cooldownKey = `proposal:cooldown:${addressHash}`;
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const record = { id, answer: body.answer, timestamp, source: 'proposal-website' };

  try {
    const claimed = await redisCommand(['SET', cooldownKey, id, 'NX', 'EX', COOLDOWN_SECONDS]);
    if (claimed !== 'OK') return json(res, 200, { success: true, duplicate: true });

    try {
      await redisCommand(['LPUSH', RESPONSE_LIST, JSON.stringify(record)]);
    } catch (error) {
      await redisCommand(['DEL', cooldownKey]).catch(() => {});
      throw error;
    }
  } catch {
    logWarning('Response could not be stored');
    return json(res, 503, { error: 'Response could not be recorded' });
  }

  await Promise.all([
    sendEmail(body.answer, timestamp, id),
    sendSms(body.answer),
    sendWhatsApp(body.answer)
  ]);

  return json(res, 200, { success: true, id, timestamp });
}
