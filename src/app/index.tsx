import { DishList } from '../ui/DishList';
import { useApp } from '../ui/context';

export default function DishListRoute() {
  const { filters, setFilters } = useApp();
  return <DishList filters={filters} setFilters={setFilters} />;
}
