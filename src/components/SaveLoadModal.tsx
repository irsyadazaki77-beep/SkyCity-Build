import React, { useState, useEffect } from 'react';
import { SaveSlotInfo, SaveManager } from '../saveSystem';
import { CityState } from '../types';
import { X, Save, FolderOpen, Plus, Trash2, Download, Upload, AlertTriangle, RefreshCw } from 'lucide-react';

interface SaveLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  onLoadState: (state: CityState) => void;
  onNewGame: () => void;
}

export function SaveLoadModal({
  isOpen,
  onClose,
  gameState,
  onLoadState,
  onNewGame,
}: SaveLoadModalProps) {
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [cityNameInput, setCityNameInput] = useState<string>('Skyline Metropolis');
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'NEW_GAME' | 'OVERWRITE' | 'DELETE';
    slotId?: string;
    message: string;
  } | null>(null);

  const [importJsonText, setImportJsonText] = useState<string>('');
  const [showImport, setShowImport] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const refreshSlots = async () => {
    const s = await SaveManager.listSlots();
    setSlots(s);
  };

  useEffect(() => {
    if (isOpen) {
      refreshSlots();
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveToSlot = (slotId: string) => {
    const existing = slots.find((s) => s.slotId === slotId);
    if (existing?.hasData) {
      setConfirmDialog({
        type: 'OVERWRITE',
        slotId,
        message: `Overwrite existing save in ${slotId === 'autosave' ? 'Autosave' : slotId.toUpperCase()}?`,
      });
    } else {
      executeSave(slotId);
    }
  };

  const executeSave = async (slotId: string) => {
    setErrorMsg('');
    const success = await SaveManager.saveGame(slotId, gameState, cityNameInput);
    if (!success) {
       setErrorMsg('Failed to save game. State validation error.');
    }
    await refreshSlots();
    setConfirmDialog(null);
  };

  const handleLoadFromSlot = async (slotId: string) => {
    setErrorMsg('');
    const loaded = await SaveManager.loadGame(slotId);
    if (loaded && loaded.gameState) {
      onLoadState(loaded.gameState);
      onClose();
    } else {
       setErrorMsg('Failed to load game. Save file might be corrupted.');
    }
  };

  const handleDeleteSlot = (slotId: string) => {
    setConfirmDialog({
      type: 'DELETE',
      slotId,
      message: `Permanently delete save file in ${slotId.toUpperCase()}?`,
    });
  };

  const executeDelete = async (slotId: string) => {
    await SaveManager.deleteSave(slotId);
    await refreshSlots();
    setConfirmDialog(null);
  };

  const handleNewGameClick = () => {
    setConfirmDialog({
      type: 'NEW_GAME',
      message: 'Start a New City? All unsaved progress in your current session will be lost.',
    });
  };

  const executeNewGame = () => {
    onNewGame();
    setConfirmDialog(null);
    onClose();
  };

  const handleExport = async (slotId: string) => {
    const json = await SaveManager.exportJson(slotId);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slotId}_skyline_save.json`;
      a.click();
    }
  };

  const handleImportSubmit = async (slotId: string) => {
    setErrorMsg('');
    const success = await SaveManager.importJson(slotId, importJsonText);
    if (success) {
      await refreshSlots();
      setShowImport(false);
      setImportJsonText('');
    } else {
      setErrorMsg('Invalid save file format!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] px-[calc(env(safe-area-inset-left,0px)+0.75rem)] pr-[calc(env(safe-area-inset-right,0px)+0.75rem)] select-none animate-in fade-in duration-200">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[90vh] sm:max-h-[85vh] relative">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-6 sm:py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl text-[#D4AF37]">
              <Save size={18} />
            </div>
            <div>
              <h2 className="font-serif italic text-sm sm:text-xl text-[#D4AF37]">Save & Load Game</h2>
              <p className="text-[8px] sm:text-[9px] text-gray-400 font-mono uppercase tracking-widest">
                City Archives
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors min-h-[36px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center"
            aria-label="Close Save & Load"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* City Name Input */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-black/30 p-2.5 sm:p-3 rounded-xl border border-white/5">
            <span className="text-xs font-mono text-gray-400 shrink-0">City Designation:</span>
            <input
              type="text"
              value={cityNameInput}
              onChange={(e) => setCityNameInput(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#D4AF37] flex-1 min-h-[36px]"
            />
            <button
              onClick={handleNewGameClick}
              className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-200 font-mono text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shrink-0 min-h-[36px]"
            >
              <RefreshCw size={12} /> New Game
            </button>
          </div>

          {errorMsg && (
            <div className="bg-red-950/50 border border-red-500/50 text-red-300 px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-2">
               <AlertTriangle size={14} /> {errorMsg}
            </div>
          )}

          {/* Slots List */}
          <div className="space-y-2.5 sm:space-y-3">
            {slots.map((s) => (
              <div
                key={s.slotId}
                className="p-3 sm:p-4 rounded-xl border border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-mono text-xs font-bold text-[#D4AF37] uppercase">
                      {s.slotId === 'autosave' ? 'Autosave Slot' : `Save Slot: ${s.slotId}`}
                    </span>
                    {s.hasData && (
                      <span className="text-[9px] sm:text-[10px] font-mono text-gray-400">
                        {new Date(s.timestamp).toLocaleDateString()} {new Date(s.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {s.hasData ? (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-mono text-gray-300">
                      <span className="font-bold text-white">{s.cityName}</span>
                      <span>Pop: {s.population.toLocaleString()}</span>
                      <span>Treasury: ${s.money.toLocaleString()}</span>
                      <span>Day {s.day}</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-gray-500 italic block">Empty Save Slot</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 font-mono">
                  <button
                    onClick={() => handleSaveToSlot(s.slotId)}
                    className="px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 min-h-[36px]"
                  >
                    <Save size={12} /> Save
                  </button>

                  {s.hasData && (
                    <>
                      <button
                        onClick={() => handleLoadFromSlot(s.slotId)}
                        className="px-3 py-1.5 bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold rounded-xl transition-colors flex items-center gap-1 min-h-[36px]"
                      >
                        <FolderOpen size={12} /> Load
                      </button>

                      <button
                        onClick={() => handleExport(s.slotId)}
                        title="Export Save JSON"
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Download size={14} />
                      </button>

                      <button
                        onClick={() => handleDeleteSlot(s.slotId)}
                        title="Delete Save Slot"
                        className="p-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 rounded-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confirmation Modal Overlay */}
        {confirmDialog && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <div className="bg-[#0f172a] border border-red-500/40 rounded-2xl p-6 max-w-md text-center space-y-4">
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>

              <h3 className="font-serif italic text-lg font-bold text-white">Confirmation Required</h3>
              <p className="text-xs text-gray-300 leading-relaxed">{confirmDialog.message}</p>

              <div className="flex items-center justify-center gap-3 font-mono text-xs pt-2">
                <button
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-gray-300 font-bold transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    if (confirmDialog.type === 'NEW_GAME') executeNewGame();
                    else if (confirmDialog.type === 'OVERWRITE' && confirmDialog.slotId)
                      executeSave(confirmDialog.slotId);
                    else if (confirmDialog.type === 'DELETE' && confirmDialog.slotId)
                      executeDelete(confirmDialog.slotId);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors shadow-lg"
                >
                  Confirm Action
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
