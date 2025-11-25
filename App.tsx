import { MindMapView } from '@/views/MindMapView';
import { useMindMapViewModel } from '@/viewmodels/useMindMapViewModel';

export default function App() {
  const viewModel = useMindMapViewModel();
  return <MindMapView viewModel={viewModel} />;
}
