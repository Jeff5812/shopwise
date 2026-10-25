import { AiSparkle } from './AiSparkle';

export function AskShopwiseAI({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="btn-press flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-[12.5px] font-medium text-stone-900 transition-colors duration-150 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
    >
      <AiSparkle size={14} className="text-emerald-600" />
      Ask Shopwise AI
    </button>
  );
}
