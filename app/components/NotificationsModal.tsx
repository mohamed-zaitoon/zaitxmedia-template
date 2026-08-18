"use client";

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { X, Bell } from "lucide-react";

export default function NotificationsModal({ userProfile, onClose }: any) {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!userProfile?.id) return;
    const fetch = () => {
      getDocs(
        query(
          collection(db, "notifications"),
          where("user_id", "==", userProfile.id),
          orderBy("created_at", "desc"),
          limit(50),
        ),
      ).then((s) =>
        setNotifications(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      );
    };
    fetch();
    const i = setInterval(fetch, 10000);
    return () => clearInterval(i);
  }, [userProfile?.id]);

  const markRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllRead = async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (ids.length) {
      const batch = writeBatch(db);
      ids.forEach((id) =>
        batch.update(doc(db, "notifications", id), { read: true }),
      );
      await batch.commit();
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dir="rtl"
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: 16,
          maxWidth: 500,
          width: "90%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #333",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Bell color="#38bdf8" />
            <h2 style={{ margin: 0, fontSize: 20 }}>الإشعارات</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
            }}
          >
            <X />
          </button>
        </div>
        <div
          style={{
            padding: "12px 24px",
            display: "flex",
            justifyContent: "flex-end",
            borderBottom: "1px solid #222",
          }}
        >
          <button
            onClick={markAllRead}
            style={{
              background: "none",
              border: "none",
              color: "#38bdf8",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            تحديد الكل كمقروء
          </button>
        </div>
        <div
          style={{
            padding: 24,
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {notifications.length === 0 ? (
            <div
              style={{ textAlign: "center", color: "#666", padding: "40px 0" }}
            >
              <Bell size={48} color="#333" style={{ marginBottom: 16 }} />
              <div>لا توجد إشعارات</div>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                style={{
                  background: n.read ? "#222" : "rgba(68,170,255,0.1)",
                  border: `1px solid ${n.read ? "#333" : "rgba(68,170,255,0.3)"}`,
                  padding: 16,
                  borderRadius: 12,
                  cursor: n.read ? "default" : "pointer",
                  position: "relative",
                }}
              >
                {!n.read && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#38bdf8",
                    }}
                  ></div>
                )}
                <div style={{ paddingRight: !n.read ? 16 : 0 }}>
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      color: n.read ? "#ddd" : "#fff",
                    }}
                  >
                    {n.title}
                  </h4>
                  <p style={{ margin: 0, color: "#aaa", fontSize: 14 }}>
                    {n.body}
                  </p>
                  {n.created_at && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                      {new Date(n.created_at).toLocaleString("en-US")}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
