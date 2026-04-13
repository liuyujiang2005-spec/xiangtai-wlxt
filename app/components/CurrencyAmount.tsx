type CurrencyAmountProps = {
  /** 金额数值（人民币） */
  value: number;
  /** 小数位数，默认 2 */
  fractionDigits?: number;
  /** 是否显示人民币符号，默认 true */
  showSymbol?: boolean;
  /** 外层附加 className（如强调色） */
  className?: string;
};

/**
 * 统一展示人民币金额：¥ + 等宽加粗数字，用于单价、运费、补差等。
 */
export function CurrencyAmount({
  value,
  fractionDigits = 2,
  showSymbol = true,
  className = "",
}: CurrencyAmountProps) {
  const text = value.toFixed(fractionDigits);
  return (
    <span
      className={`inline-flex items-baseline gap-0 font-mono font-bold tabular-nums text-slate-900 ${className}`}
    >
      {showSymbol ? <span>¥</span> : null}
      <span>{text}</span>
    </span>
  );
}
