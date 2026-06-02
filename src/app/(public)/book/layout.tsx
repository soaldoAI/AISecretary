export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gray-950 text-white">
      {children}
    </div>
  );
}
