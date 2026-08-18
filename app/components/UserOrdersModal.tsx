"use client";

import { useState, useEffect } from "react";
import {
  X,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

export default function UserOrdersModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    fetch("/api/orders?limit=50", {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((result) => setOrders(result.orders || []))
      .finally(() => setLoading(false));
  }, [userId]);

  const getStatus = (s: string) => {
    switch (s) {
      case "completed":
        return {
          color: "#00ff80",
          text: "مكتمل",
          icon: <CheckCircle size={16} />,
        };
      case "rejected":
        return { color: "#ff4444", text: "مرفوض", icon: <XCircle size={16} /> };
      default:
        return {
          color: "#38bdf8",
          text: "قيد المراجعة",
          icon: <Clock size={16} />,
        };
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dir="rtl"
    >
      <div
        className="graffiti-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%",
          maxWidth: 500,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#111",
          padding: 24,
          borderRadius: 16,
          border: "1px solid #333",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: -24,
            background: "#111",
            paddingBottom: 16,
            borderBottom: "1px solid #333",
            marginBottom: 16,
            zIndex: 10,
            paddingTop: 24,
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 24,
              left: 0,
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
            }}
          >
            <X size={24} />
          </button>
          <h2
            style={{
              color: "#38bdf8",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Package size={24} /> طلباتي
          </h2>
        </div>
        {loading ? (
          <div
            style={{ color: "#aaa", textAlign: "center", padding: "40px 0" }}
          >
            جاري تحميل الطلبات...
          </div>
        ) : orders.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "40px 0", color: "#aaa" }}
          >
            <AlertCircle size={48} color="#333" style={{ marginBottom: 16 }} />
            <div>لا توجد طلبات سابقة.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.map((order) => {
              const s = getStatus(order.status);
              return (
                <div
                  key={order.id}
                  style={{
                    background: "#222",
                    borderRadius: 12,
                    padding: 16,
                    borderRight: `4px solid ${s.color}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ color: "#fff", fontSize: 16 }}>
                      {order.service_name}
                    </strong>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        color: s.color,
                        fontSize: 12,
                        background: "rgba(0,0,0,0.2)",
                        padding: "4px 8px",
                        borderRadius: 20,
                      }}
                    >
                      {s.icon} {s.text}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                      color: "#888",
                    }}
                  >
                    <span>
                      المبلغ:{" "}
                      <strong style={{ color: "#38bdf8" }}>
                        {order.price} {order.currency}
                      </strong>
                    </span>
                    <span>الكمية: {order.quantity}</span>
                  </div>
                  {order.created_at && (
                    <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
                      {new Date(order.created_at).toLocaleString("en-US")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
