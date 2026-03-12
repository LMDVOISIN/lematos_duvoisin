import React from 'react';
import { X, Smile, Briefcase, Wrench } from 'lucide-react';
import Icon from '../../../components/AppIcon';


const StyleSelectorModal = ({ isOpen, onClose, onSelectStyle, fieldType }) => {
  if (!isOpen) return null;

  const styles = [
    {
      id: 'funny',
      label: 'Drôle',
      icon: Smile,
      description: 'Ton humoristique et accrocheur',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 hover:bg-orange-100',
      borderColor: 'border-orange-200'
    },
    {
      id: 'professional',
      label: 'Professionnel',
      icon: Briefcase,
      description: 'Clair et convaincant',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      borderColor: 'border-blue-200'
    },
    {
      id: 'technical',
      label: 'Technique',
      icon: Wrench,
      description: 'Spécifications détaillées',
      color: 'text-green-500',
      bgColor: 'bg-green-50 hover:bg-green-100',
      borderColor: 'border-green-200'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e?.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-foreground">
            Choisissez un style {fieldType === 'title' ? 'de titre' : 'de description'}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-3">
          {styles?.map((style) => {
            const Icon = style?.icon;
            return (
              <button
                key={style?.id}
                onClick={() => onSelectStyle(style?.id)}
                className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 ${style?.bgColor} ${style?.borderColor} transition-all hover:shadow-md`}
              >
                <Icon className={`w-6 h-6 ${style?.color} flex-shrink-0 mt-0.5`} />
                <div className="text-left">
                  <div className="font-semibold text-foreground">{style?.label}</div>
                  <div className="text-sm text-muted-foreground">{style?.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StyleSelectorModal;