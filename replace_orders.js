const fs = require('fs');

const file = 'app/account/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const newOrdersSection = `function OrdersSection({ user }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchOrdersAndRecharges = async () => {
      try {
        const [ordersSnap, rechargesSnap] = await Promise.all([
          getDocs(query(collection(db, "orders"), where("user_id", "==", user.id), orderBy("created_at", "desc"), limit(50))),
          getDocs(query(collection(db, "recharges"), where("userId", "==", user.id), orderBy("createdAt", "desc"), limit(50)))
        ]);

        const ordersList = ordersSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            type: "order",
            title: data.service_name || "طلب خدمة",
            amount: data.price,
            currency: data.currency || "EGP",
            quantity: data.quantity,
            status: data.status,
            date: data.created_at ? new Date(data.created_at).getTime() : 0,
            dateStr: data.created_at ? new Date(data.created_at).toLocaleString("ar-EG") : "الآن"
          };
        });

        const getRechargeStatus = (status: string) => {
           if (status === "awaiting_payment" || status === "matching" || status === "manual_review" || status === "pending") return "pending";
           if (status === "verified" || status === "approved") return "completed";
           if (status === "expired" || status === "rejected") return "rejected";
           return status;
        };

        const rechargesList = rechargesSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            type: "recharge",
            title: "شحن رصيد",
            amount: data.amount,
            currency: "ج.م",
            method: data.method === "barq" ? "برق" : data.method === "instapay" ? "انستاباي" : "فودافون كاش",
            status: getRechargeStatus(data.status),
            date: data.createdAt ? data.createdAt.toMillis() : 0,
            dateStr: data.createdAt ? data.createdAt.toDate().toLocaleString("ar-EG") : "الآن"
          };
        });

        const merged = [...ordersList, ...rechargesList].sort((a, b) => b.date - a.date);
        setItems(merged);
      } catch (e) {
        console.error("Error fetching items:", e);
      }
      setLoading(false);
    };

    fetchOrdersAndRecharges();
  }, [user]);

  const statusInfo = (s: string) => {
    switch (s) {
      case "completed":
        return { color: "#00ff80", text: "مكتمل", icon: <CheckCircle size={14} /> };
      case "rejected":
        return { color: "#ff4444", text: "مرفوض", icon: <XCircle size={14} /> };
      default:
        return { color: "#38bdf8", text: "قيد المراجعة", icon: <Clock size={14} /> };
    }
  };

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
        جاري تحميل الطلبات...
      </div>
    );

  return (
    <div style={{ background: "#151515", padding: 28, borderRadius: 16, border: "1px solid #222" }}>
      <h2 style={{ color: "#38bdf8", margin: "0 0 20px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <Package size={20} /> طلباتي <span style={{ fontSize: 13, color: "#888", fontWeight: 400 }}>({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
          <AlertCircle size={48} color="#333" style={{ margin: "0 auto 12px" }} />
          <div>لا توجد طلبات سابقة</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => {
            const s = statusInfo(item.status);
            const isRecharge = item.type === "recharge";
            const borderColor = isRecharge ? "#a855f7" : s.color;
            
            return (
              <div
                key={item.id}
                style={{
                  background: "#1a1a1a",
                  borderRadius: 12,
                  padding: 16,
                  borderRight: \`4px solid \${borderColor}\`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isRecharge && <Wallet size={16} color="#a855f7" />}
                    <strong style={{ fontSize: 15, color: isRecharge ? "#a855f7" : "#fff" }}>{item.title}</strong>
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: s.color, fontSize: 12, background: "rgba(0,0,0,0.3)", padding: "4px 10px", borderRadius: 20 }}>
                    {s.icon} {s.text}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#888" }}>
                  <span>
                    المبلغ: <strong style={{ color: "#38bdf8" }}>{item.amount} {item.currency}</strong>
                  </span>
                  {isRecharge ? (
                    <span>الوسيلة: {item.method}</span>
                  ) : (
                    <span>الكمية: {item.quantity}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                  {item.dateStr}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}`;

const startRegex = /function OrdersSection\(\{\s*user\s*\}\s*:\s*any\)\s*\{/;
const startIndex = content.search(startRegex);
if (startIndex !== -1) {
  // Find the end of OrdersSection. It ends right before `const inputStyle`
  const endIndex = content.indexOf('const inputStyle', startIndex);
  if (endIndex !== -1) {
    const newContent = content.substring(0, startIndex) + newOrdersSection + '\n\n' + content.substring(endIndex);
    fs.writeFileSync(file, newContent);
    console.log("Success");
  } else {
    console.log("Could not find endIndex");
  }
} else {
  console.log("Could not find startIndex");
}
