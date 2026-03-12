import React from 'react';
import { X, RefreshCw, Check } from 'lucide-react';

const GeneratedOptionsModal = ({ isOpen, onClose, options, onSelect, onRegenerate, fieldType, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e?.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-foreground">
            {fieldType === 'title' ? 'Sélectionnez un titre' : 'Description générée'}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {fieldType === 'title' ? (
                options?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => onSelect(option)}
                    className="w-full text-left p-4 rounded-lg border-2 border-input bg-background hover:bg-accent hover:border-primary transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-foreground group-hover:text-primary font-medium">{option}</span>
                      <Check className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 rounded-lg border-2 border-input bg-background">
                  <p className="text-foreground whitespace-pre-wrap">{options}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t flex gap-3 flex-shrink-0">
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            Régénérer
          </button>
          {fieldType === 'description' && (
            <button
              onClick={() => onSelect(options)}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Utiliser cette description
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneratedOptionsModal;