import { adminDb } from "./app/lib/firebase-admin";

async function check() {
  const orderId = "k5fbF6u4hwNXPbErad8l";
  const orderSnap = await adminDb.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) {
    console.log("Order does not exist!");
    return;
  }
  console.log("Order exists!", orderSnap.data());
  
  const userId = orderSnap.data()?.user_id;
  if (!userId) {
    console.log("Order has no user_id");
    return;
  }
  
  const profileSnap = await adminDb.collection("profiles").doc(userId).get();
  if (!profileSnap.exists) {
    console.log("Profile does not exist for user:", userId);
  } else {
    console.log("Profile exists!", profileSnap.data());
  }
}

check();
