import ThermostatOutlined from '@mui/icons-material/ThermostatOutlined';
import Co2 from '@mui/icons-material/Co2';
import GraphicEq from '@mui/icons-material/GraphicEq';
import WaterDropOutlined from '@mui/icons-material/WaterDropOutlined';
import Air from '@mui/icons-material/Air';
import WbSunnyOutlined from '@mui/icons-material/WbSunnyOutlined';

interface MetricIconProps { kind: string }

export default function MetricIcon({ kind }: MetricIconProps) {
  if (kind.toLowerCase().includes('temperature')) return <ThermostatOutlined />;
  if (kind === 'co2') return <Co2 />;
  if (kind === 'noise') return <GraphicEq />;
  if (kind === 'humidity' || kind.startsWith('rain')) return <WaterDropOutlined />;
  if (kind.toLowerCase().includes('wind') || kind.startsWith('gust')) return <Air />;
  return <WbSunnyOutlined />;
}
