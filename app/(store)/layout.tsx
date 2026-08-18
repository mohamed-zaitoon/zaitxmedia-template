import StoreLayoutClient from "./StoreLayoutClient";

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreLayoutClient>{children}</StoreLayoutClient>;
}
