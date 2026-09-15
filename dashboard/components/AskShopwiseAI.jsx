import { AiSparkle } from './AiSparkle';

export function AskShopwiseAI({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-sm border border-stone-200 px-3 py-1.5 text-[12.5px] font-medium text-stone-700 hover:bg-stone-50 transition-colors duration-150"
    >
      <AiSparkle size={14} className="text-violet-500" />
      Ask Shopwise AI
    </button>
  );
}
