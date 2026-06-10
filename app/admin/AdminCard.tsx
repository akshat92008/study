'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

export function AdminCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        style={{
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          const card = e.currentTarget.querySelector('[data-card]');
          if (card) {
            (card as HTMLElement).style.transform = 'translateY(-4px)';
            (card as HTMLElement).style.boxShadow = 'var(--shadow-glow-blue)';
          }
        }}
        onMouseLeave={(e) => {
          const card = e.currentTarget.querySelector('[data-card]');
          if (card) {
            (card as HTMLElement).style.transform = 'translateY(0)';
            (card as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
          }
        }}
      >
        <Card
          variant="glass"
          data-card="true"
          style={{
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          <CardHeader>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-3)',
              color: 'var(--accent-blue)',
            }}>
              {icon}
            </div>
            <CardTitle style={{ marginTop: 'var(--sp-3)' }}>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p style={{
              margin: 0,
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
            }}>{description}</p>
          </CardContent>
        </Card>
      </div>
    </Link>
  );
}