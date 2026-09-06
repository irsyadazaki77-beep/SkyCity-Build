import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TileType, CityState, BUILD_COSTS, TileData, GraphicsQualityTier } from './types';
import { createEmptyGrid, GRID_WIDTH, GRID_HEIGHT } from './engine';
import { MILESTONES, CityMilestone } from './progression';
import { GAME_CONFIG } from './config';
import { useSimulationController } from './state/useSimulationController';

// Modular UI Components
import { NotificationToast } from './components/NotificationToast';
import { TreasuryModal } from './components/TreasuryModal';
import { City3DCanvas } from './components/world/City3DCanvas';
import { GameHUD } from './components/ui/GameHUD';
import { BottomToolbar } from './components/ui/BottomToolbar';
import { CityInformationPanel } from './components/ui/CityInformationPanel';
import { InfoViewsToolbar } from './components/ui/InfoViewsToolbar';
import { BuildingInspector } from './components/ui/BuildingInspector';
import { CursorTooltip } from './components/ui/CursorTooltip';
import { OverlayMode } from './types';

// Progression & Save System Components
import { TechTreeModal } from './components/TechTreeModal';
import { PoliciesModal } from './components/PoliciesModal';
import { MissionsModal } from './components/MissionsModal';
import { SaveLoadModal } from './components/SaveLoadModal';
import { MilestoneBanner } from './components/MilestoneBanner';

// Custom UI Components & Debug HUD
import { SettingsModal } from './components/ui/SettingsModal';
import { NotificationCenter, NotificationItem } from './components/ui/NotificationCenter';
import { DeveloperDebugHUD } from './components/ui/DeveloperDebugHUD';

export function isBuildingUnlocked(type: TileType, milestoneLevel: number): boolean {
  switch (type) {
    case TileType.ROAD:
    case TileType.RESIDENTIAL:
    case TileType.COMMERCIAL:
    case TileType.INDUSTRIAL:
      return true;
    case TileType.POWER_PLANT:
    case TileType.WATER_PUMP:
      return true;
    case TileType.CLINIC:
      return milestoneLevel >= 1;
    case TileType.POLICE_STATION:
      return milestoneLevel >= 2;
    case TileType.FIRE_STATION:
      return milestoneLevel >= 3;
    case TileType.SCHOOL:
      return milestoneLevel >= 4;
    case TileType.WASTE_MANAGEMENT:
      return milestoneLevel >= 5;
    default:
      return true;
  }
}

export default function App() {
  const initialCityState: CityState = {
    grid: createEmptyGrid(),
    money: GAME_CONFIG.STARTING_MONEY,
    population: 0,
    milestoneLevel: 0,
    activePolicies: [],
    activeEvents: [],
    completedMissions: [],
    unlockedAchievements: [],
    day: 1,
    powerCapacity: 0,
    powerDemand: 0,
    waterCapacity: 0,
    waterDemand: 0,
    trafficAverage: 0,
    averageCommuteTime: 0,
    congestionIndex: 0,
    income: 0,
    expenses: 0,
    unlockedUpgrades: [],
    households: 0,
    workers: 0,
    employment: 0,
    unemploymentRate: 0,
    availableJobs: 0,
    residentialDemand: 50,
    commercialDemand: 40,
    industrialDemand: 40,
    desirability: 50,
    residentialTaxRate: 9,
    commercialTaxRate: 9,
    industrialTaxRate: 9,
    history: [],
    happiness: 50,
    healthcareCoverage: 0,
    educationCoverage: 0,
    fireSafety: 100,
    crimeRate: 35,
    wasteCapacity: 0,
    wasteProduction: 0,
    wasteCoverage: 80,
    landValueAverage: 35,
    pollutionAverage: 0,
    noiseAverage: 0,
    educationLevel: 0,
    healthIndex: 50,
    buildingLevelCounts: {
      residential: [0, 0, 0, 0, 0],
      commercial: [0, 0, 0, 0, 0],
      industrial: [0, 0, 0, 0, 0],
    },
    unlockedRegions: ['1,1'],
  };

  const {
    gameState,
    setGameState,
    revisions,
    dirtyTerrainChunks,
    dirtyRoadChunks,
    dirtyBuildingChunks,
    activeVehicles,
    activePedestrians,
    metrics,
    speed,
    setSpeed,
    simulationTimeMs,
    dispatchCommand,
    isWorkerActive,
    incrementTerrainRebuildCount,
    incrementRoadRebuildCount,
    incrementBuildingBatchCount,
    setVisibleChunksCount,
  } = useSimulationController(initialCityState);

  const [activeTool, setActiveTool] = useState<TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN'>('POINTER');
  const [activeOverlay, setActiveOverlay] = useState<OverlayMode | 'NATURAL_RESOURCES'>('NONE');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQualityTier>('high');
  const [mapExpansionMode, setMapExpansionMode] = useState<boolean>(false);
  const [showTreasury, setShowTreasury] = useState<boolean>(false);
  const [showTechTree, setShowTechTree] = useState<boolean>(false);
  const [showPolicies, setShowPolicies] = useState<boolean>(false);
  const [showMissions, setShowMissions] = useState<boolean>(false);
  const [showSaveLoad, setShowSaveLoad] = useState<boolean>(false);
  const [showCityInfo, setShowCityInfo] = useState<boolean>(false);
  const [milestoneModal, setMilestoneModal] = useState<CityMilestone | null>(null);
  const [selectedTileCoords, setSelectedTileCoords] = useState<[number, number] | null>(null);

  // Custom UI & Drag States
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);

  // Developer visual inspection toggles
  const [debugChunkBoundaries, setDebugChunkBoundaries] = useState<boolean>(false);
  const [debugTerrainLOD, setDebugTerrainLOD] = useState<boolean>(false);
  const [debugRoadSegments, setDebugRoadSegments] = useState<boolean>(false);

  const prevMilestoneRef = useRef<number>(gameState.milestoneLevel ?? 0);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (e.key.toLowerCase()) {
        case '1':
          setSpeed(1);
          break;
        case '2':
          setSpeed(2);
          break;
        case '3':
          setSpeed(3);
          break;
        case '0':
        case ' ':
          e.preventDefault();
          setSpeed(speed === 0 ? 1 : 0);
          break;
        case 't':
          setShowTechTree((prev) => !prev);
          break;
        case 'p':
          setShowPolicies((prev) => !prev);
          break;
        case 'm':
          setShowMissions((prev) => !prev);
          break;
        case 'b':
          setActiveTool((prev) => (prev === 'BULLDOZER' ? 'POINTER' : 'BULLDOZER'));
          break;
        case 'escape':
          if (showTreasury) setShowTreasury(false);
          else if (showTechTree) setShowTechTree(false);
          else if (showPolicies) setShowPolicies(false);
          else if (showMissions) setShowMissions(false);
          else if (showSaveLoad) setShowSaveLoad(false);
          else if (showCityInfo) setShowCityInfo(false);
          else if (selectedTileCoords) setSelectedTileCoords(null);
          else setActiveTool('POINTER');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [speed, setSpeed, showTreasury, showTechTree, showPolicies, showMissions, showSaveLoad, showCityInfo, selectedTileCoords]);

  useEffect(() => {
    const currentLvl = gameState.milestoneLevel ?? 0;
    if (currentLvl > prevMilestoneRef.current) {
      const milestone = MILESTONES[currentLvl];
      if (milestone) {
        setMilestoneModal(milestone);
      }
      prevMilestoneRef.current = currentLvl;
    }
  }, [gameState.milestoneLevel]);

  // 3D Camera states
  const [viewMode] = useState<'2D' | '3D'>('3D');
  const [zoom] = useState<number>(1.0);
  const [pitch] = useState<number>(55);
  const [rotation] = useState<number>(-45);

  const isMouseDown = useRef(false);

  // Right-Click Cancel
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setActiveTool('POINTER');
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  const setTaxRates = useCallback((res: number, com: number, ind: number) => {
    dispatchCommand({
      type: 'SET_TAX',
      payload: { residential: res, commercial: com, industrial: ind },
    });
  }, [dispatchCommand]);

  const addSystemNotification = useCallback(
    (type: NotificationItem['type'], title: string, message: string) => {
      const id = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newNotif: NotificationItem = {
        id,
        type,
        title,
        message,
        timestamp: `Day ${gameState.day}`,
        unread: true,
      };

      setNotifications((prev) => [newNotif, ...prev].slice(0, 25));
    },
    [gameState.day]
  );

  const validateTilePlacement = useCallback(
    (grid: TileData[][], x: number, y: number, type: TileType): { valid: boolean; reason?: string } => {
      if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        return { valid: false, reason: 'Invalid terrain boundary' };
      }
      const tile = grid[y][x];

      if (!isBuildingUnlocked(type, gameState.milestoneLevel ?? 0)) {
        return { valid: false, reason: 'Requires higher City Milestone level' };
      }

      if (tile.type !== TileType.EMPTY && tile.type !== type) {
        return { valid: false, reason: 'Tile is already occupied' };
      }

      if ([TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL].includes(type)) {
        let hasRoad = false;
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
            if (grid[ny][nx].type === TileType.ROAD) {
              hasRoad = true;
              break;
            }
          }
        }
        if (!hasRoad) {
          return { valid: false, reason: 'No adjacent road connection' };
        }
      }

      return { valid: true };
    },
    [gameState.milestoneLevel]
  );

  const calculateTotalCost = useCallback(
    (tiles: [number, number][], type: TileType): number => {
      const costPerTile = BUILD_COSTS[type] || 0;
      let total = 0;
      for (const [x, y] of tiles) {
        if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
          const tile = gameState.grid[y][x];
          if (tile.type !== type) {
            total += costPerTile;
          }
        }
      }
      return total;
    },
    [gameState.grid]
  );

  const getDragPreviewTiles = useCallback((): [number, number][] => {
    if (!dragStart || !dragCurrent) return [];
    const [x1, y1] = dragStart;
    const [x2, y2] = dragCurrent;

    if (activeTool === TileType.ROAD) {
      const tiles: [number, number][] = [];
      if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) {
        const step = x1 <= x2 ? 1 : -1;
        for (let x = x1; x !== x2 + step; x += step) {
          tiles.push([x, y1]);
        }
      } else {
        const step = y1 <= y2 ? 1 : -1;
        for (let y = y1; y !== y2 + step; y += step) {
          tiles.push([x1, y]);
        }
      }
      return tiles;
    }

    if (
      activeTool === TileType.RESIDENTIAL ||
      activeTool === TileType.COMMERCIAL ||
      activeTool === TileType.INDUSTRIAL
    ) {
      const tiles: [number, number][] = [];
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push([x, y]);
        }
      }
      return tiles;
    }

    return [[x1, y1]];
  }, [dragStart, dragCurrent, activeTool]);

  const applyDragConstruction = useCallback(() => {
    if (!dragStart || !dragCurrent) return;
    const tiles = getDragPreviewTiles();
    const type = activeTool as TileType;
    const totalCost = calculateTotalCost(tiles, type);

    if (gameState.money < totalCost) {
      addSystemNotification('economy', 'Construction Failed', 'Insufficient city funds to build this selection.');
      return;
    }

    let allValid = true;
    let firstInvalidReason = '';
    for (const [x, y] of tiles) {
      const { valid, reason } = validateTilePlacement(gameState.grid, x, y, type);
      if (!valid) {
        allValid = false;
        firstInvalidReason = reason || 'Invalid location';
        break;
      }
    }

    if (!allValid) {
      addSystemNotification('utilities', 'Placement Prevented', `Could not construct selection: ${firstInvalidReason}`);
      return;
    }

    if (type === TileType.ROAD) {
      dispatchCommand({
        type: 'BUILD_ROAD',
        payload: { tiles, cost: totalCost },
      });
    } else {
      dispatchCommand({
        type: 'BUILD_ZONE',
        payload: { tiles, type, cost: totalCost },
      });
    }
  }, [dragStart, dragCurrent, activeTool, gameState, getDragPreviewTiles, calculateTotalCost, validateTilePlacement, addSystemNotification, dispatchCommand]);

  const applyBulldoze = useCallback((x: number, y: number) => {
    dispatchCommand({
      type: 'BULLDOZE',
      payload: { tiles: [[x, y]], cost: 0 },
    });
  }, [dispatchCommand]);

  const validateAndPlaceSingleTile = useCallback(
    (x: number, y: number, type: TileType) => {
      const { valid, reason } = validateTilePlacement(gameState.grid, x, y, type);
      if (!valid) {
        addSystemNotification('utilities', 'Placement Blocked', `Could not construct: ${reason}`);
        return;
      }
      const cost = BUILD_COSTS[type] || 0;
      if (gameState.money < cost) {
        addSystemNotification('economy', 'Insufficient Funds', 'You do not have enough funds to construct this building.');
        return;
      }

      if (type === TileType.ROAD) {
        dispatchCommand({
          type: 'BUILD_ROAD',
          payload: { tiles: [[x, y]], cost },
        });
      } else {
        dispatchCommand({
          type: 'BUILD_ZONE',
          payload: { tiles: [[x, y]], type, cost },
        });
      }
    },
    [gameState.grid, gameState.money, validateTilePlacement, addSystemNotification, dispatchCommand]
  );

  const applyTerraforming = useCallback(
    (cx: number, cy: number, tool: string) => {
      const tiles: [number, number][] = [];
      const radius = brushSize - 1;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx >= 0 && tx < GRID_WIDTH && ty >= 0 && ty < GRID_HEIGHT) {
            tiles.push([tx, ty]);
          }
        }
      }
      const totalCost = tiles.length * 15;
      if (gameState.money < totalCost) {
        addSystemNotification('economy', 'Insufficient Funds', 'Terraforming requires $15 per tile.');
        return;
      }

      const centerElevation = gameState.grid[cy]?.[cx]?.elevation || 0;

      dispatchCommand({
        type: 'TERRAFORM',
        payload: {
          tiles,
          tool,
          cost: totalCost,
          centerElevation,
        },
      });
    },
    [brushSize, gameState.money, gameState.grid, addSystemNotification, dispatchCommand]
  );

  const handleUnlockRegion = useCallback(
    (rx: number, ry: number) => {
      const cost = 50000;
      if (gameState.money < cost) {
        addSystemNotification('economy', 'Insufficient Funds', 'Unlocking a new region requires $50,000.');
        return;
      }
      const key = `${rx},${ry}`;
      if (gameState.unlockedRegions?.includes(key)) return;

      dispatchCommand({
        type: 'UNLOCK_REGION',
        payload: { rx, ry },
      });
      addSystemNotification('milestone', 'Region Unlocked!', `Purchased and unlocked sector coordinate [${rx}, ${ry}]!`);
    },
    [gameState.money, gameState.unlockedRegions, addSystemNotification, dispatchCommand]
  );

  const handleTileAction = useCallback(
    (x: number, y: number) => {
      if (activeTool === 'POINTER') {
        setSelectedTileCoords([x, y]);
        return;
      }

      if (['RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'].includes(activeTool as any)) {
        applyTerraforming(x, y, activeTool as string);
        return;
      }

      if (activeTool === 'BULLDOZER') {
        setDragStart([x, y]);
        applyBulldoze(x, y);
        return;
      }

      if ([TileType.ROAD, TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL].includes(activeTool as TileType)) {
        setDragStart([x, y]);
        setDragCurrent([x, y]);
        return;
      }

      validateAndPlaceSingleTile(x, y, activeTool as TileType);
    },
    [activeTool, validateAndPlaceSingleTile, applyBulldoze, applyTerraforming]
  );

  const handleTilePointerEnter = useCallback(
    (x: number, y: number) => {
      if (dragStart) {
        if (activeTool === 'BULLDOZER') {
          applyBulldoze(x, y);
        } else {
          setDragCurrent([x, y]);
        }
      }
    },
    [dragStart, activeTool, applyBulldoze]
  );

  // Mouse drag listeners
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        isMouseDown.current = true;
      }
    };
    const handlePointerUp = () => {
      isMouseDown.current = false;
      if (dragStart) {
        if (activeTool !== 'BULLDOZER') {
          applyDragConstruction();
        }
        setDragStart(null);
        setDragCurrent(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragStart, activeTool, applyDragConstruction]);

  const handleNewCity = useCallback(() => {
    const freshGrid = createEmptyGrid();
    const freshState: CityState = {
      grid: freshGrid,
      money: GAME_CONFIG.STARTING_MONEY,
      population: 0,
      milestoneLevel: 0,
      activePolicies: [],
      activeEvents: [],
      completedMissions: [],
      unlockedAchievements: [],
      day: 1,
      powerCapacity: 0,
      powerDemand: 0,
      waterCapacity: 0,
      waterDemand: 0,
      trafficAverage: 0,
      averageCommuteTime: 0,
      congestionIndex: 0,
      income: 0,
      expenses: 0,
      unlockedUpgrades: [],
      households: 0,
      workers: 0,
      employment: 0,
      unemploymentRate: 0,
      availableJobs: 0,
      residentialDemand: 50,
      commercialDemand: 40,
      industrialDemand: 40,
      desirability: 50,
      residentialTaxRate: 9,
      commercialTaxRate: 9,
      industrialTaxRate: 9,
      history: [],
      happiness: 50,
      healthcareCoverage: 0,
      educationCoverage: 0,
      fireSafety: 100,
      crimeRate: 35,
      wasteCapacity: 0,
      wasteProduction: 0,
      wasteCoverage: 80,
      landValueAverage: 35,
      pollutionAverage: 0,
      noiseAverage: 0,
      educationLevel: 0,
      healthIndex: 50,
      buildingLevelCounts: {
        residential: [0, 0, 0, 0, 0],
        commercial: [0, 0, 0, 0, 0],
        industrial: [0, 0, 0, 0, 0],
      },
      unlockedRegions: ['1,1'],
      seed: Math.floor(Math.random() * 4294967296),
    };
    dispatchCommand({ type: 'LOAD_STATE', payload: freshState });
    setNotifications([]);
    setShowNotifications(false);
    setShowSaveLoad(false);
  }, [dispatchCommand]);

  const selectedTileData: TileData | null =
    selectedTileCoords &&
    gameState.grid[selectedTileCoords[1]] &&
    gameState.grid[selectedTileCoords[1]][selectedTileCoords[0]]
      ? gameState.grid[selectedTileCoords[1]][selectedTileCoords[0]]
      : null;

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1d] text-gray-200 font-sans overflow-hidden select-none">
      {/* Dynamic Cursor Tooltip */}
      <CursorTooltip activeTool={activeTool} brushSize={brushSize} />

      {/* Top Header Navigation & Status Bar */}
      <GameHUD
        population={gameState.population}
        money={gameState.money}
        income={gameState.income}
        expenses={gameState.expenses}
        speed={speed}
        setSpeed={setSpeed}
        day={gameState.day}
        milestoneLevel={gameState.milestoneLevel ?? 0}
        happiness={gameState.happiness}
        unreadNotificationsCount={notifications.filter((n) => n.unread).length}
        onToggleNotifications={() => setShowNotifications((prev) => !prev)}
        onOpenCityInfo={() => setShowCityInfo(true)}
        onOpenEconomy={() => setShowTreasury(true)}
        onOpenTech={() => setShowTechTree(true)}
        onOpenPolicies={() => setShowPolicies(true)}
        onOpenObjectives={() => setShowMissions(true)}
        onOpenSaveLoad={() => setShowSaveLoad(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onNewGame={handleNewCity}
      />

      {/* Main City Viewport */}
      <main className="flex-1 relative overflow-hidden">
        {/* Info Views Overlay Toggle */}
        <InfoViewsToolbar activeOverlay={activeOverlay} onSelectOverlay={setActiveOverlay} />

        {/* Slide-out City Information Panel */}
        <CityInformationPanel
          isOpen={showCityInfo}
          onClose={() => setShowCityInfo(false)}
          population={gameState.population}
          households={gameState.households}
          workers={gameState.workers}
          employment={gameState.employment}
          unemploymentRate={gameState.unemploymentRate}
          availableJobs={gameState.availableJobs}
          money={gameState.money}
          income={gameState.income}
          expenses={gameState.expenses}
          residentialTaxRate={gameState.residentialTaxRate}
          commercialTaxRate={gameState.commercialTaxRate}
          industrialTaxRate={gameState.industrialTaxRate}
          onTaxChange={(type, val) => {
            if (type === 'residential') setTaxRates(val, gameState.commercialTaxRate, gameState.industrialTaxRate);
            if (type === 'commercial') setTaxRates(gameState.residentialTaxRate, val, gameState.industrialTaxRate);
            if (type === 'industrial') setTaxRates(gameState.residentialTaxRate, gameState.commercialTaxRate, val);
          }}
          powerDemand={gameState.powerDemand}
          powerCapacity={gameState.powerCapacity}
          waterDemand={gameState.waterDemand}
          waterCapacity={gameState.waterCapacity}
          wasteProduction={gameState.wasteProduction}
          wasteCapacity={gameState.wasteCapacity}
          wasteCoverage={gameState.wasteCoverage}
          trafficAverage={gameState.trafficAverage}
          averageCommuteTime={gameState.averageCommuteTime}
          congestionIndex={gameState.congestionIndex}
          happiness={gameState.happiness}
          crimeRate={gameState.crimeRate}
          fireSafety={gameState.fireSafety}
          healthcareCoverage={gameState.healthcareCoverage}
          educationCoverage={gameState.educationCoverage}
          educationLevel={gameState.educationLevel}
          healthIndex={gameState.healthIndex}
          landValueAverage={gameState.landValueAverage}
          pollutionAverage={gameState.pollutionAverage}
          noiseAverage={gameState.noiseAverage}
          desirability={gameState.desirability}
          residentialDemand={gameState.residentialDemand}
          commercialDemand={gameState.commercialDemand}
          industrialDemand={gameState.industrialDemand}
          history={gameState.history}
        />

        {/* Real-time City Problem Notifications */}
        <NotificationToast gameState={gameState} />

        {/* Building Inspector Panel */}
        {activeTool === 'POINTER' && selectedTileData && (
          <BuildingInspector tile={selectedTileData} onClose={() => setSelectedTileCoords(null)} />
        )}

        {/* True 3D World Canvas with Revision-Based Incremental Rendering */}
        <City3DCanvas
          grid={gameState.grid}
          revisions={revisions}
          dirtyTerrainChunks={dirtyTerrainChunks}
          dirtyRoadChunks={dirtyRoadChunks}
          dirtyBuildingChunks={dirtyBuildingChunks}
          day={gameState.day}
          speed={speed}
          activeTool={activeTool}
          activeOverlay={activeOverlay}
          unlockedRegions={gameState.unlockedRegions}
          graphicsQuality={graphicsQuality}
          showChunkBoundaries={debugChunkBoundaries}
          showTerrainLOD={debugTerrainLOD}
          showRoadSegments={debugRoadSegments}
          viewMode={viewMode}
          zoom={zoom}
          pitch={pitch}
          rotation={rotation}
          mapExpansionMode={mapExpansionMode}
          brushSize={brushSize}
          onTileAction={handleTileAction}
          onTilePointerEnter={handleTilePointerEnter}
          onUnlockRegion={handleUnlockRegion}
          onChunkRebuild={incrementTerrainRebuildCount}
          onRoadRebuild={incrementRoadRebuildCount}
          onBuildingBatchUpdate={incrementBuildingBatchCount}
          onVisibleChunksChange={setVisibleChunksCount}
          dragPreviewTiles={getDragPreviewTiles()}
          dragPreviewColor={
            calculateTotalCost(getDragPreviewTiles(), activeTool as TileType) <= gameState.money ? 'green' : 'red'
          }
          activeVehicles={activeVehicles}
          activePedestrians={activePedestrians}
        />

        {/* Organized Construction Dock at Bottom */}
        <BottomToolbar
          activeTool={activeTool}
          setActiveTool={(tool) => {
            setActiveTool(tool);
            if (tool !== 'POINTER') setSelectedTileCoords(null);
          }}
          money={gameState.money}
          milestoneLevel={gameState.milestoneLevel ?? 0}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          mapExpansionMode={mapExpansionMode}
          setMapExpansionMode={setMapExpansionMode}
        />

        {/* Real-time Developer Debug & Performance Profiler HUD */}
        <DeveloperDebugHUD
          simulationTimeMs={simulationTimeMs}
          populationCount={gameState.population}
          householdsCount={gameState.households}
          activeVehiclesCount={activeVehicles.length}
          activePedestriansCount={activePedestrians.length}
          day={gameState.day}
          graphicsQuality={graphicsQuality}
          onGraphicsQualityChange={setGraphicsQuality}
          isWorkerActive={isWorkerActive}
          totalBuildingsCount={gameState.grid.flat().filter((t) => t.type !== TileType.EMPTY && t.type !== TileType.ROAD).length}
          activeChunksCount={25}
          profilerMetrics={metrics}
          revisions={revisions}
          showChunkBoundaries={debugChunkBoundaries}
          onToggleChunkBoundaries={setDebugChunkBoundaries}
          showTerrainLOD={debugTerrainLOD}
          onToggleTerrainLOD={setDebugTerrainLOD}
          showRoadSegments={debugRoadSegments}
          onToggleRoadSegments={setDebugRoadSegments}
        />
      </main>

      {/* Modals */}
      {showTreasury && (
        <TreasuryModal
          isOpen={showTreasury}
          onClose={() => setShowTreasury(false)}
          gameState={gameState}
          setTaxRates={setTaxRates}
        />
      )}

      <TechTreeModal
        isOpen={showTechTree}
        onClose={() => setShowTechTree(false)}
        unlockedUpgrades={gameState.unlockedUpgrades}
        milestoneLevel={gameState.milestoneLevel ?? 0}
        money={gameState.money}
        onUnlockTech={(id, cost) => {
          dispatchCommand({
            type: 'UNLOCK_TECH',
            payload: { techId: id, cost },
          });
        }}
      />

      <PoliciesModal
        isOpen={showPolicies}
        onClose={() => setShowPolicies(false)}
        activePolicies={gameState.activePolicies || []}
        milestoneLevel={gameState.milestoneLevel ?? 0}
        onTogglePolicy={(id) => {
          const currentP = gameState.activePolicies || [];
          const nextP = currentP.includes(id) ? currentP.filter((p) => p !== id) : [...currentP, id];
          dispatchCommand({
            type: 'SET_POLICY',
            payload: { policyId: id, active: !currentP.includes(id) },
          });
        }}
      />

      <MissionsModal
        isOpen={showMissions}
        onClose={() => setShowMissions(false)}
        gameState={gameState}
        onClaimReward={(id, reward) => {
          setGameState((prev) => ({
            ...prev,
            money: prev.money + reward,
            completedMissions: [...(prev.completedMissions || []), id],
          }));
        }}
      />

      <SaveLoadModal
        isOpen={showSaveLoad}
        onClose={() => setShowSaveLoad(false)}
        gameState={gameState}
        onLoadState={(newState) => {
          dispatchCommand({ type: 'LOAD_STATE', payload: newState });
          setShowSaveLoad(false);
        }}
        onNewGame={handleNewCity}
      />

      {milestoneModal && (
        <MilestoneBanner milestone={milestoneModal} onClose={() => setMilestoneModal(null)} />
      )}

      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onMarkAllRead={() => setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))}
        onClearHistory={() => setNotifications([])}
      />

      <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  );
}
