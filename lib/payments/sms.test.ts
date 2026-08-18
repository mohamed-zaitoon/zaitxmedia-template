import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeForwarderTimestamp,
  normalizeSubmittedReference,
  parsePaymentSms,
  paymentSmsIsNewer,
  paymentSmsMatchesOrder,
} from "./sms";

describe("payment SMS verification", () => {
  it("parses Vodafone sender variations and normalizes the phone", () => {
    const parsed = parsePaymentSms(
      "Vodafone Cash",
      "تم استلام مبلغ 500.00 ج.م من 01012345678 عبر فودافون كاش. رقم العملية: 123456789",
    );
    assert.equal(parsed?.provider, "vodafone");
    assert.equal(parsed?.amountMinor, 50000);
    assert.equal(parsed?.payerPhone, "01012345678");
  });

  it("parses Arabic numerals in Vodafone messages", () => {
    const parsed = parsePaymentSms(
      "VF-CASH",
      "استلمت ١٠٠٠.٠٠ جنيه من ٠١٢٥٥٥٥٥٥٥٥. رقم العملية ٩٨٧٦٥٤٣٢١",
    );
    assert.equal(parsed?.amountMinor, 100000);
    assert.equal(parsed?.payerPhone, "01255555555");
  });

  it("parses the short Vodafone receipt format used on the gateway phone", () => {
    const parsed = parsePaymentSms(
      "VF-CASH",
      "تم استلام مبلغ 100 جنيه من رقم 01060795179",
    );
    assert.equal(parsed?.provider, "vodafone");
    assert.equal(parsed?.amountMinor, 10000);
    assert.equal(parsed?.payerPhone, "01060795179");
  });

  it("matches only exact provider, amount and payer identity", () => {
    const parsed = parsePaymentSms(
      "VF-CASH",
      "تم استلام مبلغ 75.50 جنيه من 01112222333 عبر محفظة فودافون",
    )!;
    const order = {
      paymentStatus: "verifying",
      expectedPaymentAmountMinor: 7550,
      paymentMethodKey: "vodafone",
      payerPhoneNormalized: "+201112222333",
    };
    assert.equal(paymentSmsMatchesOrder(parsed, order), true);
    assert.equal(
      paymentSmsMatchesOrder(parsed, { ...order, expectedPaymentAmountMinor: 7500 }),
      false,
    );
  });

  it("normalizes submitted InstaPay references", () => {
    assert.equal(normalizeSubmittedReference("instapay", " Ref# ab-١٢٣ "), "AB-123");
  });

  it("normalizes Android Forwarder timestamps supplied as strings", () => {
    assert.equal(normalizeForwarderTimestamp("1722400000000"), 1722400000000);
    assert.equal(normalizeForwarderTimestamp("1722400000"), 1722400000000);
  });

  it("treats only the latest SMS from the same payer as newer", () => {
    const oldMessage = {
      sourceReceivedAtMillis: 1722400000000,
      storedAtMillis: 1722400001000,
    };
    const newMessage = {
      sourceReceivedAtMillis: "1722400300000",
      storedAtMillis: 1722400301000,
    };
    assert.equal(paymentSmsIsNewer(newMessage, oldMessage), true);
    assert.equal(paymentSmsIsNewer(oldMessage, newMessage), false);
  });

  it("uses ingestion time when Forwarder timestamps are unavailable", () => {
    assert.equal(
      paymentSmsIsNewer(
        { sourceReceivedAtMillis: null, storedAtMillis: 1722400301000 },
        { sourceReceivedAtMillis: null, storedAtMillis: 1722400001000 },
      ),
      true,
    );
  });

  it("parses Vodafone Cash received SMS from VF-Cash", () => {
    const text = "تم استلام مبلغ 3780.00 جنيه من رقم 01146634446 المسجل بإسم Adel A Elsaid على رقم محفظتك 01060795179. رصيدك الحالي: 7724.28 جنيه تاريخ العملية: 22:46 26-07-24 رقم العملية: 022027464280 تابع كل مصروفاتك من تاريخ المعاملات على أبلكيشن أنا فودافون http://vf.eg/vfcash";
    const parsed = parsePaymentSms("VF-Cash", text);
    assert.equal(parsed?.provider, "vodafone");
    assert.equal(parsed?.amountMinor, 378000);
    assert.equal(parsed?.payerPhone, "01146634446");
    assert.equal(parsed?.reference, "022027464280");
  });

  it("parses Barq transfer received SMS from VF-Cash", () => {
    const text = "تم استلام مبلغ 9272.52 جنيه من ؛ المسجل بإسم MOHAMMED ABDULLAH MOHAMMED ZUQAYL على رقم محفظتك 01060795179 بتاريخ 23:25 26-07-13. رصيدك الحالي: 10006.28 جنيه رقم العملية: 021696831839 تقدر تتابع كل مصروفاتك من تاريخ المعاملات على أبلكيشن أنا فودافون http://vf.eg/vfcash";
    const parsed = parsePaymentSms("VF-Cash", text);
    assert.equal(parsed?.provider, "barq");
    assert.equal(parsed?.amountMinor, 927252);
    assert.equal(parsed?.payerName, "mohammed abdullah mohammed zuqayl");
    assert.equal(parsed?.reference, "021696831839");
  });

  it("parses Mashreq-EGY IPN SMS", () => {
    const text = "لقد استقبلت تحويل لحظي على 3916 بمبلغ 1.00 جم عبر IPN من HATEM BAHY ELDIEN MO يوم 14-08-2026 الساعة 19:18 رقم المعاملة 162d228c للمساعدة www.mashreq.com/mashreqipn";
    const parsed = parsePaymentSms("Mashreq-EGY", text);
    assert.equal(parsed?.provider, "instapay");
    assert.equal(parsed?.amountMinor, 100);
    assert.equal(parsed?.reference, "162D228C");
  });

  it("parses Mashreq NEO IPN SMS", () => {
    const text = "لقد استقبلت تحويل لحظي على 3916 بمبلغ 1.00 جم عبر IPN من HATEM BAHY ELDIEN MO يوم 14-08-2026 الساعة 19:18 رقم المعاملة 162d228c للمساعدة www.mashreq.com/mashreqipn";
    const parsed = parsePaymentSms("Mashreq NEO", text);
    assert.equal(parsed?.provider, "instapay");
    assert.equal(parsed?.amountMinor, 100);
    assert.equal(parsed?.reference, "162D228C");
  });
});

