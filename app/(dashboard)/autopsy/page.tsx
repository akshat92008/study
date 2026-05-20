import { redirect } from 'next/navigation';

export default async function MockAutopsyPage() {
  redirect('/dashboard');
}
