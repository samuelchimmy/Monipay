import { getNavigation } from '@/lib/navigation';
import { SidebarClient } from './SidebarClient';

export function SidebarNav({ className }: { className?: string }) {
  const navigation = getNavigation();
  return <SidebarClient navigation={navigation} className={className} />;
}
