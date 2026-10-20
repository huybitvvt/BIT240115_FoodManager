import { useLocalSearchParams } from 'expo-router';
import { DishDetail } from '../../../ui/DishDetail';

export default function DishDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DishDetail key={id} id={id} />;
}
