import crypto from 'crypto';

const secret = process.env.SMS_WEBHOOK_SECRET || 'test_secret';
const url = process.argv[2] || 'http://localhost:3000/api/webhook/payment-sms';
const type = process.argv[3] || 'vfcash';

let text = '';
if (type === 'vfcash') {
  text = `تم استلام مبلغ 3780.00 جنيه من رقم 01146634446 المسجل بإسم Adel A Elsaid على رقم محفظتك 01060795179.
رصيدك الحالي: 7724.28 جنيه
تاريخ العملية: 22:46 26-07-24
رقم العملية: 022027464280`;
} else {
  text = `تم استلام مبلغ 9272.52 جنيه من ؛
المسجل بإسم MOHAMMED ABDULLAH MOHAMMED ZUQAYL
على رقم محفظتك 01060795179 بتاريخ 23:25 26-07-13.
رصيدك الحالي: 10006.28 جنيه
رقم العملية: 021696831839`;
}

const payload = {
  from: "VF-Cash",
  text,
  sentStamp: Date.now() - 5000,
  receivedStamp: Date.now(),
  sim: "sim1",
  appVersion: "1.0",
  battery: 80,
  network: "LTE"
};

const rawBody = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

console.log(`Sending to: ${url}`);
console.log(`Secret: ${secret}`);
console.log(`Body Length: ${rawBody.length}`);
console.log(`HMAC: ${hmac}`);

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': hmac
  },
  body: rawBody
})
.then(res => {
  console.log(`Status: ${res.status}`);
  return res.text();
})
.then(txt => {
  console.log(`Response: ${txt}`);
})
.catch(err => {
  console.error(`Error:`, err);
});
