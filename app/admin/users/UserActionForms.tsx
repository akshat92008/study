"use client";

import React from 'react';

export function UserActionForms({ userId }: { userId: string }) {
  const input = <input type="hidden" name="targetUserId" value={userId} />;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <form method="post" action="/api/admin/users/grant-beta" onSubmit={(e) => { if (!confirm('Grant beta?')) e.preventDefault(); }}>
        {input}
        <button type="submit">Grant beta</button>
      </form>
      <form method="post" action="/api/admin/users/revoke-beta" onSubmit={(e) => { if (!confirm('Revoke beta?')) e.preventDefault(); }}>
        {input}
        <button type="submit">Revoke</button>
      </form>
      <form method="post" action="/api/admin/users/suspend" onSubmit={(e) => { if (!confirm('Suspend user?')) e.preventDefault(); }}>
        {input}
        <input name="reason" placeholder="Pause reason" style={{ width: 120 }} />
        <button type="submit">Suspend</button>
      </form>
      <form method="post" action="/api/admin/users/unsuspend" onSubmit={(e) => { if (!confirm('Unsuspend user?')) e.preventDefault(); }}>
        {input}
        <button type="submit">Unsuspend</button>
      </form>
      <form method="post" action="/api/admin/users/set-plan" onSubmit={(e) => { if (!confirm('Change plan?')) e.preventDefault(); }}>
        {input}
        <select name="plan" defaultValue="free">
          <option value="free">free</option>
          <option value="founding">founding</option>
          <option value="pro">pro</option>
          <option value="admin">admin</option>
          <option value="unlimited">unlimited</option>
        </select>
        <button type="submit">Set plan</button>
      </form>
      <form method="post" action="/api/admin/users/reset-onboarding" onSubmit={(e) => { if (!confirm('Reset onboarding?')) e.preventDefault(); }}>
        {input}
        <button type="submit" style={{ background: '#f59e0b', color: 'white', border: 'none' }}>Reset Onboarding</button>
      </form>
      <form method="post" action="/api/admin/users/delete" onSubmit={(e) => { if (!confirm('DANGER: Delete user data?')) e.preventDefault(); }}>
        {input}
        <button type="submit" style={{ background: '#ef4444', color: 'white', border: 'none' }}>Delete</button>
      </form>
      <form method="post" action="/api/admin/users/retry-dlq" onSubmit={(e) => { if (!confirm('Retry user DLQ events?')) e.preventDefault(); }}>
        {input}
        <button type="submit" style={{ background: '#3b82f6', color: 'white', border: 'none' }}>Retry Failed Events</button>
      </form>
    </div>
  );
}
