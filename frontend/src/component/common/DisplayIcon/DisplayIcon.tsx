import { Box } from '@mui/material';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import WeekendOutlined from '@mui/icons-material/WeekendOutlined';
import BedOutlined from '@mui/icons-material/BedOutlined';
import KitchenOutlined from '@mui/icons-material/KitchenOutlined';
import BathtubOutlined from '@mui/icons-material/BathtubOutlined';
import YardOutlined from '@mui/icons-material/YardOutlined';
import DeskOutlined from '@mui/icons-material/DeskOutlined';
import type { DisplayIcon as IconValue } from '../../../entity/DashboardCustomization';

const icons = {
  home: HomeOutlined, apartment: ApartmentOutlined, living: WeekendOutlined, bedroom: BedOutlined,
  kitchen: KitchenOutlined, bathroom: BathtubOutlined, garden: YardOutlined, office: DeskOutlined,
};

export default function DisplayIcon({ icon }: { icon?: IconValue }) {
  if (icon?.kind === 'image') return <Box component="img" src={icon.data} alt="" aria-hidden="true"
    sx={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />;
  const Icon = icons[icon?.name ?? 'home'];
  return <Icon aria-hidden="true" sx={{ color: 'primary.main', flexShrink: 0 }} />;
}
