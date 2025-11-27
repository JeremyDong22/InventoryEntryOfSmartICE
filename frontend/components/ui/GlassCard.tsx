import { clsx } from 'clsx';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'elevated' | 'subtle';
  interactive?: boolean;
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

const variantMap = {
  default: 'glass-card',
  elevated: 'glass-card-elevated',
  subtle: 'glass-card-subtle',
};

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  padding = 'md',
  variant = 'default',
  interactive = false,
}) => {
  return (
    <div
      className={clsx(
        variantMap[variant],
        paddingMap[padding],
        interactive && 'cursor-pointer active:scale-[0.98]',
        className
      )}
    >
      {children}
    </div>
  );
};
