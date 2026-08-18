import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      dir="rtl"
    >
      <SignUp routing="hash" />
    </div>
  );
}
