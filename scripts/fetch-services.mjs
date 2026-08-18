import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';

async function fetchServices() {
  const smmApiKey = "077165ff996d9362426837606a01130c";
  const fazerApiKey = "fc_3d63caeaf24c2cd1a28ac314";
  
  let allServices = [];

  try {
    console.log("Fetching SMM services from smmxmedia.com...");
    const form = new URLSearchParams();
    form.append("key", smmApiKey);
    form.append("action", "services");

    let data = [];
    try {
      const res = await fetch("https://smmxmedia.com/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      data = await res.json();
    } catch(e) {
      console.log("Failed to fetch SMMX, using local cache.");
      if (fs.existsSync('public/services.json')) {
        const old = JSON.parse(fs.readFileSync('public/services.json', 'utf8'));
        data = old.filter(s => !s.isFazer);
      }
    }
    
    if (Array.isArray(data)) {
      const filtered = data.filter(s => 
        !(s.name.includes("شحن") && s.name.includes("تيك توك")) &&
        !(s.category.includes("شحن") && s.category.includes("تيك توك")) &&
        !s.category.toLowerCase().includes("ببجي") &&
        !s.category.toLowerCase().includes("pubg")
      ).map(s => ({
        ...s,
        name: s.name.replace(/smmxmedia/gi, "ZAITX MEDIA").replace(/smmx/gi, "ZAITX MEDIA").replace(/إكــس ميــديا/g, "ZAITX MEDIA").replace(/إكس ميديا/g, "ZAITX MEDIA").replace(/اكس ميديا/g, "ZAITX MEDIA"),
        category: s.category.replace(/smmxmedia/gi, "ZAITX MEDIA").replace(/smmx/gi, "ZAITX MEDIA").replace(/إكــس ميــديا/g, "ZAITX MEDIA").replace(/إكس ميديا/g, "ZAITX MEDIA").replace(/اكس ميديا/g, "ZAITX MEDIA")
      }));
      allServices.push(...filtered);
      console.log(`Successfully pulled ${filtered.length} SMM services`);
    } else {
      console.error("Invalid response from SMM:", data);
    }

    console.log(`Successfully processed SMM services`);
    
    const outputPath = path.join(process.cwd(), 'public', 'services.json');
    fs.writeFileSync(outputPath, JSON.stringify(allServices, null, 2));
    console.log(`Successfully saved ${allServices.length} total services to public/services.json`);
    
  } catch (error) {
    console.error("Failed to fetch services:", error);
    process.exit(1);
  }
}

fetchServices();
