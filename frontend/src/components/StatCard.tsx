import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'green' | 'red' | 'blue' | 'purple' | 'yellow' | 'orange';
  highlight?: boolean;
}

const colorMap = {
  green:  { iconBg: 'bg-brand-100 dark:bg-brand-500/15', icon: 'text-brand-600 dark:text-brand-400', ring: 'ring-brand-200 dark:ring-brand-500/20'  },
  red:    { iconBg: 'bg-red-100   dark:bg-red-500/15',   icon: 'text-red-500   dark:text-red-400',   ring: 'ring-red-200   dark:ring-red-500/20'    },
  blue:   { iconBg: 'bg-blue-100  dark:bg-blue-500/15',  icon: 'text-blue-500  dark:text-blue-400',  ring: 'ring-blue-200  dark:ring-blue-500/20'   },
  purple: { iconBg: 'bg-purple-100 dark:bg-purple-500/15',icon:'text-purple-500 dark:text-purple-400',ring: 'ring-purple-200 dark:ring-purple-500/20'},
  yellow: { iconBg: 'bg-yellow-100 dark:bg-yellow-500/15',icon:'text-yellow-600 dark:text-yellow-400',ring:'ring-yellow-200 dark:ring-yellow-500/20' },
  orange: { iconBg: 'bg-orange-100 dark:bg-orange-500/15',icon:'text-orange-500 dark:text-orange-400',ring:'ring-orange-200 dark:ring-orange-500/20'},
};

const trendConfig = {
  up:      { Icon: TrendingUp,   cls: 'text-brand-600 bg-brand-100 dark:text-brand-400 dark:bg-brand-500/15' },
  down:    { Icon: TrendingDown, cls: 'text-red-500   bg-red-100   dark:text-red-400   dark:bg-red-500/15'   },
  neutral: { Icon: Minus,        cls: 'text-gray-400  bg-gray-100  dark:text-gray-500  dark:bg-white/8'      },
};

export default function StatCard({
  title, value, subValue, icon: Icon,
  trend, trendValue, color = 'green', highlight = false,
}: StatCardProps) {
  const c = colorMap[color];
  const t = trend ? trendConfig[trend] : null;

  return (
    <div className={`card card-hover p-5 relative overflow-hidden ${highlight ? 'ring-2 ring-brand-400/30' : ''}`}>
      {highlight && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient" />}

      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} ring-1 ${c.ring} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {t && trendValue && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${t.cls}`}>
            <t.Icon className="w-3 h-3" />
            {trendValue}
          </div>
        )}
      </div>

      <div className="stat-big mb-0.5">{value}</div>
      <div className="text-sm font-medium text-c2">{title}</div>
      {subValue && <div className="text-xs text-c3 mt-0.5">{subValue}</div>}
    </div>
  );
}
