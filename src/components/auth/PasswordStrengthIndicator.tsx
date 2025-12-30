import { calculatePasswordStrength } from '../../lib/validation/password';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const strength = calculatePasswordStrength(password);

  const colorClasses = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    lime: 'bg-lime-500',
    green: 'bg-green-500',
  };

  const textColorClasses = {
    red: 'text-red-700 dark:text-red-400',
    orange: 'text-orange-700 dark:text-orange-400',
    yellow: 'text-yellow-700 dark:text-yellow-400',
    lime: 'text-lime-700 dark:text-lime-400',
    green: 'text-green-700 dark:text-green-400',
  };

  const bgColorClass = colorClasses[strength.color as keyof typeof colorClasses];
  const textColorClass = textColorClasses[strength.color as keyof typeof textColorClasses];

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index <= strength.score ? bgColorClass : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>
      <p className={`text-sm font-medium ${textColorClass}`}>Password Strength: {strength.label}</p>
    </div>
  );
}
