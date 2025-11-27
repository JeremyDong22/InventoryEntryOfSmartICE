import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  id,
  ...props
}) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[20px] tracking-wider text-zinc-500 font-bold mb-2 ml-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          'glass-input w-full',
          error && 'border-ios-red',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-ios-red text-xs mt-1 ml-1">{error}</p>
      )}
    </div>
  );
};
