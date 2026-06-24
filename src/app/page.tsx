import Link from "next/link";
import RecentChats from "@/components/RecentChats";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-gold">
          Юридический и шариатский анализ документов
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Legal &amp; Shariah AI Agent
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-600">
          AI-помощник для юридического анализа документов по законодательству
          Республики Узбекистан и анализа документов по исламскому банкингу.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/analyze"
            className="w-full rounded-md bg-navy px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-light sm:w-auto"
          >
            Новый анализ
          </Link>
          <Link
            href="/analyze#upload"
            className="w-full rounded-md border border-navy px-6 py-3 text-center text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white sm:w-auto"
          >
            Загрузить документ
          </Link>
          <Link
            href="/disclaimer"
            className="w-full rounded-md border border-gray-300 px-6 py-3 text-center text-sm font-semibold text-gray-700 transition-colors hover:border-gold hover:text-navy sm:w-auto"
          >
            Ограничения и дисклеймер
          </Link>
        </div>
      </div>

      <RecentChats />

      <div className="mt-16 grid gap-6 sm:grid-cols-3">
        <Feature
          title="Юридический анализ"
          body="Резюме документа, риски, таблица рисков и итоговая позиция по законодательству Республики Узбекистан, включая банковский режим."
        />
        <Feature
          title="Шариатский анализ"
          body="Проверка структуры сделки на риба, гарар, майсир и другие шариатские риски, с выводом о соответствии."
        />
        <Feature
          title="Работа с пунктами"
          body="Краткий деловой комментарий к пункту или готовая новая редакция условия договора."
        />
      </div>

      <div className="mt-14 rounded-md border border-gold/40 bg-gold/5 px-5 py-4 text-sm leading-relaxed text-gray-700">
        <strong className="text-navy">Дисклеймер.</strong> Ответы AI-агента
        являются аналитической и справочной информацией. Они не являются
        юридическим заключением, адвокатской консультацией, официальной позицией
        государственного органа, регулятора или шариатского совета.{" "}
        <Link href="/disclaimer" className="text-navy underline">
          Полный текст
        </Link>
        .
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-2 h-1 w-8 rounded bg-gold" />
      <h3 className="text-base font-semibold text-navy">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
    </div>
  );
}
