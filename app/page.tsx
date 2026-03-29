import { redirect } from 'next/navigation';
import { integrationRoutes } from '@/lib/routes';

export default function Home() {
  redirect(integrationRoutes.admin);
}
