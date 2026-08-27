export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`.aiBalance { display: none !important; }`}</style>
      {children}
    </>
  );
}
