import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TileType, CityState, BUILD_COSTS, TileData } from './types';
import { createEmptyGrid, simulateTick, GRID_WIDTH, GRID_HEIGHT } from './engine';
import { MILESTONES, CityMilestone } from './progression';
import { GAME_CONFIG } from './config';

// Modular UI Components
import { NotificationToast } from './components/NotificationToast';
import { TreasuryModal } from './components/TreasuryModal';
import { City3DCanvas } from './components/world/City3DCanvas';
import { GameHUD } from './components/ui/GameHUD';
import { BottomToolbar } from './components/ui/BottomToolbar';
import { CityInformationPanel } from './components/ui/CityInformationPanel';
import { InfoViewsToolbar } from './components/ui/InfoViewsToolbar';
import { BuildingInspector } from './components/ui/BuildingInspector';
import { OverlayMode } from './types';

// Phase 9 Progression & Save System Components
import { TechTreeModal } from './components/TechTreeModal';
import { PoliciesModal } from './components/PoliciesModal';
import { MissionsModal } from './components/MissionsModal';
import { SaveLoadModal } from './components/SaveLoadModal';
import { MilestoneBanner } from './components/MilestoneBanner';

// Custom Phase 11 UI Components
import { SettingsModal } from './components/ui/SettingsModal';
import { NotificationCenter, NotificationItem } from './components/ui/NotificationCenter';

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
  const [gameState, setGameState] = useState<CityState>(() => {
    const initialGrid = createEmptyGrid();
    return {
      grid: initialGrid,
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
  });

  const [activeTool, setActiveTool] = useState<TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN'>('POINTER');
  const [activeOverlay, setActiveOverlay] = useState<OverlayMode | 'NATURAL_RESOURCES'>('NONE');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [mapExpansionMode, setMapExpansionMode] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1); // 0 = pause, 1 = normal, 2 = fast, 3 = ultra
  const [showUpgrades, setShowUpgrades] = useState<boolean>(false);
  const [showTreasury, setShowTreasury] = useState<boolean>(false);
  const [showTechTree, setShowTechTree] = useState<boolean>(false);
  const [showPolicies, setShowPolicies] = useState<boolean>(false);
  const [showMissions, setShowMissions] = useState<boolean>(false);
  const [showSaveLoad, setShowSaveLoad] = useState<boolean>(false);
  const [showCityInfo, setShowCityInfo] = useState<boolean>(false);
  const [milestoneModal, setMilestoneModal] = useState<CityMilestone | null>(null);
  const [selectedTileCoords, setSelectedTileCoords] = useState<[number, number] | null>(null);

  // Phase 11 Custom Modal & Drag States
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragCurrent, setDragCurrent] = useState<[number, number] | null>(null);

  // Track previous milestone level to announce promotions
  const prevMilestoneRef = useRef<number>(gameState.milestoneLevel ?? 0);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
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
        case ' ': // Space to pause
          e.preventDefault();
          setSpeed(prev => prev === 0 ? 1 : 0);
          break;
        case 't':
          setShowTechTree(prev => !prev);
          break;
        case 'p':
          setShowPolicies(prev => !prev);
          break;
        case 'm':
          setShowMissions(prev => !prev);
          break;
        case 'b':
          setActiveTool(prev => prev === 'BULLDOZER' ? 'POINTER' : 'BULLDOZER');
          break;
        case 'escape':
          // Close modals first
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
  }, [
    showTreasury, showTechTree, showPolicies, showMissions, showSaveLoad, showCityInfo, selectedTileCoords
  ]);

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
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('3D');
  const [zoom, setZoom] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(55);
  const [rotation, setRotation] = useState<number>(-45);

  const isMouseDown = useRef(false);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);

  // Global Escape Key & Right-Click Cancel Tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('POINTER');
        setSelectedTileCoords(null);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setActiveTool('POINTER');
    };

    const handlePointerMove = (e: PointerEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('pointermove', handlePointerMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  // Simulation Game Tick Loop
  useEffect(() => {
    if (speed === 0) return;
    const interval = speed === 1 ? 1000 : speed === 2 ? 400 : 180;

    const timer = setInterval(() => {
      setGameState((prev) => simulateTick(prev));
    }, interval);

    return () => clearInterval(timer);
  }, [speed]);

  const setTaxRates = useCallback((res: number, com: number, ind: number) => {
    setGameState((prev) => ({
      ...prev,
      residentialTaxRate: res,
      commercialTaxRate: com,
      industrialTaxRate: ind,
    }));
  }, []);

  const addSystemNotification = useCallback((
    type: NotificationItem['type'],
    title: string,
    message: string,
    forceToast = false
  ) => {
    const id = `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newNotif: NotificationItem = {
      id,
      type,
      title,
      message,
      timestamp: `Day ${gameState.day}`,
      unread: true
    };
    
    setNotifications(prev => [newNotif, ...prev].slice(0, 25));
  }, [gameState.day]);

  // Utilities & Milestones notification tracker
  const lastPowerShortageRef = useRef<boolean>(false);
  const lastWaterShortageRef = useRef<boolean>(false);
  const lastHighCrimeRef = useRef<boolean>(false);
  const lastUnemploymentRef = useRef<boolean>(false);
  const lastMilestoneRef = useRef<number>(0);

  useEffect(() => {
    const powerShortage = gameState.powerCapacity < gameState.powerDemand && gameState.powerDemand > 0;
    const waterShortage = gameState.waterCapacity < gameState.waterDemand && gameState.waterDemand > 0;
    const highCrime = (gameState.crimeRate ?? 0) > 30;
    const highUnemployment = (gameState.unemploymentRate ?? 0) > 20 && gameState.population > 20;
    const currentLvl = gameState.milestoneLevel ?? 0;

    if (powerShortage && !lastPowerShortageRef.current) {
      addSystemNotification('utilities', 'Power Grid Warning', 'Electricity demand exceeds capacity. Construct additional Power Plants.', true);
    }
    lastPowerShortageRef.current = powerShortage;

    if (waterShortage && !lastWaterShortageRef.current) {
      addSystemNotification('utilities', 'Water Supply Shortage', 'Low water pressure reported. Build more Water Pumping Stations.', true);
    }
    lastWaterShortageRef.current = waterShortage;

    if (highCrime && !lastHighCrimeRef.current) {
      addSystemNotification('crime', 'Crime Spikes Detected', 'Unprotected neighborhoods are experiencing crime surges. Place Police Stations.', true);
    }
    lastHighCrimeRef.current = highCrime;

    if (highUnemployment && !lastUnemploymentRef.current) {
      addSystemNotification('economy', 'High Unemployment', 'Citizens are unable to find commercial or industrial jobs. Zone more workplaces.', true);
    }
    lastUnemploymentRef.current = highUnemployment;

    if (currentLvl > lastMilestoneRef.current && currentLvl > 0) {
      const milestone = MILESTONES[currentLvl];
      if (milestone) {
        addSystemNotification('milestone', 'Milestone Reached!', `City leveled up to: ${milestone.name}. New technologies unlocked.`, true);
      }
    }
    lastMilestoneRef.current = currentLvl;
  }, [
    gameState.powerCapacity,
    gameState.powerDemand,
    gameState.waterCapacity,
    gameState.waterDemand,
    gameState.crimeRate,
    gameState.unemploymentRate,
    gameState.milestoneLevel,
    addSystemNotification
  ]);

  const validateTilePlacement = useCallback((grid: TileData[][], x: number, y: number, type: TileType): { valid: boolean; reason?: string } => {
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
  }, [gameState.milestoneLevel]);

  const calculateTotalCost = useCallback((tiles: [number, number][], type: TileType): number => {
    let total = 0;
    const costPerTile = BUILD_COSTS[type] || 0;
    for (const [x, y] of tiles) {
      if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
        const tile = gameState.grid[y][x];
        if (tile.type !== type) {
          total += costPerTile;
        }
      }
    }
    return total;
  }, [gameState.grid]);

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
      addSystemNotification('economy', 'Construction Failed', 'Insufficient city funds to build this selection.', true);
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
      addSystemNotification('utilities', 'Placement Prevented', `Could not construct selection: ${firstInvalidReason}`, true);
      return;
    }

    setGameState((prev) => {
      const nextGrid = prev.grid.map((row) => row.map((tile) => ({ ...tile })));
      for (const [x, y] of tiles) {
        nextGrid[y][x] = {
          type,
          x,
          y,
          level: 1,
          population: 0,
          jobs: 0,
          traffic: 0,
          powered: false,
          watered: false,
          productivity: 0,
          abandoned: false,
          landValue: 35,
          pollution: 0,
          noise: 0,
          crime: 30,
          health: 50,
          education: 0,
          upgradeProgress: 0,
        };
      }
      return {
        ...prev,
        grid: nextGrid,
        money: Math.round(prev.money - totalCost),
      };
    });
  }, [dragStart, dragCurrent, activeTool, gameState, getDragPreviewTiles, calculateTotalCost, validateTilePlacement, addSystemNotification]);

  const applyBulldoze = useCallback((x: number, y: number) => {
    setGameState((prev) => {
      const nextGrid = prev.grid.map((row) => row.map((tile) => ({ ...tile })));
      const currentTile = nextGrid[y][x];
      if (currentTile.type !== TileType.EMPTY) {
        nextGrid[y][x] = {
          type: TileType.EMPTY,
          x,
          y,
          level: 1,
          population: 0,
          jobs: 0,
          traffic: 0,
          powered: false,
          watered: false,
          productivity: 0,
          abandoned: false,
          landValue: 35,
          pollution: 0,
          noise: 0,
          crime: 30,
          health: 50,
          education: 0,
          upgradeProgress: 0,
        };
        return {
          ...prev,
          grid: nextGrid,
        };
      }
      return prev;
    });
  }, []);

  const validateAndPlaceSingleTile = useCallback((x: number, y: number, type: TileType) => {
    const { valid, reason } = validateTilePlacement(gameState.grid, x, y, type);
    if (!valid) {
      addSystemNotification('utilities', 'Placement Blocked', `Could not construct: ${reason}`, true);
      return;
    }
    const cost = BUILD_COSTS[type] || 0;
    if (gameState.money < cost) {
      addSystemNotification('economy', 'Insufficient Funds', 'You do not have enough funds to construct this building.', true);
      return;
    }
    setGameState(prev => {
      const nextGrid = prev.grid.map((row) => row.map((tile) => ({ ...tile })));
      nextGrid[y][x] = {
        type,
        x,
        y,
        level: 1,
        population: 0,
        jobs: 0,
        traffic: 0,
        powered: false,
        watered: false,
        productivity: 0,
        abandoned: false,
        landValue: 35,
        pollution: 0,
        noise: 0,
        crime: 30,
        health: 50,
        education: 0,
        upgradeProgress: 0,
      };
      return {
        ...prev,
        grid: nextGrid,
        money: Math.max(0, prev.money - cost)
      };
    });
  }, [gameState.grid, gameState.money, validateTilePlacement, addSystemNotification]);

  const applyTerraforming = useCallback((cx: number, cy: number, tool: string) => {
    const tiles = [];
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
      addSystemNotification('economy', 'Insufficient Funds', 'Terraforming requires $15 per tile.', true);
      return;
    }

    setGameState((prev) => {
      const nextGrid = prev.grid.map((row) => row.map((tile) => ({ ...tile })));
      const centerElevation = nextGrid[cy]?.[cx]?.elevation || 0;

      tiles.forEach(([tx, ty]) => {
        const tile = nextGrid[ty][tx];
        if (tool === 'RAISE_TERRAIN') {
          tile.elevation = Math.min(10, (tile.elevation || 0) + 1);
          if (tile.elevation > 0) {
            tile.water = false;
          }
        } else if (tool === 'LOWER_TERRAIN') {
          tile.elevation = Math.max(0, (tile.elevation || 0) - 1);
          if (tile.elevation === 0) {
            tile.water = true;
            tile.type = TileType.EMPTY;
          }
        } else if (tool === 'LEVEL_TERRAIN') {
          tile.elevation = centerElevation;
          if (tile.elevation === 0) {
            tile.water = true;
            tile.type = TileType.EMPTY;
          } else {
            tile.water = false;
          }
        } else if (tool === 'SMOOTH_TERRAIN') {
          let sum = tile.elevation || 0;
          let count = 1;
          const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
          dirs.forEach(([dx, dy]) => {
            const nx = tx + dx;
            const ny = ty + dy;
            if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
              sum += prev.grid[ny][nx].elevation || 0;
              count++;
            }
          });
          tile.elevation = Math.round(sum / count);
          if (tile.elevation === 0) {
            tile.water = true;
            tile.type = TileType.EMPTY;
          } else {
            tile.water = false;
          }
        }
      });

      return {
        ...prev,
        grid: nextGrid,
        money: Math.max(0, prev.money - totalCost),
      };
    });
  }, [brushSize, gameState.money, addSystemNotification]);

  const handleUnlockRegion = useCallback((rx: number, ry: number) => {
    const cost = 50000;
    if (gameState.money < cost) {
      addSystemNotification('economy', 'Insufficient Funds', 'Unlocking a new region requires $50,000.', true);
      return;
    }
    const key = `${rx},${ry}`;
    if (gameState.unlockedRegions?.includes(key)) return;

    setGameState((prev) => {
      const nextUnlocked = [...(prev.unlockedRegions || []), key];
      addSystemNotification('milestone', 'Region Unlocked!', `Purchased and unlocked sector coordinate [${rx}, ${ry}]!`, true);
      return {
        ...prev,
        unlockedRegions: nextUnlocked,
        money: prev.money - cost,
      };
    });
  }, [gameState.money, gameState.unlockedRegions, addSystemNotification]);

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

  // Window-level MouseDown / MouseUp trackers for dragging
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
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Right-click cancels drag or active tool immediately
      setDragStart(null);
      setDragCurrent(null);
      setActiveTool('POINTER');
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [dragStart, activeTool, applyDragConstruction]);

  const handleNewCity = useCallback(() => {
    const freshGrid = createEmptyGrid();
    setGameState({
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
    });
    setNotifications([]);
    setShowNotifications(false);
    setShowSaveLoad(false);
  }, []);

  const selectedTileData: TileData | null =
    selectedTileCoords &&
    gameState.grid[selectedTileCoords[1]] &&
    gameState.grid[selectedTileCoords[1]][selectedTileCoords[0]]
      ? gameState.grid[selectedTileCoords[1]][selectedTileCoords[0]]
      : null;

  const getToolName = (type: TileType) => {
    switch (type) {
      case TileType.RESIDENTIAL: return 'Residential Zone';
      case TileType.COMMERCIAL: return 'Commercial Zone';
      case TileType.INDUSTRIAL: return 'Industrial Zone';
      case TileType.POWER_PLANT: return 'Coal Power Plant';
      case TileType.WATER_PUMP: return 'Water Pumping Station';
      case TileType.FIRE_STATION: return 'Fire Station';
      case TileType.POLICE_STATION: return 'Police Headquarters';
      case TileType.CLINIC: return 'Medical Clinic';
      case TileType.SCHOOL: return 'Elementary School';
      case TileType.PARK: return 'City Park';
      case TileType.ROAD: return 'Road';
      case TileType.WASTE_MANAGEMENT: return 'Waste Management';
      default: return 'Build';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1d] text-gray-200 font-sans overflow-hidden select-none">
      
      {/* Dynamic Cursor Tooltip */}
      {activeTool !== 'POINTER' && activeTool !== 'BULLDOZER' && cursorPos && (
        <div 
          className="fixed z-50 pointer-events-none bg-black/80 backdrop-blur-sm border border-white/20 text-white px-3 py-2 rounded-lg shadow-2xl flex flex-col items-center"
          style={{ left: cursorPos.x + 16, top: cursorPos.y + 16 }}
        >
          <span className="font-bold text-xs">{getToolName(activeTool as TileType)}</span>
          <span className="text-blue-400 font-mono text-xs">${BUILD_COSTS[activeTool as TileType] || 0}</span>
        </div>
      )}

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
        unreadNotificationsCount={notifications.filter(n => n.unread).length}
        onToggleNotifications={() => setShowNotifications(prev => !prev)}
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
        <InfoViewsToolbar
          activeOverlay={activeOverlay}
          onSelectOverlay={setActiveOverlay}
        />

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

        {/* Building Inspector Panel (when activeTool is POINTER and tile is selected) */}
        {activeTool === 'POINTER' && selectedTileData && (
          <BuildingInspector
            tile={selectedTileData}
            onClose={() => setSelectedTileCoords(null)}
          />
        )}

        {/* True 3D World Canvas */}
        <City3DCanvas
          gameState={gameState}
          activeTool={activeTool}
          activeOverlay={activeOverlay}
          speed={speed}
          viewMode={viewMode}
          zoom={zoom}
          pitch={pitch}
          rotation={rotation}
          mapExpansionMode={mapExpansionMode}
          brushSize={brushSize}
          onTileAction={handleTileAction}
          onTilePointerEnter={handleTilePointerEnter}
          onUnlockRegion={handleUnlockRegion}
          dragPreviewTiles={getDragPreviewTiles()}
          dragPreviewColor={calculateTotalCost(getDragPreviewTiles(), activeTool as TileType) <= gameState.money ? 'green' : 'red'}
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
      </main>

      {/* Treasury / Budget Modal */}
      {showTreasury && (
        <TreasuryModal
          isOpen={showTreasury}
          onClose={() => setShowTreasury(false)}
          gameState={gameState}
          setTaxRates={setTaxRates}
        />
      )}

      {/* Phase 9 Tech Tree / Research Modal */}
      <TechTreeModal
        isOpen={showTechTree}
        onClose={() => setShowTechTree(false)}
        unlockedUpgrades={gameState.unlockedUpgrades}
        milestoneLevel={gameState.milestoneLevel ?? 0}
        money={gameState.money}
        onUnlockTech={(id, cost) => {
          setGameState((prev) => ({
            ...prev,
            money: prev.money - cost,
            unlockedUpgrades: [...prev.unlockedUpgrades, id],
          }));
        }}
      />

      {/* Phase 9 Municipal Policies Modal */}
      <PoliciesModal
        isOpen={showPolicies}
        onClose={() => setShowPolicies(false)}
        activePolicies={gameState.activePolicies || []}
        milestoneLevel={gameState.milestoneLevel ?? 0}
        onTogglePolicy={(id) => {
          setGameState((prev) => {
            const currentP = prev.activePolicies || [];
            const nextP = currentP.includes(id)
              ? currentP.filter((p) => p !== id)
              : [...currentP, id];
            return {
              ...prev,
              activePolicies: nextP,
            };
          });
        }}
      />

      {/* Phase 9 Missions & Achievements Modal */}
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

      {/* Phase 9 Save & Load System Modal */}
      <SaveLoadModal
        isOpen={showSaveLoad}
        onClose={() => setShowSaveLoad(false)}
        gameState={gameState}
        onLoadState={(newState) => {
          setGameState(newState);
          setShowSaveLoad(false);
        }}
        onNewGame={handleNewCity}
      />

      {/* Phase 9 Milestone Promotion Celebration Modal */}
      {milestoneModal && (
        <MilestoneBanner
          milestone={milestoneModal}
          onClose={() => setMilestoneModal(null)}
        />
      )}

      {/* Historical Notification Sidebar/Drawer */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))}
        onClearHistory={() => setNotifications([])}
      />

      {/* Advanced Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}
