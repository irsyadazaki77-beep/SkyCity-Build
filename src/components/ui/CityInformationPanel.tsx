import React, { useState } from 'react';
import { 
  X, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Shield, 
  Activity, 
  Car, 
  Leaf, 
  Zap,
  Droplet,
  Trash2,
  GraduationCap,
  HeartPulse
} from 'lucide-react';
import { HistoryRecord } from '../../types';

interface CityInformationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Props from engine
  population: number;
  households: number;
  workers: number;
  employment: number;
  unemploymentRate: number;
  availableJobs: number;
  
  money: number;
  income: number;
  expenses: number;
  residentialTaxRate: number;
  commercialTaxRate: number;
  industrialTaxRate: number;
  onTaxChange: (type: 'residential' | 'commercial' | 'industrial', val: number) => void;
  
  powerDemand: number;
  powerCapacity: number;
  waterDemand: number;
  waterCapacity: number;
  wasteProduction: number;
  wasteCapacity: number;
  wasteCoverage: number;
  
  trafficAverage: number;
  averageCommuteTime: number;
  congestionIndex: number;
  
  happiness: number;
  crimeRate: number;
  fireSafety: number;
  healthcareCoverage: number;
  educationCoverage: number;
  educationLevel: number;
  healthIndex: number;
  
  landValueAverage: number;
  pollutionAverage: number;
  noiseAverage: number;
  desirability: number;
  
  residentialDemand: number;
  commercialDemand: number;
  industrialDemand: number;
  
  history: HistoryRecord[];
}

type TabType = 'OVERVIEW' | 'POPULATION' | 'ECONOMY' | 'SERVICES' | 'TRAFFIC' | 'ENVIRONMENT';

export function CityInformationPanel(props: CityInformationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');

  if (!props.isOpen) return null;

  const renderTabButton = (tab: TabType, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        activeTab === tab
          ? 'bg-blue-500/20 text-blue-300 font-semibold'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="absolute top-16 left-4 bottom-24 w-80 bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col pointer-events-auto z-40 overflow-hidden animate-in slide-in-from-left-4 duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
        <h2 className="text-white font-bold text-lg">City Information</h2>
        <button onClick={props.onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-black/10">
        {renderTabButton('OVERVIEW', <TrendingUp size={16} />, 'Overview')}
        {renderTabButton('POPULATION', <Users size={16} />, 'Population')}
        {renderTabButton('ECONOMY', <DollarSign size={16} />, 'Economy')}
        {renderTabButton('SERVICES', <Shield size={16} />, 'Services')}
        {renderTabButton('TRAFFIC', <Car size={16} />, 'Traffic')}
        {renderTabButton('ENVIRONMENT', <Leaf size={16} />, 'Environment')}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'OVERVIEW' && <OverviewTab {...props} />}
        {activeTab === 'POPULATION' && <PopulationTab {...props} />}
        {activeTab === 'ECONOMY' && <EconomyTab {...props} />}
        {activeTab === 'SERVICES' && <ServicesTab {...props} />}
        {activeTab === 'TRAFFIC' && <TrafficTab {...props} />}
        {activeTab === 'ENVIRONMENT' && <EnvironmentTab {...props} />}
      </div>
    </div>
  );
}

// --- Tab Components ---

function OverviewTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-6">
      <Section title="City Demands">
        <DemandBar label="Residential" value={props.residentialDemand} color="bg-emerald-500" />
        <DemandBar label="Commercial" value={props.commercialDemand} color="bg-blue-500" />
        <DemandBar label="Industrial" value={props.industrialDemand} color="bg-yellow-500" />
      </Section>
      
      <Section title="Key Metrics">
        <MetricRow label="Population" value={props.population.toLocaleString()} />
        <MetricRow label="Happiness" value={`${props.happiness}%`} />
        <MetricRow label="Treasury" value={`$${props.money.toLocaleString()}`} />
        <MetricRow label="Net Income" value={`$${(props.income - props.expenses).toLocaleString()}`} color={(props.income - props.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
      </Section>
    </div>
  );
}

function PopulationTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-4">
      <MetricRow label="Total Population" value={props.population.toLocaleString()} />
      <MetricRow label="Households" value={props.households.toLocaleString()} />
      <MetricRow label="Total Workers" value={props.workers.toLocaleString()} />
      <MetricRow label="Available Jobs" value={props.availableJobs.toLocaleString()} />
      <MetricRow label="Employment Rate" value={`${props.employment.toFixed(1)}%`} />
      <MetricRow label="Unemployment Rate" value={`${props.unemploymentRate.toFixed(1)}%`} color={props.unemploymentRate > 10 ? 'text-red-400' : 'text-emerald-400'} />
    </div>
  );
}

function EconomyTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-6">
      <Section title="Budget">
        <MetricRow label="Income" value={`$${props.income.toLocaleString()}`} color="text-emerald-400" />
        <MetricRow label="Expenses" value={`$${props.expenses.toLocaleString()}`} color="text-red-400" />
        <div className="h-[1px] bg-white/10 my-2"></div>
        <MetricRow label="Net Profit" value={`$${(props.income - props.expenses).toLocaleString()}`} color={(props.income - props.expenses) >= 0 ? 'text-emerald-400' : 'text-red-400'} />
      </Section>

      <Section title="Taxation">
        <TaxSlider label="Residential Tax" value={props.residentialTaxRate} onChange={(v) => props.onTaxChange('residential', v)} color="emerald" />
        <TaxSlider label="Commercial Tax" value={props.commercialTaxRate} onChange={(v) => props.onTaxChange('commercial', v)} color="blue" />
        <TaxSlider label="Industrial Tax" value={props.industrialTaxRate} onChange={(v) => props.onTaxChange('industrial', v)} color="yellow" />
      </Section>
    </div>
  );
}

function ServicesTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-4">
      <Section title="Utilities">
        <ProgressBar label="Electricity Usage" value={props.powerDemand} max={props.powerCapacity || 1} format={(v) => `${Math.round(v)} MW`} color={props.powerDemand > props.powerCapacity ? 'bg-red-500' : 'bg-yellow-500'} />
        <ProgressBar label="Water Usage" value={props.waterDemand} max={props.waterCapacity || 1} format={(v) => `${Math.round(v)} kL`} color={props.waterDemand > props.waterCapacity ? 'bg-red-500' : 'bg-cyan-500'} />
        <ProgressBar label="Waste Capacity" value={props.wasteProduction} max={props.wasteCapacity || 1} format={(v) => `${Math.round(v)} T`} color={props.wasteProduction > props.wasteCapacity ? 'bg-red-500' : 'bg-stone-500'} />
      </Section>
      <Section title="City Services">
        <MetricRow label="Healthcare Coverage" value={`${props.healthcareCoverage}%`} />
        <MetricRow label="Education Coverage" value={`${props.educationCoverage}%`} />
        <MetricRow label="Fire Safety" value={`${props.fireSafety}%`} />
        <MetricRow label="Crime Rate" value={`${props.crimeRate}%`} color={props.crimeRate > 30 ? 'text-red-400' : 'text-gray-300'} />
      </Section>
    </div>
  );
}

function TrafficTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-4">
      <MetricRow label="Average Traffic Flow" value={`${Math.max(0, 100 - props.trafficAverage).toFixed(1)}%`} />
      <MetricRow label="Congestion Index" value={`${props.congestionIndex.toFixed(1)}`} />
      <MetricRow label="Avg Commute Time" value={`${props.averageCommuteTime.toFixed(1)} min`} />
    </div>
  );
}

function EnvironmentTab(props: CityInformationPanelProps) {
  return (
    <div className="space-y-4">
      <MetricRow label="Average Land Value" value={`$${props.landValueAverage.toFixed(0)} /m²`} color="text-emerald-400" />
      <MetricRow label="Overall Desirability" value={`${props.desirability.toFixed(1)}%`} />
      <MetricRow label="Ground Pollution" value={`${props.pollutionAverage.toFixed(1)}%`} color={props.pollutionAverage > 20 ? 'text-red-400' : 'text-gray-300'} />
      <MetricRow label="Noise Pollution" value={`${props.noiseAverage.toFixed(1)}%`} />
    </div>
  );
}

// --- Helper UI Components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, color = 'text-gray-100' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function DemandBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = Math.min(100, Math.max(0, value)) + '%';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width }}></div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max, format, color }: { label: string; value: number; max: number; format: (v: number) => string; color: string }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">{format(value)} / {format(max)}</span>
      </div>
      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

function TaxSlider({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'accent-emerald-500',
    blue: 'accent-blue-500',
    yellow: 'accent-yellow-500',
  };
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-300">{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <input 
        type="range" 
        min="1" max="20" 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full ${colorMap[color] || 'accent-white'}`}
      />
    </div>
  );
}
