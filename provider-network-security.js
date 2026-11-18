'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');

function ipv4NumberToAddress(value) {
  const n = BigInt(value);
  return [Number((n >> 24n) & 255n), Number((n >> 16n) & 255n), Number((n >> 8n) & 255n), Number(n & 255n)].join('.');
}

function ipv6MappedIpv4(address) {
  const a = String(address || '').toLowerCase().split('%')[0].replace(/^\[|\]$/g, '');
  const dotted = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];
  const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const n = (BigInt(parseInt(hex[1], 16)) << 16n) | BigInt(parseInt(hex[2], 16));
    return ipv4NumberToAddress(n);
  }
  return '';
}

function isPrivateAddress(address) {
  let a = String(address || '').trim().toLowerCase().split('%')[0].replace(/^\[|\]$/g, '');
  if (!a) return true;
  const mapped = ipv6MappedIpv4(a);
  if (mapped) a = mapped;
  if (net.isIPv4(a)) {
    const p = a.split('.').map(Number);
    if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
    const [x, y, z] = p;
    // IANA special-use, private, loopback, link-local, carrier-grade NAT,
    // documentation, benchmark, multicast, and reserved IPv4 ranges.
    return x === 0 || x === 10 || x === 127 || x >= 224 ||
      (x === 100 && y >= 64 && y <= 127) ||
      (x === 169 && y === 254) ||
      (x === 172 && y >= 16 && y <= 31) ||
      (x === 192 && y === 0 && z === 0) ||
      (x === 192 && y === 0 && z === 2) ||
      (x === 192 && y === 88 && z === 99) ||
      (x === 192 && y === 168) ||
      (x === 198 && (y === 18 || y === 19 || (y === 51 && z === 100))) ||
      (x === 203 && y === 0 && z === 113);
  }
  if (net.isIPv6(a)) {
    // Non-global/special-use IPv6, plus translation/transition formats that can
    // encode a private IPv4 target.
    return a === '::' || a === '::1' ||
      a.startsWith('fc') || a.startsWith('fd') || /^fe[89ab]/.test(a) || a.startsWith('ff') ||
      a.startsWith('2001:db8:') || a.startsWith('2001:10:') || a.startsWith('2001:0:') ||
      a.startsWith('2002:') || a.startsWith('64:ff9b:') || a.startsWith('100:');
  }
  return false;
}

async function validateProviderUrl(raw, options = {}) {
  const URLCtor = options.URL || URL;
  const lookup = options.lookup || dns.lookup.bind(dns);
  const env = options.env || process.env;
  const u = new URLCtor(String(raw || '').trim());
  if (!/^https?:$/.test(u.protocol)) throw new Error('API URL يجب أن يبدأ بـ http:// أو https://');
  if (u.username || u.password) throw new Error('لا تضع بيانات دخول داخل رابط المزود؛ استخدم حقل مفتاح API.');
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const localTest = env.NODE_ENV === 'test' && env.ALLOW_LOCAL_PROVIDER_TEST === '1';
  if (!localTest && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host === 'metadata.google.internal')) {
    throw new Error('عنوان المزود غير مسموح');
  }
  const records = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!records.length) throw new Error('تعذر حل اسم مزود API');
  if (!localTest && records.some(record => isPrivateAddress(record.address))) {
    throw new Error('عنوان API داخلي أو خاص أو محجوز غير مسموح');
  }
  // Pin the exact public DNS answer that passed validation. The connection layer must
  // not resolve the hostname again, otherwise DNS rebinding could change the target.
  Object.defineProperty(u, '__sadaResolvedAddresses', {
    value: records.map(record => ({ address: String(record.address), family: Number(record.family || net.isIP(record.address)) })),
    enumerable: false, configurable: false, writable: false
  });
  return u;
}

function abortError(){ const e=new Error('The operation was aborted'); e.name='AbortError'; return e; }

function requestPinned(url, init = {}, resolvedAddresses = []) {
  return new Promise((resolve, reject) => {
    const target = url instanceof URL ? url : new URL(String(url));
    const transport = target.protocol === 'https:' ? https : http;
    if (target.protocol !== 'https:' && target.protocol !== 'http:') return reject(new Error('Unsupported provider protocol'));
    const addresses = Array.isArray(resolvedAddresses) ? resolvedAddresses.filter(x => x && net.isIP(String(x.address || ''))) : [];
    if (!addresses.length) return reject(new Error('لم يتوفر عنوان IP مثبت بعد التحقق من DNS.'));
    const chosen = addresses[0];
    const headers = {};
    const sourceHeaders = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init.headers || {});
    for (const [key, value] of Object.entries(sourceHeaders)) headers[String(key).toLowerCase()] = String(value);
    // The provider APIs are JSON/form endpoints; identity avoids needing content decompression.
    if (!headers['accept-encoding']) headers['accept-encoding'] = 'identity';
    const method = String(init.method || 'GET').toUpperCase();
    const requestOptions = {
      protocol: target.protocol, hostname: target.hostname, port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: (target.pathname || '/') + target.search, method, headers,
      lookup: (_hostname, lookupOptions, callback) => process.nextTick(() => {
        const family = chosen.family || net.isIP(chosen.address);
        if (lookupOptions && lookupOptions.all) callback(null, [{ address: chosen.address, family }]);
        else callback(null, chosen.address, family);
      })
    };
    const req = transport.request(requestOptions, response => {
      const chunks = []; let total = 0; const maxBytes = Number(optionsResponseLimit(init.maxResponseBytes)) || (8 * 1024 * 1024);
      response.on('data', chunk => { total += chunk.length; if (total > maxBytes) { req.destroy(new Error('Provider response exceeds the safe response limit')); return; } chunks.push(chunk); });
      response.on('end', () => {
        settled = true;
        const body = Buffer.concat(chunks);
        const headerMap = response.headers || {};
        const headersView = { get: name => { const value = headerMap[String(name || '').toLowerCase()]; return Array.isArray(value) ? value.join(', ') : (value == null ? null : String(value)); } };
        resolve({ status: Number(response.statusCode || 0), statusText: String(response.statusMessage || ''), ok: Number(response.statusCode || 0) >= 200 && Number(response.statusCode || 0) < 300, headers: headersView, text: async () => body.toString('utf8'), body: { cancel: async () => {} } });
      });
    });
    let settled = false;
    const finishError = error => { if (settled) return; settled = true; reject(error); };
    req.on('error', finishError);
    const signal = init.signal;
    const onAbort = () => req.destroy(abortError());
    if (signal) {
      if (signal.aborted) { req.destroy(abortError()); return; }
      signal.addEventListener('abort', onAbort, { once: true });
      req.on('close', () => signal.removeEventListener('abort', onAbort));
    }
    const body = init.body;
    if (body !== undefined && body !== null) req.write(body);
    req.end();
  });
}

function optionsResponseLimit(value){ return Number(value) > 0 && Number(value) <= 32 * 1024 * 1024 ? Number(value) : 8 * 1024 * 1024; }

async function fetchProviderWithSafeRedirects(endpoint, init = {}, maxRedirects = 3, options = {}) {
  const injectedFetch = options.fetch;
  const fetchImpl = injectedFetch || globalThis.fetch;
  const validate = options.validate || validateProviderUrl;
  let current = new URL(String(endpoint));
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validated = await validate(current.toString(), options.validationOptions || {});
    const response = injectedFetch
      ? await fetchImpl(current, { ...init, redirect: 'manual' })
      : await requestPinned(current, { ...init, maxResponseBytes: options.maxResponseBytes }, validated?.__sadaResolvedAddresses || []);
    if (![301, 302, 303, 307, 308].includes(Number(response.status))) return response;
    const location = response.headers?.get?.('location');
    if (!location) {
      try { await response.body?.cancel?.(); } catch (_) {}
      throw new Error('المزود أعاد تحويلة بلا عنوان واضح.');
    }
    if (hop === maxRedirects) {
      try { await response.body?.cancel?.(); } catch (_) {}
      throw new Error('تجاوز المزود الحد الآمن للتحويلات.');
    }
    let next;
    try { next = new URL(location, current); }
    catch (_) {
      try { await response.body?.cancel?.(); } catch (_) {}
      throw new Error('عنوان تحويلة المزود غير صالح.');
    }
    const sameHost = next.hostname.toLowerCase() === current.hostname.toLowerCase();
    const samePort = next.port === current.port;
    const safeUpgrade = current.protocol === 'http:' && next.protocol === 'https:' && sameHost &&
      (!current.port || current.port === '80') && (!next.port || next.port === '443');
    if (!sameHost || (!samePort && !safeUpgrade) || (current.protocol === 'https:' && next.protocol !== 'https:') ||
        !/^https?:$/.test(next.protocol) || next.username || next.password) {
      try { await response.body?.cancel?.(); } catch (_) {}
      throw new Error('تم رفض تحويلة المزود إلى نطاق أو منفذ مختلف لحماية مفتاح API. ضع رابط API النهائي مباشرة في إعدادات المزود.');
    }
    try { await validate(next.toString(), options.validationOptions || {}); }
    catch (error) { try { await response.body?.cancel?.(); } catch (_) {} throw error; }
    try { await response.body?.cancel?.(); } catch (_) {}
    current = next;
  }
  throw new Error('تعذر إكمال اتصال المزود بأمان.');
}

module.exports = { isPrivateAddress, validateProviderUrl, requestPinned, fetchProviderWithSafeRedirects };
