import { Env } from "./types";
import {
  json,
  error,
  generateId,
  requireAuth,
  getClientIp,
  createAuditLog,
} from "./utils";
import {
  amountsMatchUsd,
  calculateBinanceSignature,
  generateNonce,
  mapBinanceStatusToInternal,
  parseBinanceSms,
  verifyBinanceWebhookSignature,
} from "../../lib/payments/binance-pay";

const DEFAULT_RECIPIENT_BINANCE_ID = "405960486";
const BINANCE_PAY_BASE_URL = "https://bpay.binanceapi.com";

export async function handleBinancePayRequest(
  request: Request,
  env: Env,
  path: string,
  ctx?: ExecutionContext
): Promise<Response> {
  const normalizedPath = path.replace(/\/$/, "");
  const method = request.method;

  // Handle GET / HEAD requests cleanly with 405 Method Not Allowed
  if (method === "GET" || method === "HEAD") {
    return new Response(
      method === "HEAD"
        ? null
        : JSON.stringify({
            success: false,
            error: {
              code: "METHOD_NOT_ALLOWED",
              message: "GET method is not allowed for payment operations. Please use POST.",
            },
          }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Allow: "POST",
        },
      }
    );
  }

  if (method !== "POST") {
    return error("METHOD_NOT_ALLOWED", "Only POST requests are allowed", 405);
  }

  // Route to specific endpoints
  if (normalizedPath === "/v1/payment/binance-pay/create") {
    return handleCreateBinancePayOrder(request, env);
  }
  if (normalizedPath === "/v1/payment/binance-pay/query") {
    return handleQueryBinancePayOrder(request, env);
  }
  if (
    normalizedPath === "/v1/payment/binance-pay/webhook" ||
    normalizedPath === "/v1/payment/binance-pay"
  ) {
    return handleBinancePayWebhook(request, env, ctx);
  }

  return error("NOT_FOUND", "Binance Pay endpoint not found", 404);
}

/**
 * POST /v1/payment/binance-pay/create
 */
async function handleCreateBinancePayOrder(request: Request, env: Env): Promise<Response> {
  let session;
  try {
    session = await requireAuth(request, env.DB);
  } catch (e: any) {
    return error(e.code || "UNAUTHORIZED", e.message || "Unauthorized", e.status || 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_JSON", "Invalid JSON request body", 400);
  }

  const requestedCurrency = String(body.currency || "USD").toUpperCase().trim();
  if (requestedCurrency !== "USD") {
    return error("INVALID_CURRENCY", "Binance Pay operates exclusively in USD currency", 400);
  }

  const amountUsd = Number(body.amountUsd ?? body.amount);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return error("INVALID_AMOUNT", "Amount must be a positive USD number", 400);
  }

  // Business limits for USD deposits (min $1.00, max $10,000.00)
  if (amountUsd < 1.0) {
    return error("MINIMUM_LIMIT_ERROR", "الحد الأدنى للإيداع عبر Binance Pay هو $1.00 USD", 400);
  }
  if (amountUsd > 10000.0) {
    return error("MAXIMUM_LIMIT_ERROR", "الحد الأقصى للإيداع عبر Binance Pay هو $10,000.00 USD", 400);
  }

  const merchantTradeNo = `BP_${Date.now()}_${generateId().substring(0, 8)}`;
  const id = generateId();
  const recipientBinanceId = env.BINANCE_PAY_RECIPIENT_ID || DEFAULT_RECIPIENT_BINANCE_ID;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins expiry

  let binanceOrderId = "";
  let checkoutUrl = "";
  let qrcodeLink = "";

  // Call Binance Pay OpenAPI if API Key and Secret are configured
  if (env.BINANCE_PAY_API_KEY && env.BINANCE_PAY_SECRET) {
    try {
      const nonce = generateNonce(32);
      const timestamp = Date.now();
      const binanceReqBody = JSON.stringify({
        env: { terminalType: "WEB" },
        merchantTradeNo,
        orderAmount: Number(amountUsd.toFixed(2)),
        currency: "USD",
        goods: {
          goodsType: "02",
          goodsCategory: "6000",
          referenceGoodsId: "wallet_recharge_usd",
          goodsName: `ZAITX MEDIA Wallet Deposit $${amountUsd.toFixed(2)} USD`,
        },
      });

      const signature = await calculateBinanceSignature(
        env.BINANCE_PAY_SECRET,
        timestamp,
        nonce,
        binanceReqBody
      );

      const bResponse = await fetch(`${BINANCE_PAY_BASE_URL}/binancepay/openapi/v2/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "BinancePay-Timestamp": String(timestamp),
          "BinancePay-Nonce": nonce,
          "BinancePay-Certificate-SN": env.BINANCE_PAY_API_KEY,
          "BinancePay-Signature": signature,
        },
        body: binanceReqBody,
      });

      const bData = (await bResponse.json().catch(() => ({}))) as any;
      if (bResponse.ok && bData.status === "SUCCESS" && bData.data) {
        binanceOrderId = String(bData.data.prepayId || bData.data.orderId || "");
        checkoutUrl = String(bData.data.checkoutUrl || bData.data.universalUrl || "");
        qrcodeLink = String(bData.data.qrcodeLink || bData.data.qrContent || "");
      }
    } catch (err) {
      console.error("Binance Pay API Create Order call failed:", err);
    }
  }

  // Create deposit order in D1 database
  const serviceName = `Recharge via Binance Pay - $${amountUsd.toFixed(2)} USD`;
  await env.DB.prepare(
    `INSERT INTO orders (id, user_id, service_name, quantity, price, currency,
      payment_method, proof_of_payment, user_whatsapp, full_name, username, user_email,
      status, type, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, 'USD', 'binance_pay', ?, ?, ?, ?, ?, 'pending', 'recharge', ?, ?)`
  ).bind(
    id,
    session.user_id,
    serviceName,
    amountUsd,
    merchantTradeNo,
    session.whatsapp || null,
    session.full_name || null,
    session.username || null,
    session.email || null,
    createdAt,
    createdAt
  );

  await createAuditLog(env.DB, {
    action: "binance_pay.create_order",
    entityType: "deposit",
    entityId: id,
    newValues: {
      merchantTradeNo,
      binanceOrderId,
      amountUsd,
      currency: "USD",
      userId: session.user_id,
    },
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("User-Agent"),
    result: "success",
  });

  return json({
    success: true,
    data: {
      depositId: id,
      merchantTradeNo,
      binanceOrderId: binanceOrderId || merchantTradeNo,
      recipientBinanceId,
      amountUsd,
      currency: "USD",
      status: "pending",
      checkoutUrl,
      qrcodeLink,
      createdAt,
      expiresAt,
    },
  });
}

/**
 * POST /v1/payment/binance-pay/query
 */
async function handleQueryBinancePayOrder(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error("INVALID_JSON", "Invalid JSON request body", 400);
  }

  const merchantTradeNo = String(body.merchantTradeNo || body.tradeNo || "").trim();
  const binanceOrderId = String(body.binanceOrderId || body.orderId || "").trim();
  if (!merchantTradeNo && !binanceOrderId) {
    return error("MISSING_FIELDS", "merchantTradeNo or binanceOrderId is required", 400);
  }

  // Look up order in D1
  const querySql = merchantTradeNo
    ? `SELECT * FROM orders WHERE proof_of_payment = ? AND payment_method = 'binance_pay' LIMIT 1`
    : `SELECT * FROM orders WHERE id = ? AND payment_method = 'binance_pay' LIMIT 1`;
  const param = merchantTradeNo || binanceOrderId;
  const deposit = await env.DB.prepare(querySql).bind(param).first<any>();

  if (!deposit) {
    return error("NOT_FOUND", "Binance Pay deposit request not found", 404);
  }

  // If already confirmed in local DB, return current status idempotently
  if (deposit.status === "completed" || deposit.status === "paid" || deposit.status === "confirmed") {
    return json({
      success: true,
      data: {
        depositId: deposit.id,
        merchantTradeNo: deposit.proof_of_payment,
        status: "confirmed",
        amountUsd: deposit.price,
        currency: "USD",
        alreadyProcessed: true,
      },
    });
  }

  // Query Binance Pay API if secrets configured
  if (env.BINANCE_PAY_API_KEY && env.BINANCE_PAY_SECRET) {
    try {
      const nonce = generateNonce(32);
      const timestamp = Date.now();
      const binanceReqBody = JSON.stringify({
        merchantTradeNo: deposit.proof_of_payment,
      });

      const signature = await calculateBinanceSignature(
        env.BINANCE_PAY_SECRET,
        timestamp,
        nonce,
        binanceReqBody
      );

      const bResponse = await fetch(`${BINANCE_PAY_BASE_URL}/binancepay/openapi/v2/order/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "BinancePay-Timestamp": String(timestamp),
          "BinancePay-Nonce": nonce,
          "BinancePay-Certificate-SN": env.BINANCE_PAY_API_KEY,
          "BinancePay-Signature": signature,
        },
        body: binanceReqBody,
      });

      const bData = (await bResponse.json().catch(() => ({}))) as any;
      if (bResponse.ok && bData.status === "SUCCESS" && bData.data) {
        const bStatus = String(bData.data.status || "");
        const bAmount = Number(bData.data.totalFee ?? bData.data.orderAmount);
        const bCurrency = String(bData.data.currency || "USD").toUpperCase();

        const mappedStatus = mapBinanceStatusToInternal(bStatus);

        if (mappedStatus === "confirmed") {
          // Verify USD currency & exact USD amount matching
          if (bCurrency === "USD" && amountsMatchUsd(deposit.price, bAmount)) {
            await confirmBinancePayDeposit(env, deposit, bData.data);
            return json({
              success: true,
              data: {
                depositId: deposit.id,
                merchantTradeNo: deposit.proof_of_payment,
                status: "confirmed",
                amountUsd: deposit.price,
                currency: "USD",
                confirmedNow: true,
              },
            });
          } else {
            // Mismatch in amount or currency -> manual review
            await env.DB.prepare(
              `UPDATE orders SET status = 'manual_review', updated_at = datetime('now') WHERE id = ?`
            ).bind(deposit.id).run();

            return json({
              success: true,
              data: {
                depositId: deposit.id,
                merchantTradeNo: deposit.proof_of_payment,
                status: "manual_review",
                amountUsd: deposit.price,
                receivedAmountUsd: bAmount,
                currency: bCurrency,
                reason: "AMOUNT_OR_CURRENCY_MISMATCH",
              },
            });
          }
        }
      }
    } catch (err) {
      console.error("Binance Pay Query API call failed:", err);
    }
  }

  return json({
    success: true,
    data: {
      depositId: deposit.id,
      merchantTradeNo: deposit.proof_of_payment,
      status: deposit.status,
      amountUsd: deposit.price,
      currency: "USD",
    },
  });
}

/**
 * POST /v1/payment/binance-pay/webhook (and POST /v1/payment/binance-pay)
 */
async function handleBinancePayWebhook(
  request: Request,
  env: Env,
  ctx?: ExecutionContext
): Promise<Response> {
  const timestamp = request.headers.get("BinancePay-Timestamp") || request.headers.get("x-binance-timestamp");
  const nonce = request.headers.get("BinancePay-Nonce") || request.headers.get("x-binance-nonce");
  const signature = request.headers.get("BinancePay-Signature") || request.headers.get("x-binance-signature");

  const rawBody = await request.text();

  // Verify signature if secret is configured
  if (env.BINANCE_PAY_SECRET) {
    const isSignatureValid = await verifyBinanceWebhookSignature(
      env.BINANCE_PAY_SECRET,
      timestamp,
      nonce,
      rawBody,
      signature
    );

    if (!isSignatureValid) {
      console.warn("Binance Pay Webhook signature verification failed!");
      return error("INVALID_SIGNATURE", "Invalid Binance Pay signature", 401);
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return error("INVALID_JSON", "Invalid JSON payload", 400);
  }

  const data = payload.data || payload;
  let merchantTradeNo = String(data.merchantTradeNo || payload.merchantTradeNo || "").trim();
  let binanceOrderId = String(data.binanceOrderId || data.bizId || payload.binanceOrderId || "").trim();
  let receivedAmount = Number(data.totalFee ?? data.orderAmount ?? payload.totalFee);
  let receivedCurrency = String(data.currency || payload.currency || "USD").toUpperCase();
  let binanceStatus = String(data.bizStatus || data.status || payload.bizStatus || payload.status || "");

  // Fallback for SMS Forwarder app payloads (containing text / body field)
  const smsText = String(payload.text || payload.body || payload.message || data.text || "").trim();
  if (smsText) {
    const parsedSms = parseBinanceSms(smsText);
    if (parsedSms.merchantTradeNo && !merchantTradeNo) {
      merchantTradeNo = parsedSms.merchantTradeNo;
    }
    if (parsedSms.amountUsd !== null && (!receivedAmount || isNaN(receivedAmount))) {
      receivedAmount = parsedSms.amountUsd;
    }
    if (!binanceStatus) {
      binanceStatus = "PAID";
    }
  }

  if (!merchantTradeNo) {
    return error("MISSING_MERCHANT_TRADE_NO", "merchantTradeNo missing from payload or SMS text", 400);
  }

  // Find deposit request in D1
  const deposit = await env.DB.prepare(
    `SELECT * FROM orders WHERE proof_of_payment = ? AND payment_method = 'binance_pay' LIMIT 1`
  ).bind(merchantTradeNo).first<any>();

  if (!deposit) {
    console.warn(`Binance Pay deposit not found for merchantTradeNo: ${merchantTradeNo}`);
    return error("DEPOSIT_NOT_FOUND", "Deposit request not found", 404);
  }

  // IDEMPOTENCY: If already processed, return 200 OK without double crediting
  if (deposit.status === "completed" || deposit.status === "paid" || deposit.status === "confirmed") {
    console.log(`Binance Pay duplicate webhook ignored for ${merchantTradeNo}`);
    return json({
      success: true,
      message: "Duplicate webhook ignored - deposit already confirmed",
      idempotency: true,
    });
  }

  const mappedStatus = mapBinanceStatusToInternal(binanceStatus);

  if (mappedStatus === "confirmed") {
    // 1. Verify currency is USD
    if (receivedCurrency !== "USD") {
      console.error(`Binance Pay currency mismatch: Expected USD, received ${receivedCurrency}`);
      await env.DB.prepare(
        `UPDATE orders SET status = 'manual_review', updated_at = datetime('now') WHERE id = ?`
      ).bind(deposit.id).run();
      return json({ success: true, status: "manual_review", reason: "CURRENCY_MISMATCH" });
    }

    // 2. Verify amount matching in integer cents
    if (!amountsMatchUsd(deposit.price, receivedAmount)) {
      console.error(`Binance Pay amount mismatch: Expected ${deposit.price} USD, received ${receivedAmount} USD`);
      await env.DB.prepare(
        `UPDATE orders SET status = 'manual_review', updated_at = datetime('now') WHERE id = ?`
      ).bind(deposit.id).run();
      return json({ success: true, status: "manual_review", reason: "AMOUNT_MISMATCH" });
    }

    // 3. All checks passed -> Confirm deposit & credit balance atomically
    await confirmBinancePayDeposit(env, deposit, data);
    return json({ success: true, status: "confirmed", amountUsd: deposit.price });
  } else if (mappedStatus === "failed" || mappedStatus === "expired") {
    await env.DB.prepare(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(mappedStatus, deposit.id).run();
    return json({ success: true, status: mappedStatus });
  }

  return json({ success: true, status: deposit.status });
}

/**
 * Atomically confirm deposit & credit user balance
 */
async function confirmBinancePayDeposit(env: Env, deposit: any, payloadData: any) {
  const now = new Date().toISOString();
  const txId = generateId();

  // Atomically update order status & credit balance in D1
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE orders SET status = 'completed', updated_at = ? WHERE id = ? AND status != 'completed'`
    ).bind(now, deposit.id),
    env.DB.prepare(
      `UPDATE users SET balance_usd = balance_usd + ?, updated_at = ? WHERE id = ?`
    ).bind(deposit.price, now, deposit.user_id),
  ]);

  await createAuditLog(env.DB, {
    action: "binance_pay.deposit_confirmed",
    entityType: "user",
    entityId: deposit.user_id,
    newValues: {
      depositId: deposit.id,
      merchantTradeNo: deposit.proof_of_payment,
      binanceOrderId: payloadData?.binanceOrderId || payloadData?.bizId,
      amountUsd: deposit.price,
      currency: "USD",
    },
    result: "success",
  });
}
