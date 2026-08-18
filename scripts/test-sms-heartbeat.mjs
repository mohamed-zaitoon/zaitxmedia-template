const url = process.argv[2] || 'http://localhost:3000/api/v1/payment/gateway';

console.log(`Sending Heartbeat to: ${url}`);

fetch(url, {
  method: 'GET',
  headers: {
    'User-Agent': 'Incoming SMS Gateway/1.0',
  }
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
