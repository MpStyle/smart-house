import type { Measurement } from './Measurement';

export interface Room { id: string; name: string; measurements: Measurement[] }
