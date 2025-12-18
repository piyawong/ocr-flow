interface StageBadgeProps {
  stageNumber: string;
  title: string;
  description: string;
}

export function StageBadge({ stageNumber, title, description }: StageBadgeProps) {
  return (
    <div className="flex items-start gap-5 mb-8">
      {/* Stage Badge */}
      <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b82f6] to-purple-600 flex items-center justify-center shadow-lg shadow-[#3b82f6]/25">
        <span className="text-white font-bold text-xl">{stageNumber}</span>
      </div>
      <div>
        <h1 className="m-0 mb-2 text-2xl font-bold text-text-primary">{title}</h1>
        <p className="m-0 text-text-secondary text-sm">{description}</p>
      </div>
    </div>
  );
}
