// Compact disclaimer banner reused on the analyze page.
export default function DisclaimerBanner() {
  return (
    <div className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-gray-700">
      <strong className="text-navy">Важно:</strong> AI-агент не является юристом,
      адвокатом, регулятором или шариатским советом. Ответы являются
      аналитической и справочной информацией. Перед принятием решений требуется
      проверка квалифицированным юристом и, при необходимости, заключение
      шариатского совета.
    </div>
  );
}
