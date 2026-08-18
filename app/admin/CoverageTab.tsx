import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, orderBy, limit, serverTimestamp, addDoc } from "firebase/firestore";
import { Shield, Save, RefreshCw, AlertCircle, TrendingUp, DollarSign, DownloadCloud } from "lucide-react";
import Swal from "sweetalert2";

function ceilTo2Decimals(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  const normalized = Math.round(val * 1e8) / 1e8;
  return Math.ceil(normalized * 100 - 1e-9) / 100;
}

const inp = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const btnSm = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
};

const Card = ({ title, children, action }: any) => (
  <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: 24, marginBottom: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

export function CoverageTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    liabilityUsd: 0,
    liabilityEgp: 0,
    allocatedReserve: 0,
    coveragePercent: 0,
    surplusUsd: 0,
    deficitUsd: 0,
    usersCount: 0,
    usdRate: 55,
    topUsers: []
  });
  const [reserveSettings, setReserveSettings] = useState({
    source: "manual",
    manualReserveUsdt: "0",
    targetCoverage: "105",
    minCoverage: "100",
  });
  
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateVal, setUpdateVal] = useState("");
  const [updateNote, setUpdateNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncingBinance, setSyncingBinance] = useState(false);

  const [showBinanceModal, setShowBinanceModal] = useState(false);
  const [binanceKey, setBinanceKey] = useState("");
  const [binanceSecret, setBinanceSecret] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get settings
      const settingsSnap = await getDoc(doc(db, "settings", "pricing"));
      const usdRate = Number(settingsSnap.exists() ? (settingsSnap.data().usd_rate || 55) : 55);

      const reserveSnap = await getDoc(doc(db, "settings", "reserve"));
      let rSet = { source: "manual", manualReserveUsdt: "0", targetCoverage: "105", minCoverage: "100", binanceApiKey: "", binanceApiSecret: "" };
      if (reserveSnap.exists()) {
        rSet = { ...rSet, ...reserveSnap.data() };
      }
      setReserveSettings(rSet);
      setBinanceKey(rSet.binanceApiKey || "");
      setBinanceSecret(rSet.binanceApiSecret || "");

      // Fetch users balance
      const usersSnap = await getDocs(query(collection(db, "profiles"), where("role", "!=", "admin")));
      let totalLiability = 0;
      let count = 0;
      let allUsers: any[] = [];
      
      usersSnap.forEach(d => {
        const u = d.data();
        const bal = Number(u.balance) || 0;
        if (bal > 0) {
          totalLiability += bal;
          count++;
          allUsers.push({ id: d.id, name: u.name, email: u.email, balance: bal });
        }
      });
      
      allUsers.sort((a, b) => b.balance - a.balance);

      const allocated = Number(rSet.manualReserveUsdt) || 0;
      const coverage = totalLiability > 0 ? (allocated / totalLiability) * 100 : 0;
      const surplus = allocated - totalLiability;
      const deficit = totalLiability > allocated ? totalLiability - allocated : 0;

      setData({
        liabilityUsd: totalLiability,
        liabilityEgp: totalLiability * usdRate,
        allocatedReserve: allocated,
        coveragePercent: coverage,
        surplusUsd: surplus,
        deficitUsd: deficit,
        usersCount: count,
        usdRate: usdRate,
        topUsers: allUsers.slice(0, 10),
        allUsers
      });

      // Fetch latest snapshots
      const snapsQuery = query(collection(db, "reserve_snapshots"), orderBy("createdAt", "desc"), limit(5));
      const snapsRes = await getDocs(snapsQuery);
      setSnapshots(snapsRes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateReserve = async () => {
    const val = Number(updateVal);
    if (isNaN(val) || val < 0) return Swal.fire("خطأ", "قيمة غير صالحة", "error");
    
    setSaving(true);
    try {
      const oldVal = reserveSettings.manualReserveUsdt;
      const newSettings = { ...reserveSettings, manualReserveUsdt: String(val) };
      await setDoc(doc(db, "settings", "reserve"), newSettings, { merge: true });
      
      // Audit log
      await addDoc(collection(db, "reserve_audit_logs"), {
        action: "update_manual_reserve",
        oldValue: oldVal,
        newValue: String(val),
        note: updateNote,
        adminId: "admin", 
        timestamp: serverTimestamp()
      });
      
      setReserveSettings(newSettings);
      setShowUpdateModal(false);
      setUpdateVal("");
      setUpdateNote("");
      
      // Auto save snapshot
      await saveSnapshot(val);

      fetchData();
      Swal.fire("نجاح", "تم تحديث الاحتياطي بنجاح", "success");
    } catch (e) {
      Swal.fire("خطأ", "حدث خطأ أثناء الحفظ", "error");
    }
    setSaving(false);
  };

  const saveSnapshot = async (allocatedOverride?: number) => {
    const alloc = allocatedOverride !== undefined ? allocatedOverride : data.allocatedReserve;
    const coverage = data.liabilityUsd > 0 ? (alloc / data.liabilityUsd) * 100 : 0;
    const surplus = alloc - data.liabilityUsd;
    
    await addDoc(collection(db, "reserve_snapshots"), {
      customerLiabilityUsd: data.liabilityUsd,
      allocatedReserveUsdt: alloc,
      coveragePercent: coverage,
      surplusDeficitUsd: surplus,
      displayExchangeRateEgp: data.usdRate,
      source: reserveSettings.source,
      createdAt: serverTimestamp()
    });
  };

  const handleManualSnapshot = async () => {
    setSaving(true);
    try {
      await saveSnapshot();
      await fetchData();
      Swal.fire("نجاح", "تم حفظ اللقطة بنجاح", "success");
    } catch (e) {
      Swal.fire("خطأ", "حدث خطأ أثناء حفظ اللقطة", "error");
    }
    setSaving(false);
  };

  const syncBinance = async () => {
    setSyncingBinance(true);
    try {
      const res = await fetch("/api/admin/reserve/binance", {
        credentials: "include",
        cache: "no-store",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to fetch binance data");
      
      Swal.fire({
        icon: "success",
        title: "نجاح المزامنة",
        html: `رصيد Binance USDT المتاح: <b>${result.balance}</b><br>يرجى تحديث قيمة الاحتياطي المخصص يدوياً بناءً على هذا الرقم إن رغبت.`
      });
    } catch (e: any) {
      Swal.fire("خطأ", e.message || "حدث خطأ أثناء مزامنة Binance", "error");
    }
    setSyncingBinance(false);
  };

  if (loading) return <div>جاري تحميل بيانات التغطية...</div>;

  const target = Number(reserveSettings.targetCoverage);
  const minCov = Number(reserveSettings.minCoverage);
  const status = data.coveragePercent >= target ? "آمن" : (data.coveragePercent >= minCov ? "مغطى (احتياطي منخفض)" : "عجز تغطية");
  const color = data.coveragePercent >= target ? "#10b981" : (data.coveragePercent >= minCov ? "#f59e0b" : "#ef4444");

  return (
    <div style={{ width: "100%", fontFamily: "Cairo" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.2)", padding: 20, borderRadius: 16 }}>
          <div style={{ color: "#38bdf8", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={20} /> إجمالي التزامات العملاء
          </div>
          <div style={{ fontSize: 28, fontWeight: "bold" }}>${data.liabilityUsd.toFixed(2)}</div>
          <div style={{ color: "#888", fontSize: 13 }}>≈ {data.liabilityEgp.toLocaleString()} ج.م</div>
        </div>
        
        <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", padding: 20, borderRadius: 16 }}>
          <div style={{ color: "#10b981", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={20} /> الاحتياطي المخصص
          </div>
          <div style={{ fontSize: 28, fontWeight: "bold" }}>${data.allocatedReserve.toFixed(2)}</div>
          <div style={{ color: "#888", fontSize: 13 }}>المصدر: {reserveSettings.source === "manual" ? "يدوي" : "Binance API"}</div>
        </div>
        
        <div style={{ background: `rgba(${data.coveragePercent >= target ? '16,185,129' : '239,68,68'},0.05)`, border: `1px solid ${color}55`, padding: 20, borderRadius: 16 }}>
          <div style={{ color, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={20} /> نسبة التغطية
          </div>
          <div style={{ fontSize: 28, fontWeight: "bold", color }}>{data.liabilityUsd === 0 ? "N/A" : `${data.coveragePercent.toFixed(2)}%`}</div>
          <div style={{ color: "#888", fontSize: 13 }}>{status}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
        <div style={{ background: "#111", border: "1px solid #222", padding: 20, borderRadius: 16 }}>
          <div style={{ color: "#aaa", marginBottom: 4, fontSize: 13 }}>الفائض أو العجز</div>
          <div style={{ fontSize: 20, fontWeight: "bold", color: data.surplusUsd >= 0 ? "#10b981" : "#ef4444" }}>
            {data.surplusUsd >= 0 ? "+" : ""}{data.surplusUsd.toFixed(2)}$
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            الفائض لا يمثل ربحاً صافياً بالضرورة.
          </div>
        </div>
        <div style={{ background: "#111", border: "1px solid #222", padding: 20, borderRadius: 16 }}>
          <div style={{ color: "#aaa", marginBottom: 4, fontSize: 13 }}>عدد العملاء برصيد موجب</div>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>{data.usersCount} عميل</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={() => setShowUpdateModal(true)} style={{ ...btnSm, background: "#38bdf8", color: "#000", border: "none" }}><RefreshCw size={16}/> تحديث الاحتياطي اليدوي</button>
        <button onClick={syncBinance} disabled={syncingBinance} style={{ ...btnSm, background: "#10b981", color: "#fff", border: "none" }}><DownloadCloud size={16}/> {syncingBinance ? "جاري الاتصال بـ Binance..." : "قراءة رصيد Binance"}</button>
        <button onClick={() => setShowBinanceModal(true)} style={btnSm}><AlertCircle size={16}/> إعدادات Binance</button>
        <button onClick={handleManualSnapshot} disabled={saving} style={btnSm}><Save size={16}/> {saving ? "جاري החفظ..." : "حفظ لقطة الآن"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
        <Card title="أكبر أرصدة العملاء">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", textAlign: "right", color: "#888" }}>
                <th style={{ padding: "8px 0" }}>العميل</th>
                <th style={{ padding: "8px 0" }}>الرصيد ($)</th>
              </tr>
            </thead>
            <tbody>
              {data.topUsers.slice(0, 5).map((u: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "8px 0" }}>{u.email}</td>
                  <td style={{ padding: "8px 0", color: "#38bdf8", fontWeight: "bold" }}>${ceilTo2Decimals(Number(u.balance))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="السجل التاريخي (Snapshots)">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", textAlign: "right", color: "#888" }}>
                <th style={{ padding: "8px 0" }}>التاريخ</th>
                <th style={{ padding: "8px 0" }}>التغطية</th>
                <th style={{ padding: "8px 0" }}>الاحتياطي ($)</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "8px 0", color: "#888" }}>
                    {s.createdAt?.toDate ? new Date(s.createdAt.toDate()).toLocaleString("en-US") : "—"}
                  </td>
                  <td style={{ padding: "8px 0", color: s.coveragePercent >= target ? "#10b981" : "#ef4444" }}>
                    {Number(s.coveragePercent || 0).toFixed(1)}%
                  </td>
                  <td style={{ padding: "8px 0" }}>${Number(s.allocatedReserveUsdt || 0).toFixed(2)}</td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr><td colSpan={3} style={{ padding: "16px 0", textAlign: "center", color: "#666" }}>لا توجد لقطات مسجلة</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {showUpdateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#111", border: "1px solid #333", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowUpdateModal(false)}
              style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,0.08)", border: "none", color: "#aaa", cursor: "pointer", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              title="إغلاق"
            >
              ✕
            </button>
            <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>تحديث احتياطي USDT</h3>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#888" }}>الرصيد المخصص الجديد (USDT)</label>
            <input 
              type="number" 
              style={{ ...inp, marginBottom: 16 }} 
              value={updateVal} 
              onChange={e => setUpdateVal(e.target.value)} 
              placeholder="مثال: 500"
            />
            
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#888" }}>ملاحظة (اختياري)</label>
            <input 
              type="text" 
              style={{ ...inp, marginBottom: 24 }} 
              value={updateNote} 
              onChange={e => setUpdateNote(e.target.value)} 
              placeholder="سبب التحديث..."
            />
            
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={handleUpdateReserve}
                disabled={saving}
                style={{ flex: 1, background: "#38bdf8", color: "#000", border: "none", padding: 12, borderRadius: 12, fontWeight: "bold", cursor: "pointer" }}
              >
                {saving ? "جاري الحفظ..." : "حفظ التحديث"}
              </button>
              <button 
                onClick={() => setShowUpdateModal(false)}
                style={{ flex: 1, background: "transparent", color: "#fff", border: "1px solid #333", padding: 12, borderRadius: 12, cursor: "pointer" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showBinanceModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#111", border: "1px solid #333", borderRadius: 16, padding: 24, width: "100%", maxWidth: 500, position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowBinanceModal(false)}
              style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,0.08)", border: "none", color: "#aaa", cursor: "pointer", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              title="إغلاق"
            >
              ✕
            </button>
            <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>إعدادات مفاتيح Binance</h3>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              يفضل وضع المفاتيح في متغيرات البيئة (Environment Variables) لزيادة الأمان. إذا لم تتمكن من ذلك، يمكنك إدخالها هنا كبديل احتياطي (Fallback). يجب أن يكون المفتاح للقراءة فقط (Read-only).
            </p>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#aaa" }}>API Key</label>
            <input 
              type="text" 
              style={{ ...inp, marginBottom: 16, fontFamily: "monospace" }} 
              value={binanceKey} 
              onChange={e => setBinanceKey(e.target.value)} 
              placeholder="مثال: abcdef..."
            />
            
            <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#aaa" }}>API Secret</label>
            <input 
              type="password" 
              style={{ ...inp, marginBottom: 24, fontFamily: "monospace" }} 
              value={binanceSecret} 
              onChange={e => setBinanceSecret(e.target.value)} 
              placeholder="••••••••••••••••••••••••"
            />
            
            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={async () => {
                  setSaving(true);
                  try {
                    await setDoc(doc(db, "settings", "reserve"), { 
                      binanceApiKey: binanceKey, 
                      binanceApiSecret: binanceSecret 
                    }, { merge: true });
                    Swal.fire("نجاح", "تم حفظ إعدادات Binance كبديل احتياطي", "success");
                    setShowBinanceModal(false);
                  } catch (e) {
                    Swal.fire("خطأ", "حدث خطأ أثناء الحفظ", "error");
                  }
                  setSaving(false);
                }}
                disabled={saving}
                style={{ flex: 1, background: "#10b981", color: "#fff", border: "none", padding: 12, borderRadius: 12, fontWeight: "bold", cursor: "pointer" }}
              >
                {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </button>
              <button 
                onClick={() => setShowBinanceModal(false)}
                style={{ flex: 1, background: "transparent", color: "#fff", border: "1px solid #333", padding: 12, borderRadius: 12, cursor: "pointer" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
