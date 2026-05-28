'use client';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {children}
    </div>
  );
}
