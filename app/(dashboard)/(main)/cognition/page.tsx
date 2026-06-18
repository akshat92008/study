import { redirect } from 'next/navigation';

export default function AtlasPageRedirect() {
  redirect('/dashboard?drawer=cognition');
}
