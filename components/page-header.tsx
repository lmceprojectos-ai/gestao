'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
    >
      <div className="flex items-center gap-3">
        {Icon && <div className="p-2.5 rounded-xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>}
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action && <div>{action}</div>}
    </motion.div>
  );
}
