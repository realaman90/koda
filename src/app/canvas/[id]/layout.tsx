export default function CanvasLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh w-dvw overflow-hidden">{children}</div>;
}
