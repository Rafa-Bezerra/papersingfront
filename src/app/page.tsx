// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  // assim que alguém acessar "/", será enviado para "/login"
  redirect('/login');
}
