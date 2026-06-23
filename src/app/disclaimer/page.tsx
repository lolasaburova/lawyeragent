import Link from "next/link";

export const metadata = {
  title: "Ограничения и дисклеймер — Legal & Shariah AI Agent",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-2xl font-bold tracking-tight text-navy">
        Ограничения и дисклеймер
      </h1>

      <div className="mt-6 rounded-md border border-gold/40 bg-gold/5 px-5 py-5 text-base leading-relaxed text-gray-800">
        Ответы AI-агента являются аналитической и справочной информацией. Они не
        являются юридическим заключением, адвокатской консультацией, официальной
        позицией государственного органа, регулятора или шариатского совета.
        Перед принятием решений необходимо провести проверку квалифицированным
        юристом и, при необходимости, получить заключение шариатского совета.
      </div>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-navy">
            Что делает агент
          </h2>
          <p>
            Агент помогает структурировать анализ документов: выделяет возможные
            риски, формирует вопросы и предложения по редакции. Это инструмент
            поддержки, а не замена работы юриста или шариатского совета.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-navy">
            Чего агент не делает
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Не выдаёт официальное юридическое заключение.</li>
            <li>
              Не подтверждает, что нормы закона проверены, если не указан
              источник.
            </li>
            <li>
              Не выдумывает статьи законодательства, фетвы или шариатские
              стандарты. При отсутствии источника прямо указывает на
              необходимость дополнительной проверки.
            </li>
            <li>Не заменяет позицию регулятора или решение шариатского совета.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-navy">
            Конфиденциальность данных
          </h2>
          <p>
            В этой версии (MVP) загруженные документы не сохраняются на сервере
            после анализа, а полный текст документов не логируется. Текст
            передаётся в OpenAI исключительно для формирования ответа. Не
            загружайте документы, содержащие банковскую или иную охраняемую
            тайну, без согласования с вашей службой комплаенс и без отдельной
            политики обработки данных.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link
          href="/analyze"
          className="inline-block rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-light"
        >
          Перейти к анализу
        </Link>
      </div>
    </div>
  );
}
