import { EmptyState } from '../ui/common';
import { useApp } from '../ui/context';

export default function NotFoundRoute() {
  const { t } = useApp();
  return <EmptyState title={t('notFound')} hint={t('notFoundHint')} />;
}
