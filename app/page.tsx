import { redirect } from 'next/navigation';
import { passRoutes } from '@/lib/routes';

export default function Home() {
  redirect(passRoutes.services);
}
