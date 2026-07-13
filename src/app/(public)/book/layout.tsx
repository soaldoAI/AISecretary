export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-app text-app">
      {children}
    </div>
  );
}
