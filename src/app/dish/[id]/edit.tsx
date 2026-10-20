import { useLocalSearchParams } from 'expo-router';
import { DishForm } from '../../../ui/DishForm';

export default function EditDishRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DishForm key={id} id={id} />;
}
