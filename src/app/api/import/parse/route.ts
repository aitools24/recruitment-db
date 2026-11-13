import { HttpError, handler, requireApi } from "@/lib/auth";
import { autoMap, parseSpreadsheet } from "@/lib/spreadsheet";

// Step 1 of spreadsheet import: read the file and suggest a column mapping. Nothing is saved yet.
export const POST = handler(async (req: Request) => {
  await requireApi("importData");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
  if (file.size > 25 * 1024 * 1024) throw new HttpError(400, "File is larger than 25 MB");
  try {
    const { headers, rows } = await parseSpreadsheet(file.name, Buffer.from(await file.arrayBuffer()));
    if (!headers.length) throw new HttpError(400, "No header row found in the file");
    return Response.json({ fileName: file.name, headers, rows, mapping: autoMap(headers) });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, e instanceof Error ? e.message : "Could not read the file");
  }
});
