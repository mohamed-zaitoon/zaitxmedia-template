const { FazerCardsClient } = require('fazercards');
const api = new FazerCardsClient({ apiKey: 'fc_3d63caeaf24c2cd1a28ac314' });

async function test() {
  try {
    const fs = require('fs');
    const catalog = [];
    for await (const item of api.catalog.listAll()) {
      catalog.push(item);
    }
    fs.writeFileSync('fazercards_full_catalog.json', JSON.stringify(catalog, null, 2));
    console.log("Done. Total items:", catalog.length);
  } catch (err) {
    console.error(err);
  }
}

test();
