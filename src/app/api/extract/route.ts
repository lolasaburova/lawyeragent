import { NextRequest, NextResponse } from "next/server";
import { extractText, SUPPORTED_EXTENSIONS } from "@/lib/extractText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Не удалось прочитать загруженный файл." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Файл не найден в запросе." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Файл слишком большой. Максимум 10 МБ." },
      { status: 400 },
    );
  }

  const name = file.name.toLowerCase();
  const supported = SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!supported) {
    return NextResponse.json(
      {
        error: `Неподдерживаемый формат. Поддерживаются: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // SECURITY: log only file name and size — never the extracted content.
    console.info(`[extract] file=${file.name} size=${file.size}`);

    const result = await extractText(file.name, buffer);

    return NextResponse.json({
      text: result.text,
      needsManualPaste: result.needsManualPaste ?? false,
      note: result.note ?? null,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Не удалось обработать файл.";
    console.error("[extract] error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
