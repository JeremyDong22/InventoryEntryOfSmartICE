import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'glass' | 'ghost' | 'ios-blue';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const variantMap = {
  primary: 'btn-primary',
  glass: 'btn-glass',
  ghost: 'btn-ghost',
  'ios-blue': 'btn-ios-blue',
};

const sizeMap = {
  sm: 'px-4 py-2 text-sm',
  md: '', // 使用默认 padding
  lg: 'px-8 py-4 text-lg',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={clsx(
        variantMap[variant],
        size !== 'md' && sizeMap[size],
        fullWidth && 'w-full',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
