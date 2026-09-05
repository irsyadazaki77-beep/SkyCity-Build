import React, { useMemo } from 'react';
import { CityState, TileType } from '../types';
import { AlertTriangle, ZapOff, Droplets, Factory, ShieldAlert, HeartPulse } from 'lucide-react';

interface NotificationToastProps {
  gameState: CityState;
}

export interface CityAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  icon: React.ReactNode;
}

export function NotificationToast({ gameState }: NotificationToastProps) {
  const alerts = useMemo(() => {
    const list: CityAlert[] = [];

    // Check for power shortage
    if (gameState.powerCapacity < gameState.powerDemand && gameState.powerDemand > 0) {
      list.push({
        id: 'power-shortage',
        type: 'error',
        title: 'Power Grid Overloaded',
        message: `${gameState.powerDemand - gameState.powerCapacity} MW capacity deficit. Build Power Plants.`,
        icon: <ZapOff size={16} className="text-amber-400" />,
      });
    }

    // Check for water shortage
    if (gameState.waterCapacity < gameState.waterDemand && gameState.waterDemand > 0) {
      list.push({
        id: 'water-shortage',
        type: 'error',
        title: 'Water Supply Shortage',
        message: `${gameState.waterDemand - gameState.waterCapacity} gal deficit. Construct Water Pumps.`,
        icon: <Droplets size={16} className="text-cyan-400" />,
      });
    }

    // Check high pollution
    if (gameState.pollutionAverage > 30) {
      list.push({
        id: 'high-pollution',
        type: 'warning',
        title: 'High City Pollution',
        message: `Average AQI is ${gameState.pollutionAverage}. Plant Parks to filter toxic zones.`,
        icon: <Factory size={16} className="text-red-400" />,
      });
    }

    // Check unemployment
    if (gameState.unemploymentRate > 20 && gameState.population > 10) {
      list.push({
        id: 'high-unemployment',
        type: 'warning',
        title: 'Unemployment Spike',
        message: `${gameState.unemploymentRate}% citizens seeking work. Zone Commercial or Industrial.`,
        icon: <AlertTriangle size={16} className="text-yellow-400" />,
      });
    }

    // Check high crime rate
    if (gameState.crimeRate > 25) {
      list.push({
        id: 'high-crime',
        type: 'warning',
        title: 'Crime Wave Detected',
        message: `Crime rate at ${gameState.crimeRate}%. Deploy Police Stations.`,
        icon: <ShieldAlert size={16} className="text-purple-400" />,
      });
    }

    return list.slice(0, 3); // Show top 3 critical issues
  }, [gameState]);

  if (alerts.length === 0) return null;

  return (
    <div className="absolute top-20 right-6 z-30 flex flex-col gap-2 max-w-sm pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`pointer-events-auto p-3 rounded-xl border shadow-xl flex items-start gap-3 backdrop-blur transition-all duration-300 ${
            alert.type === 'error'
              ? 'bg-red-950/80 border-red-500/40 text-red-200'
              : 'bg-amber-950/80 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="p-1.5 rounded-lg bg-black/40 shrink-0">{alert.icon}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">{alert.title}</h4>
            <p className="text-[10px] opacity-85 leading-tight mt-0.5">{alert.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
